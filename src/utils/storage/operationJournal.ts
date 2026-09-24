import { z } from 'zod';

const JOURNAL_KEY = 'momentum_operation_journal';
const journalSchema = z.object({
  version: z.literal(1),
  writes: z.array(
    z.object({
      key: z.string().startsWith('momentum_'),
      before: z.string().nullable(),
      after: z.string().nullable(),
    }),
  ),
});

function write(key: string, value: string | null): void {
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}

/** Recover before exposing any local data. Never replace a concurrent edit. */
export function recoverOperationJournal(): void {
  const raw = localStorage.getItem(JOURNAL_KEY);
  if (!raw) return;
  const journal = journalSchema.parse(JSON.parse(raw));
  for (const item of journal.writes) {
    const current = localStorage.getItem(item.key);
    if (current !== item.before && current !== item.after) {
      throw new Error(
        'A saved operation conflicts with newer data. Export diagnostics before recovery.',
      );
    }
  }
  for (const item of journal.writes) write(item.key, item.after);
  localStorage.removeItem(JOURNAL_KEY);
}

/** Persist the complete recovery plan before the first application write. */
export function commitOperationJournal(
  values: Record<string, string | null>,
): void {
  recoverOperationJournal();
  const writes = Object.entries(values).map(([key, after]) => ({
    key,
    before: localStorage.getItem(key),
    after,
  }));
  localStorage.setItem(JOURNAL_KEY, JSON.stringify({ version: 1, writes }));
  recoverOperationJournal();
}

const operationQueues = new Map<string, Promise<unknown>>();

export async function withOperationLock<T>(
  scope: string,
  operation: () => Promise<T>,
): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(`momentum:${scope}`, operation);
  }
  const prior = operationQueues.get(scope) ?? Promise.resolve();
  const pending = prior.catch(() => undefined).then(operation);
  operationQueues.set(scope, pending);
  try {
    return await pending;
  } finally {
    if (operationQueues.get(scope) === pending) operationQueues.delete(scope);
  }
}
