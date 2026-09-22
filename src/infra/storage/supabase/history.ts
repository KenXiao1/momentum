import type { CompletionHistory } from '../../../types';
import type { SupabaseClient, SupabaseStorageContext } from './types';
import { operationFingerprint } from '../../../utils/operationIdentity';
import { readOperationRows } from './operations';
import {
  getObservedUserScopedRows,
  getUserScopedOrderedRows,
  replaceUserScopedRows,
} from './rsipShared';
import {
  buildCompletionHistoryRowsBasic,
  buildCompletionHistoryRowsWithNewFields,
  mapCompletionHistoryRow,
  type CompletionHistorySelectRow,
} from './historyMapper';

const COMPLETION_HISTORY_CONFLICT_TARGET = 'user_id,chain_id,completed_at';
const COMPLETION_HISTORY_CHUNK_SIZE = 500;

function isMissingUniqueConstraint(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === '42P10' ||
    error.message?.includes('no unique or exclusion constraint matching') ===
      true
  );
}

function isMissingTimingColumns(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    error.message?.includes('actual_duration') === true ||
    error.message?.includes('is_forward_timed') === true
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length <= size) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function insertCompletionHistoryLegacy(
  client: SupabaseClient,
  userId: string,
  history: CompletionHistory[],
): Promise<void> {
  const { data: existingHistory } = await client
    .from('completion_history')
    .select('chain_id, completed_at')
    .eq('user_id', userId);

  const existingKeys = new Set(
    (existingHistory || []).map(
      (item: { chain_id: string; completed_at: string }) => {
        const normalizedTime = new Date(item.completed_at).getTime();
        return `${item.chain_id}-${normalizedTime}`;
      },
    ),
  );

  const newHistory = history.filter((item) => {
    const normalizedTime = item.completedAt.getTime();
    const key = `${item.chainId}-${normalizedTime}`;
    return !existingKeys.has(key);
  });

  if (newHistory.length === 0) return;

  const legacyResult = await client
    .from('completion_history')
    .insert(buildCompletionHistoryRowsWithNewFields(userId, newHistory));
  if (legacyResult.error && isMissingTimingColumns(legacyResult.error)) {
    await client
      .from('completion_history')
      .insert(buildCompletionHistoryRowsBasic(userId, newHistory));
  }
}

export async function getCompletionHistory(
  ctx: SupabaseStorageContext,
): Promise<CompletionHistory[]> {
  const { rows } = await getUserScopedOrderedRows(ctx, {
    table: 'completion_history',
    orderBy: 'completed_at',
    ascending: false,
    errorLabel: 'completion history',
  });
  return (rows as CompletionHistorySelectRow[]).map(mapCompletionHistoryRow);
}

async function persistCompletionHistory(
  ctx: SupabaseStorageContext,
  userId: string,
  history: CompletionHistory[],
): Promise<void> {
  if (history.length === 0) return;

  const client = ctx.getClient();

  // Try once with new fields to detect schema compatibility.
  let mode: 'new' | 'basic' = 'new';

  for (const currentChunk of chunk(history, COMPLETION_HISTORY_CHUNK_SIZE)) {
    const rows =
      mode === 'new'
        ? buildCompletionHistoryRowsWithNewFields(userId, currentChunk)
        : buildCompletionHistoryRowsBasic(userId, currentChunk);
    let { error } = await client.from('completion_history').upsert(rows, {
      onConflict: COMPLETION_HISTORY_CONFLICT_TARGET,
      ignoreDuplicates: true,
    });

    if (!error) continue;

    if (isMissingTimingColumns(error)) {
      mode = 'basic';
      ({ error } = await client
        .from('completion_history')
        .upsert(buildCompletionHistoryRowsBasic(userId, currentChunk), {
          onConflict: COMPLETION_HISTORY_CONFLICT_TARGET,
          ignoreDuplicates: true,
        }));
      if (!error) continue;
    }

    if (isMissingUniqueConstraint(error)) {
      // Legacy schema: no UNIQUE index for ON CONFLICT. Fallback to best-effort insert.
      await insertCompletionHistoryLegacy(client, userId, history);
      return;
    }

    // best-effort: ignore other errors
    return;
  }
}

export async function saveCompletionHistory(
  ctx: SupabaseStorageContext,
  history: CompletionHistory[],
): Promise<void> {
  const user = await ctx.getCurrentUser();
  if (!user)
    throw new Error('Authentication required to save completion history.');
  const before =
    getObservedUserScopedRows(ctx, user.id, 'completion_history') ??
    (await readOperationRows(ctx, 'completion_history', user.id));
  const rows = await Promise.all(
    buildCompletionHistoryRowsWithNewFields(user.id, history).map(
      async (row) => {
        const existing = before.find(
          (item) =>
            item.chain_id === row.chain_id &&
            new Date(String(item.completed_at)).getTime() ===
              new Date(row.completed_at).getTime(),
        );
        // Stable identity preserves existing trigger metadata and survives retries
        // when an INSERT committed but its response never reached this device.
        const digest = await operationFingerprint({
          userId: user.id,
          chainId: row.chain_id,
          completedAt: row.completed_at,
        });
        const stableId = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-8${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
        return { ...existing, ...row, id: existing?.id ?? stableId };
      },
    ),
  );
  await replaceUserScopedRows(ctx, 'completion_history', rows, before, user.id);
}

export async function appendCompletionHistory(
  ctx: SupabaseStorageContext,
  record: CompletionHistory,
): Promise<void> {
  const user = await ctx.getCurrentUser();
  if (!user) return;
  await persistCompletionHistory(ctx, user.id, [record]);
}
