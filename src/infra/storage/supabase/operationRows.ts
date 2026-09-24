import type { ImportData } from '../../../storage/operations';
import { buildChainRow } from './chainMapper';
import { buildCompletionHistoryRowsWithNewFields } from './historyMapper';
import { buildRSIPNodeRows } from './rsipPayloadBuilder';

export type OperationRow = Record<string, unknown>;

/** Each mapping uses database names; user IDs from backups never authorize writes. */
export function buildImportRows(
  data: ImportData,
  userId: string,
): Record<string, OperationRow[]> {
  const result: Record<string, OperationRow[]> = {};
  if (data.chains.length)
    result.chains = data.chains.map((chain) =>
      buildChainRow(chain, userId, true),
    );
  if (data.history?.length)
    result.completion_history = buildCompletionHistoryRowsWithNewFields(
      userId,
      data.history,
    ).map((row) => ({ ...row, id: crypto.randomUUID() }));
  if (data.rsipNodes?.length)
    result.rsip_nodes = buildRSIPNodeRows(data.rsipNodes, userId);
  if (data.rsipGroups?.length)
    result.rsip_groups = data.rsipGroups.map((group) => ({
      id: group.id,
      user_id: userId,
      title: group.title,
      fault_tolerance: group.faultTolerance,
      fault_tolerance_used: group.faultToleranceUsed ?? 0,
      emoji: group.emoji ?? null,
      created_at: group.createdAt.toISOString(),
    }));
  if (data.rsipPolicyLibrary?.length)
    result.rsip_policy_library = data.rsipPolicyLibrary.map((entry) => ({
      id: entry.id,
      user_id: userId,
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
    }));
  if (data.rsipRunHistory?.length)
    result.rsip_run_history = data.rsipRunHistory.map((record) => ({
      user_id: userId,
      run_number: record.runNumber,
      started_at: record.startedAt.toISOString(),
      ended_at: record.endedAt?.toISOString() ?? null,
      max_node_count: record.maxNodeCount,
      duration_days: record.durationDays,
      collapse_reason: record.collapseReason ?? null,
      collapse_node_title: record.collapseNodeTitle ?? null,
    }));
  if (data.rsipTaskLinks?.length)
    result.rsip_task_links = data.rsipTaskLinks.map((link) => ({
      id: link.id,
      user_id: userId,
      rsip_node_id: link.rsipNodeId,
      chain_id: link.chainId,
      chain_kind: link.chainKind,
      trigger_event: link.triggerEvent,
      effect: link.effect,
      automation: link.automation,
      is_active: link.isActive,
      updated_at: link.updatedAt.toISOString(),
    }));
  if (data.rsipExecutionRecords?.length)
    result.rsip_execution_records = data.rsipExecutionRecords.map((record) => ({
      id: record.id,
      user_id: userId,
      node_id: record.nodeId,
      executed_at: record.executedAt.toISOString(),
      status: record.status,
      notes: record.notes ?? null,
      reason_code: record.reasonCode ?? null,
      repair_hint: record.repairHint ?? null,
      source_chain_id: record.sourceChainId ?? null,
      source_event: record.sourceEvent ?? null,
    }));
  if (data.rsipMeta) {
    const meta = data.rsipMeta;
    // Omitted metadata fields retain the current database values.
    const row: OperationRow = { user_id: userId };
    const columns = {
      lastAddedAt: 'last_added_at',
      allowMultiplePerDay: 'allow_multiple_per_day',
      lastTreeOpenedAt: 'last_tree_opened_at',
      dailyTreeOpenRequired: 'daily_tree_open_required',
      treeOpenStreak: 'tree_open_streak',
      currentRunNumber: 'current_run_number',
      currentRunStartedAt: 'current_run_started_at',
    } as const;
    for (const [field, column] of Object.entries(columns)) {
      const value = meta[field as keyof typeof columns];
      if (value !== undefined)
        row[column] = value instanceof Date ? value.toISOString() : value;
    }
    result.rsip_meta = [row];
  }
  return result;
}

export function rowIdentity(table: string, row: OperationRow): string {
  if (table === 'rsip_meta') return String(row.user_id);
  if (table === 'rsip_run_history') return String(row.run_number);
  return String(row.id);
}
