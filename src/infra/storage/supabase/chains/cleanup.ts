import { toError } from '../../../../utils/errorMessage';
import type { SupabaseStorageContext } from '../types';

export async function cleanupExpiredDeletedChains(
  ctx: SupabaseStorageContext,
  olderThanDays: number = 30,
): Promise<number> {
  const user = await ctx.getCurrentUser();
  if (!user) return 0;

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const client = ctx.getClient();
    const { data: expiredChains, error: selectError } = await client
      .from('chains')
      .select('id')
      .eq('user_id', user.id)
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoffDate.toISOString());

    if (selectError) {
      if (
        selectError.code === '42703' ||
        selectError.message.includes('deleted_at does not exist')
      ) {
        return 0;
      }
      throw new Error(`Failed to find expired chains: ${selectError.message}`);
    }

    if (expiredChains.length === 0) return 0;

    const { error: deleteError } = await client
      .from('chains')
      .delete()
      .in(
        'id',
        expiredChains.map((c) => c.id),
      )
      .eq('user_id', user.id);

    if (deleteError) {
      throw new Error(
        `Failed to cleanup expired chains: ${deleteError.message}`,
      );
    }

    return expiredChains.length;
  } catch (error) {
    const errorObj = toError(error);
    if (errorObj.message.includes('deleted_at does not exist')) {
      return 0;
    }
    throw errorObj;
  }
}
