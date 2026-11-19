import type { Chain } from '../../../../types';
import type { Database } from '../../../../lib/database.types';
import { logger } from '../../../../utils/logger';
import { buildChainRow } from '../chainMapper';
import {
  cacheMissingCapabilitiesFromError,
  hasKnownMissingCapabilities,
  isMissingSchemaCapabilityError,
  markCapabilitiesAvailable,
} from '../schemaCapabilities';
import type { SupabaseStorageContext } from '../types';
import { formatDbError } from './internal';

type ChainInsert = Database['public']['Tables']['chains']['Insert'];
const TABLE = 'chains';
const STRICT_CAPABILITIES = [
  'is_durationless',
  'minimum_duration',
  'is_task_group',
  'task_repeat_count',
  'group_repeat_count',
  'time_limit_hours',
  'time_limit_exceptions',
  'group_started_at',
  'group_expires_at',
  'deleted_at',
] as const;

async function upsertWithFallback(
  ctx: SupabaseStorageContext,
  rowsWithNew: ChainInsert[],
  rowsBase: ChainInsert[],
): Promise<string[]> {
  const client = ctx.getClient();
  const tryUpsert = async (rows: ChainInsert[]) =>
    ctx.retryWithAuth(async () => {
      const { data, error } = await client
        .from(TABLE)
        .upsert(rows, { onConflict: 'id' })
        .select('id');
      if (error) throw error;
      return (data ?? []) as Array<{ id: string }>;
    });

  if (hasKnownMissingCapabilities(ctx, TABLE, STRICT_CAPABILITIES)) {
    return (await tryUpsert(rowsBase)).map((row) => row.id);
  }
  try {
    const result = await tryUpsert(rowsWithNew);
    markCapabilitiesAvailable(ctx, TABLE, STRICT_CAPABILITIES);
    return result.map((row) => row.id);
  } catch (error) {
    if (!isMissingSchemaCapabilityError(error)) {
      throw new Error(`Failed to save chains: ${formatDbError(error)}`, {
        cause: error,
      });
    }
    cacheMissingCapabilitiesFromError(ctx, TABLE, STRICT_CAPABILITIES, error, {
      markAllOnSchemaCacheError: true,
    });
    return (await tryUpsert(rowsBase)).map((row) => row.id);
  }
}

function assertUniqueIds(chains: Chain[]): void {
  const ids = new Set<string>();
  for (const chain of chains) {
    if (ids.has(chain.id)) {
      throw new Error(`Duplicate chain id detected: ${chain.id}`);
    }
    ids.add(chain.id);
  }
}

export async function saveChains(
  ctx: SupabaseStorageContext,
  chains: Chain[],
): Promise<void> {
  const { user, isAuthenticated } = await ctx.waitForAuthentication(10000);
  if (!isAuthenticated || !user) {
    throw new Error('User authentication failed or timed out');
  }
  assertUniqueIds(chains);
  const client = ctx.getClient();
  const { data: existingRows, error } = await client
    .from(TABLE)
    .select('id')
    .eq('user_id', user.id);
  if (error) {
    throw new Error(`Failed to query existing chains: ${formatDbError(error)}`);
  }

  const savedIds = await upsertWithFallback(
    ctx,
    chains.map((chain) => buildChainRow(chain, user.id, true)),
    chains.map((chain) => buildChainRow(chain, user.id, false)),
  );
  const expectedIds = new Set(chains.map((chain) => chain.id));
  const idsToDelete = (existingRows ?? [])
    .map((row) => row.id)
    .filter((id) => !expectedIds.has(id));
  if (idsToDelete.length) {
    const { error: deleteError } = await client
      .from(TABLE)
      .delete()
      .in('id', idsToDelete)
      .eq('user_id', user.id);
    if (deleteError) {
      throw new Error(
        `Failed to delete extra chains: ${formatDbError(deleteError)}`,
      );
    }
  }

  const savedIdSet = new Set(savedIds);
  const missingSavedIds = [...expectedIds].filter((id) => !savedIdSet.has(id));
  if (missingSavedIds.length) {
    logger.warn('SUPABASE_STORAGE', 'Some saved ids missing from result', {
      missingSavedIds,
    });
  }
}

export async function upsertChains(
  ctx: SupabaseStorageContext,
  chains: Chain[],
): Promise<void> {
  if (chains.length === 0) return;
  const { user, isAuthenticated } = await ctx.waitForAuthentication(10000);
  if (!isAuthenticated || !user) {
    throw new Error('User authentication failed or timed out');
  }
  assertUniqueIds(chains);
  const savedIds = new Set(
    await upsertWithFallback(
      ctx,
      chains.map((chain) => buildChainRow(chain, user.id, true)),
      chains.map((chain) => buildChainRow(chain, user.id, false)),
    ),
  );
  const missingSavedIds = chains
    .map((chain) => chain.id)
    .filter((id) => !savedIds.has(id));
  if (missingSavedIds.length) {
    throw new Error(
      `Chain upsert did not confirm ${missingSavedIds.length} row(s)`,
    );
  }
}

export async function upsertChain(
  ctx: SupabaseStorageContext,
  chain: Chain,
): Promise<void> {
  const { user, isAuthenticated } = await ctx.waitForAuthentication(10000);
  if (!isAuthenticated || !user) {
    throw new Error('User authentication failed or timed out');
  }
  const savedIds = await upsertWithFallback(
    ctx,
    [buildChainRow(chain, user.id, true)],
    [buildChainRow(chain, user.id, false)],
  );
  if (!savedIds.includes(chain.id)) {
    logger.warn('SUPABASE_STORAGE', 'Upserted chain id missing from result', {
      chainId: chain.id,
    });
  }
}
