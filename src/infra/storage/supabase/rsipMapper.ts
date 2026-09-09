import type {
  RSIPExecutionRecord,
  RSIPLibraryEntry,
  RSIPMeta,
  RSIPNode,
  RSIPNodeGroup,
  RSIPRunRecord,
  RSIPTaskLink,
} from '../../../types';
import type { Database } from '../../../lib/database.types';
import {
  decodeRSIPExecutionRecord,
  decodeRSIPLibraryEntry,
  decodeRSIPMeta,
  decodeRSIPNode,
  decodeRSIPNodeGroup,
  decodeRSIPRunRecord,
  decodeRSIPTaskLink,
} from '../../../serialization';

type RSIPNodeRow = Database['public']['Tables']['rsip_nodes']['Row'];
type RSIPMetaRow = Database['public']['Tables']['rsip_meta']['Row'];

export function mapRSIPNodeRow(row: RSIPNodeRow): RSIPNode {
  return decodeRSIPNode({
    id: row.id,
    parentId: row.parent_id || undefined,
    title: row.title,
    rule: row.rule,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    useTimer: row.use_timer ?? false,
    timerMinutes: row.timer_minutes ?? undefined,
    emoji: row.emoji ?? undefined,
    type: row.type ?? undefined,
    groupId: row.group_id ?? undefined,
    reinforcementLevel: row.reinforcement_level ?? undefined,
    maxReinforcementLevel: row.max_reinforcement_level ?? undefined,
    cumulativeExecutionDays: row.cumulative_execution_days ?? undefined,
    isPassive: row.is_passive ?? undefined,
    splitFromGoal: row.split_from_goal ?? undefined,
    stabilityPhase: row.stability_phase ?? 'E0',
    phaseStartedAt: row.phase_started_at,
    lastExecutedAt: row.last_executed_at,
    lastViolatedAt: row.last_violated_at,
    consecutiveExecutions: row.consecutive_executions ?? 0,
    consecutiveViolations: row.consecutive_violations ?? 0,
    totalExecutions: row.total_executions ?? 0,
    totalViolations: row.total_violations ?? 0,
  });
}

export function mapRSIPMetaRow(row: RSIPMetaRow): RSIPMeta {
  return decodeRSIPMeta({
    lastAddedAt: row.last_added_at,
    allowMultiplePerDay: row.allow_multiple_per_day,
    lastTreeOpenedAt: row.last_tree_opened_at,
    dailyTreeOpenRequired: row.daily_tree_open_required ?? false,
    treeOpenStreak: row.tree_open_streak ?? 0,
    currentRunNumber: row.current_run_number ?? undefined,
    currentRunStartedAt: row.current_run_started_at,
  });
}

export function mapRSIPGroupRow(row: Record<string, unknown>): RSIPNodeGroup {
  return decodeRSIPNodeGroup({
    id: String(row.id),
    title: String(row.title ?? ''),
    faultTolerance: Number(row.fault_tolerance ?? 0),
    faultToleranceUsed: row.fault_tolerance_used,
    emoji: row.emoji,
    createdAt: row.created_at,
  });
}

export function mapRSIPLibraryEntryRow(
  row: Record<string, unknown>,
): RSIPLibraryEntry {
  return decodeRSIPLibraryEntry({
    id: String(row.id),
    title: String(row.title ?? ''),
    rule: String(row.rule ?? ''),
    type: row.type,
    emoji: row.emoji,
    cumulativeExecutionDays: Number(row.cumulative_execution_days ?? 0),
    internalizationProgress: Number(row.internalization_progress ?? 0),
    lastActiveAt: row.last_active_at,
    timesUsed: Number(row.times_used ?? 0),
    useTimer: Boolean(row.use_timer ?? false),
    timerMinutes:
      row.timer_minutes == null ? undefined : Number(row.timer_minutes),
    isPassive: Boolean(row.is_passive ?? false),
  });
}

export function mapRSIPRunRecordRow(
  row: Record<string, unknown>,
): RSIPRunRecord {
  return decodeRSIPRunRecord({
    runNumber: Number(row.run_number ?? 0),
    startedAt: row.started_at,
    endedAt: row.ended_at,
    maxNodeCount: Number(row.max_node_count ?? 0),
    durationDays: Number(row.duration_days ?? 0),
    collapseReason: row.collapse_reason,
    collapseNodeTitle: row.collapse_node_title,
  });
}

export function mapRSIPTaskLinkRow(
  row: Record<string, unknown>,
  userId: string,
): RSIPTaskLink {
  return decodeRSIPTaskLink({
    id: String(row.id),
    userId,
    rsipNodeId: String(row.rsip_node_id),
    chainId: String(row.chain_id),
    chainKind: (row.chain_kind as RSIPTaskLink['chainKind']) ?? 'unit',
    triggerEvent: row.trigger_event as RSIPTaskLink['triggerEvent'],
    effect: row.effect as RSIPTaskLink['effect'],
    automation: (row.automation as RSIPTaskLink['automation']) ?? 'confirm',
    isActive: Boolean(row.is_active ?? true),
    updatedAt: row.updated_at,
  });
}

export function mapRSIPExecutionRecordRow(
  row: Record<string, unknown>,
  userId: string,
): RSIPExecutionRecord {
  return decodeRSIPExecutionRecord({
    id: String(row.id),
    userId,
    nodeId: String(row.node_id),
    executedAt: row.executed_at,
    status: (row.status as RSIPExecutionRecord['status']) ?? 'pending',
    notes: row.notes,
    reasonCode: row.reason_code,
    repairHint: row.repair_hint,
    sourceChainId: row.source_chain_id,
    sourceEvent: row.source_event,
  });
}
