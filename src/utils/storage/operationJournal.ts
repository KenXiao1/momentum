import { z } from 'zod';
import { InterruptedOperationConflictError } from '../../domain/errors';

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
      throw new InterruptedOperationConflictError();
    }
  }
  for (const item of journal.writes) write(item.key, item.after);
  localStorage.removeItem(JOURNAL_KEY);
}

/**
 * Drops an unfinished operation and keeps every key's current value. Only for
 * the conflict case, after the user has exported `exportLocalRawData()`.
 */
export function discardOperationJournal(): void {
  localStorage.removeItem(JOURNAL_KEY);
}

/**
 * Every Momentum key in this browser's storage, including an unfinished
 * operation's journal, as JSON the user can keep before recovering.
 */
export function exportLocalRawData(): string {
  const entries: Record<string, string | null> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith('momentum')) entries[key] = localStorage.getItem(key);
  }
  return JSON.stringify(
    { schemaVersion: 1, exportedAt: new Date().toISOString(), entries },
    null,
    2,
  );
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
