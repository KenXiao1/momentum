import type { CompletionHistory } from '../../../types';
import type { Database } from '../../../lib/database.types';
import {
  decodeCompletionHistory,
  type SerializedCompletionHistory,
} from '../../../serialization';

type CompletionHistoryRow =
  Database['public']['Tables']['completion_history']['Row'];
type CompletionHistoryInsert =
  Database['public']['Tables']['completion_history']['Insert'];

export type CompletionHistorySelectRow = Pick<
  CompletionHistoryRow,
  | 'chain_id'
  | 'completed_at'
  | 'duration'
  | 'was_successful'
  | 'reason_for_failure'
  | 'actual_duration'
  | 'is_forward_timed'
  | 'description'
  | 'notes'
>;

type CompletionHistoryBasicRow = Pick<
  CompletionHistoryRow,
  | 'chain_id'
  | 'completed_at'
  | 'duration'
  | 'was_successful'
  | 'reason_for_failure'
  | 'description'
  | 'notes'
>;

function toSerializedCompletionHistory(
  row: CompletionHistorySelectRow | CompletionHistoryBasicRow,
): SerializedCompletionHistory {
  return {
    chainId: row.chain_id,
    completedAt: row.completed_at,
    duration: row.duration,
    wasSuccessful: row.was_successful,
    reasonForFailure: row.reason_for_failure,
    actualDuration:
      'actual_duration' in row ? (row.actual_duration ?? undefined) : undefined,
    isForwardTimed:
      'is_forward_timed' in row
        ? (row.is_forward_timed ?? undefined)
        : undefined,
    description: row.description,
    notes: row.notes,
  };
}

export function mapCompletionHistoryRow(
  row: CompletionHistorySelectRow,
): CompletionHistory {
  return decodeCompletionHistory(toSerializedCompletionHistory(row));
}

export function buildCompletionHistoryRowsWithNewFields(
  userId: string,
  items: CompletionHistory[],
): (CompletionHistoryInsert & { completed_at: string })[] {
  return items.map((history) => ({
    chain_id: history.chainId,
    completed_at: history.completedAt.toISOString(),
    duration: history.duration,
    was_successful: history.wasSuccessful,
    reason_for_failure: history.reasonForFailure ?? null,
    actual_duration: history.actualDuration ?? history.duration,
    is_forward_timed: history.isForwardTimed ?? false,
    description: history.description ?? null,
    notes: history.notes ?? null,
    user_id: userId,
  }));
}

export function buildCompletionHistoryRowsBasic(
  userId: string,
  items: CompletionHistory[],
): (CompletionHistoryInsert & { completed_at: string })[] {
  return items.map((history) => ({
    chain_id: history.chainId,
    completed_at: history.completedAt.toISOString(),
    duration: history.duration,
    was_successful: history.wasSuccessful,
    reason_for_failure: history.reasonForFailure ?? null,
    description: history.description ?? null,
    notes: history.notes ?? null,
    user_id: userId,
  }));
}
