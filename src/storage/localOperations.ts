import type {
  ImportData,
  SessionCompletionInput,
  SessionCompletionResult,
} from './operations';
import { storage } from '../utils/storage';
import { completedSessionKey, STORAGE_KEYS } from '../utils/storage/keys';
import {
  commitOperationJournal,
  recoverOperationJournal,
  withOperationLock,
} from '../utils/storage/operationJournal';
import {
  canonicalJson,
  operationFingerprint,
} from '../utils/operationIdentity';
import {
  decodeActiveSession,
  decodeChain,
  decodeCompletionHistory,
} from '../serialization';

const receiptKey = (id: string) => `momentum_committed_operation:${id}`;

export async function commitSessionCompletion(
  input: SessionCompletionInput,
): Promise<SessionCompletionResult> {
  return withOperationLock('local-data', async () => {
    recoverOperationJournal();
    const key = receiptKey(input.operationId);
    const receipt = localStorage.getItem(key);
    if (receipt) {
      const result = JSON.parse(receipt) as {
        record: Parameters<typeof decodeCompletionHistory>[0];
      };
      if (result.record.wasSuccessful !== input.record.wasSuccessful)
        throw new Error(
          'Retry the original session outcome before choosing another action.',
        );
      return {
        chains: storage.getChains(),
        record: decodeCompletionHistory(result.record),
      };
    }
    if (
      canonicalJson(storage.getActiveSession()) !==
        canonicalJson(
          decodeActiveSession(
            JSON.parse(JSON.stringify(input.session)) as Parameters<
              typeof decodeActiveSession
            >[0],
          ),
        ) ||
      canonicalJson(storage.getChains()) !==
        canonicalJson(
          input.expectedChains.map((chain) =>
            decodeChain(
              JSON.parse(JSON.stringify(chain)) as Parameters<
                typeof decodeChain
              >[0],
            ),
          ),
        )
    ) {
      throw new Error(
        'Session or chains changed. Reload before completing the task.',
      );
    }
    const result = { chains: input.chains, record: input.record };
    commitOperationJournal({
      [STORAGE_KEYS.CHAINS]: JSON.stringify(input.chains),
      [STORAGE_KEYS.COMPLETION_HISTORY]: JSON.stringify([
        ...storage.getCompletionHistory(),
        input.record,
      ]),
      [STORAGE_KEYS.ACTIVE_SESSION]: null,
      [completedSessionKey(input.session)]: input.operationId,
      [key]: JSON.stringify({ record: input.record }),
    });
    return result;
  });
}

export async function importData(data: ImportData): Promise<void> {
  const id = `import:${await operationFingerprint(data)}`;
  await withOperationLock('local-data', async () => {
    recoverOperationJournal();
    const key = receiptKey(id);
    if (localStorage.getItem(key)) return;
    if (data.exceptionRules?.length)
      throw new Error(
        'Exception rule import is not supported; no data was written.',
      );
    const chains = storage.getChains();
    const ids = new Set(chains.map((chain) => chain.id));
    if (
      new Set(data.chains.map((chain) => chain.id)).size !==
        data.chains.length ||
      data.chains.some((chain) => ids.has(chain.id))
    )
      throw new Error('Import contains conflicting chain IDs.');
    const values: Record<string, string | null> = {
      [STORAGE_KEYS.CHAINS]: JSON.stringify([...chains, ...data.chains]),
      [key]: 'committed',
    };
    const append = (
      target: string,
      incoming: unknown[] | undefined,
      existing: () => unknown[],
    ) => {
      if (!incoming?.length) return;
      const current = existing();
      const identity = (value: unknown) => {
        const row = value as Record<string, unknown>;
        if (target === STORAGE_KEYS.COMPLETION_HISTORY)
          return `${String(row.chainId)}:${new Date(String(row.completedAt)).toISOString()}`;
        return String(row.id ?? row.runNumber);
      };
      const ids = new Set(current.map(identity));
      for (const item of incoming) {
        const id = identity(item);
        if (ids.has(id))
          throw new Error(`Import contains conflicting records in ${target}.`);
        ids.add(id);
      }
      values[target] = JSON.stringify([...current, ...incoming]);
    };
    append(
      STORAGE_KEYS.COMPLETION_HISTORY,
      data.history,
      storage.getCompletionHistory,
    );
    append(STORAGE_KEYS.RSIP_NODES, data.rsipNodes, storage.getRSIPNodes);
    append(STORAGE_KEYS.RSIP_GROUPS, data.rsipGroups, storage.getRSIPGroups);
    append(
      STORAGE_KEYS.RSIP_POLICY_LIBRARY,
      data.rsipPolicyLibrary,
      storage.getRSIPPolicyLibrary,
    );
    append(
      STORAGE_KEYS.RSIP_RUN_HISTORY,
      data.rsipRunHistory,
      storage.getRSIPRunHistory,
    );
    append(
      STORAGE_KEYS.RSIP_EXECUTION_RECORDS,
      data.rsipExecutionRecords,
      storage.getRSIPExecutionRecords,
    );
    append(
      STORAGE_KEYS.RSIP_TASK_LINKS,
      data.rsipTaskLinks,
      storage.getRSIPTaskLinks,
    );
    if (data.rsipMeta)
      values[STORAGE_KEYS.RSIP_META] = JSON.stringify({
        ...storage.getRSIPMeta(),
        ...data.rsipMeta,
      });
    if (data.petState)
      values[STORAGE_KEYS.PET_STATE] = JSON.stringify(data.petState);
    commitOperationJournal(values);
  });
}
