import {
  OperationReadError,
  readOperationRows,
  replaceOperationRows,
} from './operations';
import { measureStorageOperation } from '../../../utils/diagnostics';
import { canonicalJson } from '../../../utils/operationIdentity';
import { rowIdentity } from './operationRows';
import type { SupabaseStorageContext } from './types';
import { isSchemaMissing } from './rsipNodeCapabilities';

type Observation = { rows: Record<string, unknown>[]; committed: boolean };
const observedRows = new WeakMap<
  SupabaseStorageContext,
  Map<string, Observation>
>();

export function getObservedUserScopedRows(
  ctx: SupabaseStorageContext,
  userId: string,
  table: string,
): Record<string, unknown>[] | undefined {
  return observedRows.get(ctx)?.get(`${userId}:${table}`)?.rows;
}

export async function replaceUserScopedRows(
  ctx: SupabaseStorageContext,
  table: string,
  rows: Record<string, unknown>[],
  expected?: Record<string, unknown>[],
  expectedUserId?: string,
): Promise<void> {
  const user = await ctx.getCurrentUser();
  if (!user) throw new Error('Authentication required to save collections.');
  if (expectedUserId && user.id !== expectedUserId)
    throw new Error('Account changed before saving the collection.');
  const snapshots = observedRows.get(ctx) ?? new Map<string, Observation>();
  const key = `${user.id}:${table}`;
  const observation = snapshots.get(key);
  const committed = await measureStorageOperation(
    'collection-save',
    'supabase',
    () =>
      replaceOperationRows(
        ctx,
        table,
        rows,
        async () => {
          // This only prepares a new intent. A matching unconfirmed intent must
          // replay its original request before any comparison with newer rows.
          if (!observation?.committed) return expected ?? observation?.rows;
          const current = await readOperationRows(ctx, table, user.id);
          const matches =
            current.length === observation.rows.length &&
            observation.rows.every((known) => {
              const live = current.find(
                (row) => rowIdentity(table, row) === rowIdentity(table, known),
              );
              return (
                live &&
                Object.entries(known).every(([column, value]) => {
                  if (column === 'updated_at') return true;
                  const actual = live[column];
                  if (
                    column.endsWith('_at') &&
                    typeof value === 'string' &&
                    typeof actual === 'string'
                  )
                    return Date.parse(value) === Date.parse(actual);
                  return (
                    canonicalJson(actual ?? null) ===
                    canonicalJson(value ?? null)
                  );
                })
              );
            });
          if (!matches)
            throw new Error(
              'Collection changed on another client. Reload before saving.',
            );
          return current;
        },
        user.id,
      ),
  );
  snapshots.set(key, { rows: committed, committed: true });
  observedRows.set(ctx, snapshots);
}

export async function getUserScopedOrderedRows(
  ctx: SupabaseStorageContext,
  options: {
    table: string;
    orderBy: string;
    ascending: boolean;
    errorLabel: string;
  },
): Promise<{ userId: string | null; rows: Record<string, unknown>[] }> {
  const user = await ctx.getCurrentUser();
  if (!user) return { userId: null, rows: [] };

  let data: Record<string, unknown>[];
  try {
    data = await readOperationRows(ctx, options.table, user.id);
  } catch (error) {
    if (error instanceof OperationReadError && isSchemaMissing(error.cause))
      return { userId: user.id, rows: [] };
    throw error;
  }
  const snapshots = observedRows.get(ctx) ?? new Map();
  snapshots.set(`${user.id}:${options.table}`, {
    rows: data,
    committed: false,
  });
  observedRows.set(ctx, snapshots);
  const direction = options.ascending ? 1 : -1;
  const rows = [...data].sort((left, right) => {
    const a = left[options.orderBy];
    const b = right[options.orderBy];
    return (
      direction *
      (typeof a === 'number' && typeof b === 'number'
        ? a - b
        : String(a).localeCompare(String(b)))
    );
  });
  return { userId: user.id, rows };
}
