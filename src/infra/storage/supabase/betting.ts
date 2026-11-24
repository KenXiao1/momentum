import type {
  BetPlacementRequest,
  BetPlacementResult,
} from '../../../domain/betting';
import type { AppError } from '../../../domain/errors';
import { toAppError } from '../../../domain/errors';
import type { Result } from '../../../domain/result';
import { err, ok } from '../../../domain/result';
import type { SupabaseStorageContext } from './types';

export async function createBettingSession(
  ctx: SupabaseStorageContext,
  chainId: string,
  duration: number,
): Promise<Result<string, AppError>> {
  try {
    const user = await ctx.getCurrentUser();
    if (!user)
      return err({
        code: 'NOT_AUTHENTICATED',
        message: 'User not authenticated',
      });

    const client = ctx.getClient();
    const { data, error } = await client
      .from('active_sessions')
      .insert({
        chain_id: chainId,
        started_at: new Date().toISOString(),
        duration,
        is_paused: false,
        paused_at: null,
        total_paused_time: 0,
        user_id: user.id,
      })
      .select('id')
      .single();

    if (error)
      return err({
        code: 'STORAGE',
        message: error.message || 'Failed to create session',
        cause: error,
      });
    if (!data?.id)
      return err({
        code: 'STORAGE',
        message: 'Failed to create session: missing id',
      });
    return ok(data.id);
  } catch (e) {
    return err(toAppError(e, 'Failed to create betting session'));
  }
}

export async function deleteBettingSession(
  ctx: SupabaseStorageContext,
  sessionId: string,
): Promise<Result<void, AppError>> {
  try {
    const user = await ctx.getCurrentUser();
    if (!user)
      return err({
        code: 'NOT_AUTHENTICATED',
        message: 'User not authenticated',
      });

    const client = ctx.getClient();
    const { error } = await client
      .from('active_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id);
    if (error)
      return err({
        code: 'STORAGE',
        message: error.message || 'Failed to delete session',
        cause: error,
      });
    return ok(undefined);
  } catch (e) {
    return err(toAppError(e, 'Failed to delete betting session'));
  }
}

export async function completeTaskWithBetting(
  ctx: SupabaseStorageContext,
  sessionId: string,
  wasSuccessful: boolean,
  completionNotes?: string,
): Promise<Result<unknown, AppError>> {
  try {
    const client = ctx.getClient();
    const { data, error } = await client.rpc('complete_task_with_betting', {
      p_session_id: sessionId,
      p_was_successful: wasSuccessful,
      p_completion_notes: completionNotes || null,
    });
    if (error)
      return err({
        code: 'STORAGE',
        message: error.message || 'Failed to complete task',
        cause: error,
      });
    return ok(data as unknown);
  } catch (e) {
    return err(toAppError(e, 'Failed to complete task with betting'));
  }
}

export async function placeBet(
  ctx: SupabaseStorageContext,
  betRequest: BetPlacementRequest,
): Promise<Result<BetPlacementResult, AppError>> {
  let writeSessionToken: string | null = null;

  try {
    const user = await ctx.getCurrentUser();
    if (!user)
      return err({
        code: 'NOT_AUTHENTICATED',
        message: 'User not authenticated',
      });

    const client = ctx.getClient();

    const { data: writeSessionData, error: writeSessionError } =
      await client.rpc('create_write_session', {
        session_type: 'betting',
        duration_minutes: 5,
      });

    if (
      writeSessionError ||
      !writeSessionData?.success ||
      !writeSessionData?.session_token
    ) {
      return ok({
        success: false,
        message:
          writeSessionError?.message ||
          writeSessionData?.error ||
          'Failed to create betting session',
        error_code: 'WRITE_SESSION_CREATION_FAILED',
      });
    }

    writeSessionToken = writeSessionData.session_token;

    const { data, error } = await client.rpc('place_task_bet', {
      p_user_id: user.id,
      p_session_id: betRequest.session_id,
      p_bet_amount: betRequest.bet_amount,
      p_write_session_token: writeSessionToken,
    });

    if (error) {
      return ok({
        success: false,
        message: `Bet placement failed: ${error.message || 'Unknown error'}`,
        error_code: error.code ?? 'BET_PLACEMENT_FAILED',
      });
    }

    try {
      await client.rpc('complete_write_session', {
        p_session_token: writeSessionToken,
      });
    } catch {
      // ignore
    }

    return ok(data);
  } catch (e) {
    if (writeSessionToken) {
      try {
        const client = ctx.getClient();
        await client.rpc('complete_write_session', {
          p_session_token: writeSessionToken,
        });
      } catch {
        // ignore
      }
    }
    return err(toAppError(e, 'Bet placement failed'));
  }
}

export async function getUserAvailablePoints(
  ctx: SupabaseStorageContext,
): Promise<Result<number, AppError>> {
  try {
    const user = await ctx.getCurrentUser();
    if (!user)
      return err({
        code: 'NOT_AUTHENTICATED',
        message: 'User not authenticated',
      });

    const client = ctx.getClient();
    const { data, error } = await client
      .from('user_points')
      .select('total_points')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return ok(0);
      return err({
        code: 'STORAGE',
        message: error.message || 'Failed to get user points',
        cause: error,
      });
    }

    return ok(data?.total_points ?? 0);
  } catch (e) {
    return err(toAppError(e, 'Failed to get user points'));
  }
}

export async function getTodayBetAmount(
  ctx: SupabaseStorageContext,
): Promise<Result<number, AppError>> {
  try {
    const user = await ctx.getCurrentUser();
    if (!user) return ok(0);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const client = ctx.getClient();
    const { data, error } = await client
      .from('point_transactions')
      .select('transaction_type, points_change')
      .eq('user_id', user.id)
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString())
      .in('transaction_type', ['bet_placed', 'bet_refunded']);

    if (error) {
      return err({
        code: 'STORAGE',
        message: error.message || 'Failed to get today bet amount',
        cause: error,
      });
    }

    const rows =
      (data as Array<{
        transaction_type?: string;
        points_change?: number;
      }> | null) ?? [];

    const totalPlaced = rows.reduce((sum, tx) => {
      if (tx.transaction_type !== 'bet_placed') return sum;
      const delta = typeof tx.points_change === 'number' ? tx.points_change : 0;
      return sum + Math.abs(delta);
    }, 0);

    const totalRefunded = rows.reduce((sum, tx) => {
      if (tx.transaction_type !== 'bet_refunded') return sum;
      const delta = typeof tx.points_change === 'number' ? tx.points_change : 0;
      return sum + Math.abs(delta);
    }, 0);

    return ok(Math.max(0, totalPlaced - totalRefunded));
  } catch {
    return ok(0);
  }
}
