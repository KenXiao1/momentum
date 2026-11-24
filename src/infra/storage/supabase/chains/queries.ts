import type { Chain, DeletedChain } from '../../../../types';
import { logger } from '../../../../utils/logger';
import { mapChainRowToChain } from '../chainMapper';
import type { SupabaseStorageContext } from '../types';
import { isMissingDeletedAtColumnError } from './internal';

export async function getChains(ctx: SupabaseStorageContext): Promise<Chain[]> {
  const user = await ctx.getCurrentUser();
  if (!user) {
    logger.warn('SUPABASE_STORAGE', 'getChains: User not authenticated');
    return [];
  }

  const client = ctx.getClient();

  const fetchChains = async () => {
    const { data, error } = await client
      .from('chains')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      logger.error('SUPABASE_STORAGE', 'Failed to get chains data', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        userId: user.id,
      });

      throw new Error(`Failed to fetch chains: ${error.message}`);
    }

    const chainCount = data.length;
    logger.dbOperation('getChains', true, { chainCount, userId: user.id });

    return data.map(mapChainRowToChain);
  };

  // A failed read must never look like an empty account: callers would
  // render (and later persist) an empty list.
  return ctx.retryOperation(fetchChains, 2, 100);
}

export async function getActiveChains(
  ctx: SupabaseStorageContext,
): Promise<Chain[]> {
  const user = await ctx.getCurrentUser();
  if (!user) return [];

  const client = ctx.getClient();

  const fetchActiveChains = async () => {
    const { data, error } = await client
      .from('chains')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingDeletedAtColumnError(error)) {
        const allChains = await getChains(ctx);
        return allChains.filter((chain) => chain.deletedAt == null);
      }

      throw new Error(`Failed to fetch active chains: ${error.message}`);
    }

    return data.map(mapChainRowToChain);
  };

  return ctx.retryOperation(fetchActiveChains, 2, 100);
}

export async function getDeletedChains(
  ctx: SupabaseStorageContext,
): Promise<DeletedChain[]> {
  const user = await ctx.getCurrentUser();
  if (!user) return [];

  const client = ctx.getClient();
  const fetchDeletedChains = async () => {
    const { data, error } = await client
      .from('chains')
      .select('*')
      .eq('user_id', user.id)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (error) {
      if (isMissingDeletedAtColumnError(error)) {
        const allChains = await getChains(ctx);
        const deletedChains = allChains.filter(
          (chain) => chain.deletedAt != null,
        );
        return deletedChains
          .map((chain) => ({ ...chain, deletedAt: chain.deletedAt! }))
          .sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
      }

      throw new Error(`Failed to fetch deleted chains: ${error.message}`);
    }

    const chains = data.map(mapChainRowToChain);
    return chains
      .filter((chain) => chain.deletedAt != null)
      .map((chain) => ({
        ...chain,
        deletedAt: chain.deletedAt!,
      })) as DeletedChain[];
  };

  return ctx.retryOperation(fetchDeletedChains, 2, 100);
}
