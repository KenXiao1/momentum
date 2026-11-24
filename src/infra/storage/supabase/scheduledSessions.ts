import type { ScheduledSession } from '../../../types';
import type { Database } from '../../../lib/database.types';
import type { SupabaseStorageContext } from './types';
import { mapScheduledSessionRow } from './sessionMapper';

type ScheduledSessionInsert =
  Database['public']['Tables']['scheduled_sessions']['Insert'];

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

function toInsert(
  session: ScheduledSession,
  userId: string,
): ScheduledSessionInsert {
  return {
    chain_id: session.chainId,
    scheduled_at: session.scheduledAt.toISOString(),
    expires_at: session.expiresAt.toISOString(),
    auxiliary_signal: session.auxiliarySignal,
    user_id: userId,
  };
}

export async function getScheduledSessions(
  ctx: SupabaseStorageContext,
): Promise<ScheduledSession[]> {
  const user = await ctx.getCurrentUser();
  if (!user) return [];
  const { data, error } = await ctx
    .getClient()
    .from('scheduled_sessions')
    .select('chain_id, scheduled_at, expires_at, auxiliary_signal')
    .eq('user_id', user.id)
    .order('scheduled_at', { ascending: false });
  // A failed read must not look like "nothing scheduled": app state would
  // silently lose the pending schedules and their expiry checks.
  if (error) {
    throw new Error(`Failed to fetch scheduled sessions: ${error.message}`);
  }
  return data.map(mapScheduledSessionRow);
}

export async function saveScheduledSessions(
  ctx: SupabaseStorageContext,
  sessions: ScheduledSession[],
): Promise<void> {
  const user = await ctx.getCurrentUser();
  if (!user) return;
  const client = ctx.getClient();
  if (sessions.length === 0) {
    await client.from('scheduled_sessions').delete().eq('user_id', user.id);
    return;
  }

  const { data: existingRows } = await client
    .from('scheduled_sessions')
    .select('chain_id')
    .eq('user_id', user.id);
  const desiredIds = new Set(sessions.map((session) => session.chainId));
  const idsToDelete = (existingRows ?? [])
    .map((row: { chain_id: string }) => row.chain_id)
    .filter((chainId) => !desiredIds.has(chainId));
  if (idsToDelete.length > 0) {
    await client
      .from('scheduled_sessions')
      .delete()
      .eq('user_id', user.id)
      .in('chain_id', idsToDelete);
  }

  const payload = sessions.map((session) => toInsert(session, user.id));
  const { error } = await client
    .from('scheduled_sessions')
    .upsert(payload, { onConflict: 'user_id,chain_id' });
  if (error && isMissingUniqueConstraint(error)) {
    await client.from('scheduled_sessions').delete().eq('user_id', user.id);
    await client.from('scheduled_sessions').insert(payload);
  }
}

export async function setScheduledSession(
  ctx: SupabaseStorageContext,
  session: ScheduledSession,
): Promise<void> {
  const user = await ctx.getCurrentUser();
  if (!user) return;
  const client = ctx.getClient();
  const payload = [toInsert(session, user.id)];
  const { error } = await client
    .from('scheduled_sessions')
    .upsert(payload, { onConflict: 'user_id,chain_id' });
  if (!error || !isMissingUniqueConstraint(error)) return;
  await client
    .from('scheduled_sessions')
    .delete()
    .eq('user_id', user.id)
    .eq('chain_id', session.chainId);
  await client.from('scheduled_sessions').insert(payload);
}

export async function removeScheduledSession(
  ctx: SupabaseStorageContext,
  chainId: string,
): Promise<void> {
  const user = await ctx.getCurrentUser();
  if (!user) return;
  await ctx
    .getClient()
    .from('scheduled_sessions')
    .delete()
    .eq('user_id', user.id)
    .eq('chain_id', chainId);
}
