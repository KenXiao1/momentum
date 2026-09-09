import type {
  RSIPLibraryEntry,
  RSIPNodeGroup,
  RSIPRunRecord,
  RSIPTaskLink,
} from '../../../types';
import {
  mapRSIPGroupRow,
  mapRSIPLibraryEntryRow,
  mapRSIPRunRecordRow,
  mapRSIPTaskLinkRow,
} from './rsipMapper';
import { getUserScopedOrderedRows, replaceUserScopedRows } from './rsipShared';
import type { SupabaseStorageContext } from './types';

export async function getRSIPGroups(
  ctx: SupabaseStorageContext,
): Promise<RSIPNodeGroup[]> {
  const { rows } = await getUserScopedOrderedRows(ctx, {
    table: 'rsip_groups',
    orderBy: 'created_at',
    ascending: true,
    errorLabel: 'rsip groups',
  });
  return rows.map(mapRSIPGroupRow);
}

export async function saveRSIPGroups(
  ctx: SupabaseStorageContext,
  groups: RSIPNodeGroup[],
): Promise<void> {
  const user = await ctx.getCurrentUser();
  if (!user) return;
  const client = ctx.getClient();
  if (groups.length > 0) {
    const { error } = await client.from('rsip_groups').upsert(
      groups.map((group) => ({
        id: group.id,
        user_id: user.id,
        title: group.title,
        fault_tolerance: group.faultTolerance,
        fault_tolerance_used: group.faultToleranceUsed ?? 0,
        emoji: group.emoji ?? null,
        created_at: group.createdAt.toISOString(),
      })),
    );
    if (error) throw new Error(`Failed to save rsip groups: ${error.message}`);
  }
  const existing = await getRSIPGroups(ctx);
  const retainedIds = new Set(groups.map((group) => group.id));
  const removedIds = existing
    .filter((group) => !retainedIds.has(group.id))
    .map((group) => group.id);
  if (removedIds.length > 0) {
    const { error } = await client
      .from('rsip_groups')
      .delete()
      .eq('user_id', user.id)
      .in('id', removedIds);
    if (error)
      throw new Error(`Failed to remove rsip groups: ${error.message}`);
  }
}

export async function getRSIPPolicyLibrary(
  ctx: SupabaseStorageContext,
): Promise<RSIPLibraryEntry[]> {
  const { rows } = await getUserScopedOrderedRows(ctx, {
    table: 'rsip_policy_library',
    orderBy: 'updated_at',
    ascending: false,
    errorLabel: 'rsip policy library',
  });
  return rows.map(mapRSIPLibraryEntryRow);
}

export async function saveRSIPPolicyLibrary(
  ctx: SupabaseStorageContext,
  entries: RSIPLibraryEntry[],
): Promise<void> {
  const user = await ctx.getCurrentUser();
  if (!user) return;
  await replaceUserScopedRows(
    ctx,
    'rsip_policy_library',
    entries.map((entry) => ({
      id: entry.id,
      user_id: user.id,
      title: entry.title,
      rule: entry.rule,
      type: entry.type ?? null,
      emoji: entry.emoji ?? null,
      cumulative_execution_days: entry.cumulativeExecutionDays,
      internalization_progress: entry.internalizationProgress,
      last_active_at: entry.lastActiveAt.toISOString(),
      times_used: entry.timesUsed,
      use_timer: entry.useTimer ?? false,
      timer_minutes: entry.timerMinutes ?? null,
      is_passive: entry.isPassive ?? false,
      updated_at: new Date().toISOString(),
    })),
  );
}

export async function getRSIPRunHistory(
  ctx: SupabaseStorageContext,
): Promise<RSIPRunRecord[]> {
  const { rows } = await getUserScopedOrderedRows(ctx, {
    table: 'rsip_run_history',
    orderBy: 'run_number',
    ascending: false,
    errorLabel: 'rsip run history',
  });
  return rows.map(mapRSIPRunRecordRow);
}

export async function saveRSIPRunHistory(
  ctx: SupabaseStorageContext,
  records: RSIPRunRecord[],
): Promise<void> {
  const user = await ctx.getCurrentUser();
  if (!user) return;
  await replaceUserScopedRows(
    ctx,
    'rsip_run_history',
    records.map((record) => ({
      user_id: user.id,
      run_number: record.runNumber,
      started_at: record.startedAt.toISOString(),
      ended_at: record.endedAt?.toISOString() ?? null,
      max_node_count: record.maxNodeCount,
      duration_days: record.durationDays,
      collapse_reason: record.collapseReason ?? null,
      collapse_node_title: record.collapseNodeTitle ?? null,
      updated_at: new Date().toISOString(),
    })),
  );
}

export async function getRSIPTaskLinks(
  ctx: SupabaseStorageContext,
): Promise<RSIPTaskLink[]> {
  const { userId, rows } = await getUserScopedOrderedRows(ctx, {
    table: 'rsip_task_links',
    orderBy: 'updated_at',
    ascending: false,
    errorLabel: 'rsip task links',
  });
  if (!userId) return [];
  return rows.map((row) => mapRSIPTaskLinkRow(row, userId));
}

export async function saveRSIPTaskLinks(
  ctx: SupabaseStorageContext,
  links: RSIPTaskLink[],
): Promise<void> {
  const user = await ctx.getCurrentUser();
  if (!user) return;
  await replaceUserScopedRows(
    ctx,
    'rsip_task_links',
    links.map((link) => ({
      id: link.id,
      user_id: user.id,
      rsip_node_id: link.rsipNodeId,
      chain_id: link.chainId,
      chain_kind: link.chainKind,
      trigger_event: link.triggerEvent,
      effect: link.effect,
      automation: link.automation,
      is_active: link.isActive,
      updated_at: link.updatedAt.toISOString(),
    })),
  );
}
