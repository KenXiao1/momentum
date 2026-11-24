import type { CheckinResult, CheckinStats } from '../../../domain/checkin';
import type { AppError } from '../../../domain/errors';
import { toAppError } from '../../../domain/errors';
import type { Result } from '../../../domain/result';
import { err, ok } from '../../../domain/result';
import type { SupabaseStorageContext } from './types';

export async function performDailyCheckin(
  ctx: SupabaseStorageContext,
): Promise<Result<CheckinResult, AppError>> {
  try {
    const user = await ctx.getCurrentUser();
    if (!user)
      return err({
        code: 'NOT_AUTHENTICATED',
        message: 'User not authenticated',
      });

    const client = ctx.getClient();
    const { data, error } = await client.rpc('perform_daily_checkin', {
      target_user_id: user.id,
    });
    if (error)
      return err({
        code: 'STORAGE',
        message: error.message || 'Check-in failed',
        cause: error,
      });
    return ok(data as CheckinResult);
  } catch (e) {
    return err(toAppError(e, 'Check-in failed'));
  }
}

export async function getUserCheckinStats(
  ctx: SupabaseStorageContext,
): Promise<Result<CheckinStats, AppError>> {
  try {
    const user = await ctx.getCurrentUser();
    if (!user)
      return err({
        code: 'NOT_AUTHENTICATED',
        message: 'User not authenticated',
      });

    const client = ctx.getClient();
    const { data, error } = await client.rpc('get_user_checkin_stats', {
      target_user_id: user.id,
    });
    if (error)
      return err({
        code: 'STORAGE',
        message: error.message || 'Failed to get stats',
        cause: error,
      });
    return ok(data);
  } catch (e) {
    return err(toAppError(e, 'Failed to get check-in stats'));
  }
}
