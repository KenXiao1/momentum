import { withOperationLock } from '../../utils/storage/operationJournal';
import { operationFingerprint } from '../../utils/operationIdentity';
import type { ImportService } from './ImportService';
import { importExportService } from '../ImportExportService';

type ParsedImport = ReturnType<ImportService['parseImportData']>;
interface ImportPlan {
  version: 1;
  id?: string;
  parsed: ParsedImport;
  stage: 'data' | 'rules' | 'committed';
}

function readPlan(raw: string): ImportPlan {
  const plan: ImportPlan = JSON.parse(raw, (field: string, value: unknown) => {
    if (
      field.endsWith('At') &&
      typeof value === 'string' &&
      Number.isFinite(Date.parse(value))
    )
      return new Date(value);
    return value;
  });
  if (
    plan.version !== 1 ||
    !Array.isArray(plan.parsed?.chains) ||
    !['data', 'rules', 'committed'].includes(plan.stage) ||
    (plan.id !== undefined && typeof plan.id !== 'string')
  )
    throw new Error('Invalid saved import plan.');
  return plan;
}

/** Persist the parsed IDs and timestamps before any destination write. */
export async function prepareImportPlan(
  scope: string,
  params: Parameters<ImportService['parseImportData']>[0],
): Promise<{
  plan: ImportPlan;
  save: (stage: ImportPlan['stage']) => Promise<void>;
}> {
  const fingerprint = await operationFingerprint({
    json: params.json,
    options: params.options,
  });
  const key = `momentum_import_plan:${scope}:${fingerprint}`;
  return withOperationLock(key, async () => {
    const raw = localStorage.getItem(key);
    const saved = raw ? readPlan(raw) : undefined;
    // Only an unfinished attempt is a retry. A confirmed import does not consume
    // the source forever: importing that backup again creates a new operation.
    const plan: ImportPlan =
      saved && saved.stage !== 'committed'
        ? saved
        : {
            version: 1,
            parsed: importExportService.parseImportData(params),
            stage: 'data',
          };
    if (!plan.id) {
      plan.id = crypto.randomUUID();
      localStorage.setItem(key, JSON.stringify(plan));
    }
    const save = async (stage: ImportPlan['stage']) => {
      await withOperationLock(key, async () => {
        const current = localStorage.getItem(key);
        const latest = current ? readPlan(current) : undefined;
        if (!latest || latest.id !== plan.id)
          throw new Error('This import plan was replaced by a newer import.');
        const stages: ImportPlan['stage'][] = ['data', 'rules', 'committed'];
        const confirmedStage =
          stages.indexOf(latest.stage) > stages.indexOf(stage)
            ? latest.stage
            : stage;
        localStorage.setItem(
          key,
          JSON.stringify({ ...plan, stage: confirmedStage }),
        );
        plan.stage = confirmedStage;
      });
    };
    return { plan, save };
  });
}
