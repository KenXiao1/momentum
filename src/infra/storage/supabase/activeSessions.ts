import type { ActiveSession } from '../../../types';
import type { Database } from '../../../lib/database.types';
import type { SupabaseStorageContext } from './types';
import {
  hasKnownMissingCapabilities,
  isMissingSchemaCapabilityError,
  markCapabilitiesAvailable,
  markCapabilitiesMissing,
} from './schemaCapabilities';
import { formatSupabaseError } from './supabaseError';
import { mapActiveSessionRow } from './sessionMapper';

type ActiveSessionRow = Database['public']['Tables']['active_sessions']['Row'];
type ActiveSessionInsert =
  Database['public']['Tables']['active_sessions']['Insert'];
const TABLE = 'active_sessions';
const FORWARD_TIMER_CAPABILITIES = [
  'is_forward_timer',
  'forward_elapsed_time',
] as const;

function hasMissingForwardTimerFields(ctx: SupabaseStorageContext): boolean {
  return hasKnownMissingCapabilities(ctx, TABLE, FORWARD_TIMER_CAPABILITIES);
}

function isMissingForwardTimerFieldError(error: unknown): boolean {
  if (!isMissingSchemaCapabilityError(error)) return false;
  const message = formatSupabaseError(error, '').toLowerCase();
  return (
    message.includes('is_forward_timer') ||
    message.includes('forward_elapsed_time')
  );
}

function buildBasicPayload(
  session: ActiveSession,
  userId: string,
): ActiveSessionInsert {
  return {
    id: session.id,
    chain_id: session.chainId,
    started_at: session.startedAt.toISOString(),
    duration: session.duration,
    is_paused: session.isPaused,
    paused_at: session.pausedAt?.toISOString() ?? null,
    total_paused_time: session.totalPausedTime,
    user_id: userId,
  };
}

function shouldFallbackToBasicPayload(params: {
  error: unknown;
  includeForwardFields: boolean;
  skipForwardFields: boolean;
}): boolean {
  return (
    params.includeForwardFields &&
    !params.skipForwardFields &&
    isMissingForwardTimerFieldError(params.error)
  );
}

export async function getActiveSession(
  ctx: SupabaseStorageContext,
): Promise<ActiveSession | null> {
  const user = await ctx.getCurrentUser();
  if (!user) return null;
  const client = ctx.getClient();
  const fullSelect =
    'id, chain_id, started_at, duration, is_paused, paused_at, total_paused_time, is_forward_timer, forward_elapsed_time';
  const basicSelect =
    'id, chain_id, started_at, duration, is_paused, paused_at, total_paused_time';

  if (!hasMissingForwardTimerFields(ctx)) {
    const { data, error } = await client
      .from(TABLE)
      .select(fullSelect)
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(1);
    if (!error && data?.length) {
      markCapabilitiesAvailable(ctx, TABLE, FORWARD_TIMER_CAPABILITIES);
      return mapActiveSessionRow(data[0] as ActiveSessionRow);
    }
    if (!error || !isMissingForwardTimerFieldError(error)) return null;
    markCapabilitiesMissing(ctx, TABLE, FORWARD_TIMER_CAPABILITIES);
  }

  const { data, error } = await client
    .from(TABLE)
    .select(basicSelect)
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(1);
  return error || !data?.length
    ? null
    : mapActiveSessionRow(data[0] as ActiveSessionRow);
}

export async function saveActiveSession(
  ctx: SupabaseStorageContext,
  session: ActiveSession | null,
): Promise<void> {
  const user = await ctx.getCurrentUser();
  if (!user)
    throw new Error('Authentication required to save an active session.');
  const client = ctx.getClient();
  if (!session) {
    const { error } = await client.from(TABLE).delete().eq('user_id', user.id);
    if (error) {
      throw new Error(
        formatSupabaseError(error, 'Failed to clear active session'),
      );
    }
    return;
  }

  const basicPayload = buildBasicPayload(session, user.id);
  const includeForwardFields =
    session.isForwardTimer === true ||
    (typeof session.forwardElapsedTime === 'number' &&
      session.forwardElapsedTime > 0);
  const skipForwardFields =
    includeForwardFields && hasMissingForwardTimerFields(ctx);
  const payload =
    includeForwardFields && !skipForwardFields
      ? {
          ...basicPayload,
          is_forward_timer: session.isForwardTimer ?? false,
          forward_elapsed_time: session.forwardElapsedTime ?? 0,
        }
      : basicPayload;
  const { error } = await client
    .from(TABLE)
    .upsert(payload, { onConflict: 'id' });
  if (!error) {
    if (includeForwardFields && !skipForwardFields) {
      markCapabilitiesAvailable(ctx, TABLE, FORWARD_TIMER_CAPABILITIES);
    }
    return;
  }

  if (
    shouldFallbackToBasicPayload({
      error,
      includeForwardFields,
      skipForwardFields,
    })
  ) {
    markCapabilitiesMissing(ctx, TABLE, FORWARD_TIMER_CAPABILITIES);
    const { error: fallbackError } = await client
      .from(TABLE)
      .upsert(basicPayload, { onConflict: 'id' });
    if (!fallbackError) return;
    throw new Error(
      formatSupabaseError(fallbackError, 'Failed to persist active session'),
    );
  }
  throw new Error(
    formatSupabaseError(error, 'Failed to persist active session'),
  );
}
