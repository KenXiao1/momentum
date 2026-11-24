import { toError } from '../../../../utils/errorMessage';
import { logger } from '../../../../utils/logger';
import type { SupabaseStorageContext } from '../types';
import { findChainAndChildren } from './internal';
import { getChains } from './queries';

function isMissingDeletedAt(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    error.message?.includes('deleted_at') === true
  );
}

export async function softDeleteChain(
  ctx: SupabaseStorageContext,
  chainId: string,
): Promise<void> {
  const user = await ctx.getCurrentUser();
  if (!user) throw new Error('User not authenticated');
  const chains = findChainAndChildren(chainId, await getChains(ctx));
  try {
    const { error } = await ctx
      .getClient()
      .from('chains')
      .update({ deleted_at: new Date().toISOString() })
      .in(
        'id',
        chains.map((chain) => chain.id),
      )
      .eq('user_id', user.id);
    if (!error) return;
    if (!isMissingDeletedAt(error)) {
      throw new Error(`Soft delete chain failed: ${error.message}`);
    }
  } catch (error) {
    const normalized = toError(error);
    if (!isMissingDeletedAt(normalized)) throw normalized;
  }
  logger.warn(
    'SUPABASE_STORAGE',
    'Database does not support soft delete; falling back to permanent delete',
  );
  await permanentlyDeleteChain(ctx, chainId);
}

export async function restoreChain(
  ctx: SupabaseStorageContext,
  chainId: string,
): Promise<void> {
  const user = await ctx.getCurrentUser();
  if (!user) throw new Error('User not authenticated');
  const chains = findChainAndChildren(chainId, await getChains(ctx));
  await ctx.retryOperation(
    async () => {
      const { data, error } = await ctx
        .getClient()
        .from('chains')
        .update({ deleted_at: null })
        .in(
          'id',
          chains.map((chain) => chain.id),
        )
        .eq('user_id', user.id)
        .select('id');
      if (error) {
        if (isMissingDeletedAt(error)) {
          throw new Error(
            'Database does not support soft delete, cannot restore deleted chains',
          );
        }
        throw new Error(`Restore chain failed: ${error.message}`);
      }
      if (data.length !== chains.length) {
        logger.warn('SUPABASE_STORAGE', 'Partial restore', {
          expected: chains.length,
          restored: data.length,
          chainId,
        });
      }
    },
    2,
    500,
  );
  ctx.clearSchemaCache();
}

export async function permanentlyDeleteChain(
  ctx: SupabaseStorageContext,
  chainId: string,
): Promise<void> {
  const user = await ctx.getCurrentUser();
  if (!user) throw new Error('User not authenticated');
  const chains = findChainAndChildren(chainId, await getChains(ctx));
  const { error } = await ctx
    .getClient()
    .from('chains')
    .delete()
    .in(
      'id',
      chains.map((chain) => chain.id),
    )
    .eq('user_id', user.id);
  if (error) {
    throw new Error(`Permanent delete chain failed: ${error.message}`);
  }
}
