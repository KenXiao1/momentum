import type { Chain } from '../../../types';
import {
  isRecord,
  pickNonNullish,
  toBooleanWithDefault,
  toNumber,
  toOptionalNumber,
  toOptionalTruthyBoolean,
  toStringArray,
  toStringWithDefault,
} from '../../../serialization/primitives';
import type { ImportTranslator } from './types';
import { generateId } from './id';

const allowedChainTypes = new Set([
  'unit',
  'group',
  'assault',
  'recon',
  'command',
  'special_ops',
  'engineering',
  'quartermaster',
]);

type ChainImportEntry = {
  raw: Record<string, unknown>;
  sourceId: string;
  newId: string;
};

export function getRawChainsFromPayload(
  payload: Record<string, unknown>,
  t: ImportTranslator,
): unknown[] {
  if (!('chains' in payload) || !Array.isArray(payload.chains)) {
    throw new Error(
      t('importExport.import.chains.invalidImportFormatNoValidChainsFound'),
    );
  }

  return payload.chains as unknown[];
}

export function buildChainEntriesAndIdMap(
  rawChains: unknown[],
  t: ImportTranslator,
): { chainEntries: ChainImportEntry[]; idMap: Map<string, string> } {
  const chainEntries: ChainImportEntry[] = [];
  const seenIds = new Set<string>();

  for (const raw of rawChains) {
    const record = isRecord(raw) ? raw : {};
    const sourceId = String(record.id ?? generateId('chain'));

    if (seenIds.has(sourceId)) {
      throw new Error(
        t(
          'importExport.import.chains.importDataContainsDuplicateChainIdSourceId',
          { sourceId: sourceId },
        ),
      );
    }

    seenIds.add(sourceId);
    chainEntries.push({ raw: record, sourceId, newId: generateId('chain') });
  }

  const idMap = new Map<string, string>(
    chainEntries.map((e) => [e.sourceId, e.newId]),
  );
  return { chainEntries, idMap };
}

function getImportedChainType(raw: Record<string, unknown>): string {
  const rawType = raw.type != null ? String(raw.type) : 'unit';
  return allowedChainTypes.has(rawType) ? rawType : 'unit';
}

function buildImportedChainStats(
  raw: Record<string, unknown>,
  preserveStatistics: boolean,
) {
  if (!preserveStatistics) {
    return {
      currentStreak: 0,
      auxiliaryStreak: 0,
      totalCompletions: 0,
      totalFailures: 0,
      auxiliaryFailures: 0,
    };
  }

  return {
    currentStreak: toNumber(raw.currentStreak, 0),
    auxiliaryStreak: toNumber(raw.auxiliaryStreak, 0),
    totalCompletions: toNumber(raw.totalCompletions, 0),
    totalFailures: toNumber(raw.totalFailures, 0),
    auxiliaryFailures: toNumber(raw.auxiliaryFailures, 0),
  };
}

function parsePreservedDateOrNow(
  value: unknown,
  preserveTimestamps: boolean,
): Date {
  if (!preserveTimestamps) return new Date();
  if (!value) return new Date();
  return new Date(String(value));
}

function parseOptionalPreservedDate(
  value: unknown,
  preserveTimestamps: boolean,
): Date | undefined {
  if (!preserveTimestamps) return undefined;
  if (!value) return undefined;
  return new Date(String(value));
}

function mapImportedChainParentId(
  raw: Record<string, unknown>,
  idMap: Map<string, string>,
): string | undefined {
  const sourceParentId = pickNonNullish(raw, 'parentId', 'parent_id');
  if (sourceParentId == null) return undefined;
  return idMap.get(String(sourceParentId));
}

export function buildImportChains(params: {
  chainEntries: ChainImportEntry[];
  idMap: Map<string, string>;
  preserveStatistics: boolean;
  preserveTimestamps: boolean;
  t: ImportTranslator;
}): Chain[] {
  const { chainEntries, idMap, preserveStatistics, preserveTimestamps, t } =
    params;

  return chainEntries.map(({ raw, newId }) => {
    const type = getImportedChainType(raw);
    const stats = buildImportedChainStats(raw, preserveStatistics);

    const createdAt = parsePreservedDateOrNow(
      raw.createdAt,
      preserveTimestamps,
    );
    const lastCompletedAt = parseOptionalPreservedDate(
      raw.lastCompletedAt,
      preserveTimestamps,
    );
    const parentId = mapImportedChainParentId(raw, idMap);

    const common = {
      id: newId,
      name: String(raw.name ?? t('importExport.import.chains.untitledChain')),
      parentId,
      sortOrder: toNumber(
        pickNonNullish(raw, 'sortOrder', 'sort_order'),
        Math.floor(Date.now() / 1000),
      ),
      trigger: toStringWithDefault(raw.trigger, ''),
      duration: toNumber(raw.duration, 45),
      description: toStringWithDefault(raw.description, ''),
      ...stats,
      exceptions: toStringArray(raw.exceptions),
      auxiliaryExceptions: toStringArray(raw.auxiliaryExceptions),
      auxiliarySignal: toStringWithDefault(raw.auxiliarySignal, ''),
      auxiliaryDuration: toNumber(raw.auxiliaryDuration, 15),
      auxiliaryCompletionTrigger: toStringWithDefault(
        raw.auxiliaryCompletionTrigger,
        '',
      ),
      timeLimitExceptions: toStringArray(
        pickNonNullish(raw, 'timeLimitExceptions', 'time_limit_exceptions'),
      ),
      isDurationless: toBooleanWithDefault(
        pickNonNullish(raw, 'isDurationless', 'is_durationless'),
        false,
      ),
      minimumDuration: toOptionalNumber(
        pickNonNullish(raw, 'minimumDuration', 'minimum_duration'),
      ),
      taskRepeatCount: toOptionalNumber(
        pickNonNullish(raw, 'taskRepeatCount', 'task_repeat_count'),
      ),
      createdAt,
      lastCompletedAt,
      deletedAt: null as null,
    };

    if (type === 'group') {
      return {
        ...common,
        type: 'group',
        timeLimitHours: toOptionalNumber(
          pickNonNullish(raw, 'timeLimitHours', 'time_limit_hours'),
        ),
        groupRepeatCount: toOptionalNumber(
          pickNonNullish(raw, 'groupRepeatCount', 'group_repeat_count'),
        ),
        isTaskGroup: toOptionalTruthyBoolean(
          pickNonNullish(raw, 'isTaskGroup', 'is_task_group'),
        ),
        groupStartedAt: undefined,
        groupExpiresAt: undefined,
      } as Chain;
    }

    return {
      ...common,
      type: type as Chain['type'],
    } as Chain;
  });
}
