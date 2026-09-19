import { z } from 'zod';
import type {
  RSIPLibraryEntry,
  RSIPMeta,
  RSIPNode,
  RSIPRunRecord,
} from '../../../types';
import type { RsipStore } from '../../../storage/ports';
import { rsipMetaRowSchema, rsipNodeRowSchema } from './rsipRowSchema';
import { mapRSIPMetaRow, mapRSIPNodeRow } from './rsipMapper';
import { buildRSIPNodeRows } from './rsipPayloadBuilder';
import type { SupabaseStorageContext } from './types';
import {
  isSchemaMissing,
  RSIP_NODES_TABLE,
  type SupabaseLikeError,
} from './rsipNodeCapabilities';

const creationResultSchema = z.object({
  nodes: z.array(rsipNodeRowSchema),
  meta: rsipMetaRowSchema,
});

export async function createRSIPNodesWithMeta(
  ctx: SupabaseStorageContext,
  nodes: RSIPNode[],
  meta: RSIPMeta,
): ReturnType<RsipStore['createRSIPNodesWithMeta']> {
  const user = await ctx.getCurrentUser();
  if (!user) throw new Error('Authentication required to create RSIP nodes');

  const { data, error } = await ctx
    .getClient()
    .rpc('create_rsip_nodes_with_meta', {
      // IDs belong to the submitted draft and survive an ambiguous response/retry.
      p_intent_key: nodes
        .map((node) => node.id)
        .sort()
        .join(','),
      p_nodes: buildRSIPNodeRows(nodes, user.id),
      p_meta: {
        last_added_at: meta.lastAddedAt?.toISOString() ?? null,
        allow_multiple_per_day: !!meta.allowMultiplePerDay,
        last_tree_opened_at: meta.lastTreeOpenedAt?.toISOString() ?? null,
        daily_tree_open_required: meta.dailyTreeOpenRequired ?? false,
        tree_open_streak: meta.treeOpenStreak ?? 0,
        current_run_number: meta.currentRunNumber ?? null,
        current_run_started_at: meta.currentRunStartedAt?.toISOString() ?? null,
      },
    });
  if (error) {
    throw new Error(
      `Failed to create RSIP nodes atomically (requires the atomic RSIP migration): ${error.message}`,
    );
  }
  const persisted = creationResultSchema.parse(data);
  return {
    nodes: persisted.nodes.map(mapRSIPNodeRow),
    meta: mapRSIPMetaRow(persisted.meta),
  };
}

type UpsertClient = {
  from: (tableName: string) => {
    upsert: (
      payload: Record<string, unknown> | Record<string, unknown>[],
      options?: { onConflict?: string },
    ) => Promise<{ error: SupabaseLikeError | null }>;
    delete: () => {
      in: (
        column: string,
        values: string[],
      ) => {
        eq: (
          column: string,
          value: string,
        ) => Promise<{ error: SupabaseLikeError | null }>;
      };
    };
    insert: (
      payload: Record<string, unknown>,
    ) => Promise<{ error: SupabaseLikeError | null }>;
  };
};

export async function upsertRSIPNode(
  ctx: SupabaseStorageContext,
  node: RSIPNode,
): Promise<void> {
  const user = await ctx.getCurrentUser();
  if (!user) {
    return;
  }

  const client = ctx.getClient() as unknown as UpsertClient;
  const row = buildRSIPNodeRows([node], user.id)[0];

  const { error } = await client
    .from(RSIP_NODES_TABLE)
    .upsert(row, { onConflict: 'id' });
  if (error) {
    throw new Error(`Failed to upsert RSIP node: ${error.message}`);
  }
}

export async function removeRSIPNodes(
  ctx: SupabaseStorageContext,
  nodeIds: string[],
): Promise<void> {
  if (nodeIds.length === 0) {
    return;
  }

  const user = await ctx.getCurrentUser();
  if (!user) {
    return;
  }

  const client = ctx.getClient() as unknown as UpsertClient;
  const { error } = await client
    .from(RSIP_NODES_TABLE)
    .delete()
    .in('id', nodeIds)
    .eq('user_id', user.id);

  if (error) {
    if (isSchemaMissing(error)) {
      return;
    }
    throw new Error(`Failed to remove RSIP nodes: ${error.message}`);
  }
}

export async function upsertRSIPLibraryEntry(
  ctx: SupabaseStorageContext,
  entry: RSIPLibraryEntry,
): Promise<void> {
  const user = await ctx.getCurrentUser();
  if (!user) {
    return;
  }

  const client = ctx.getClient() as unknown as UpsertClient;
  const { error } = await client.from('rsip_policy_library').upsert(
    {
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
    },
    { onConflict: 'user_id,id' },
  );

  if (error) {
    if (isSchemaMissing(error)) {
      return;
    }
    throw new Error(`Failed to upsert RSIP library entry: ${error.message}`);
  }
}

export async function appendRSIPRunRecord(
  ctx: SupabaseStorageContext,
  record: RSIPRunRecord,
): Promise<void> {
  const user = await ctx.getCurrentUser();
  if (!user) {
    return;
  }

  const client = ctx.getClient() as unknown as UpsertClient;
  const { error } = await client.from('rsip_run_history').insert({
    user_id: user.id,
    run_number: record.runNumber,
    started_at: record.startedAt.toISOString(),
    ended_at: record.endedAt?.toISOString() ?? null,
    max_node_count: record.maxNodeCount,
    duration_days: record.durationDays,
    collapse_reason: record.collapseReason ?? null,
    collapse_node_title: record.collapseNodeTitle ?? null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    if (isSchemaMissing(error)) {
      return;
    }
    throw new Error(
      `Failed to append rsip run history record: ${error.message}`,
    );
  }
}
