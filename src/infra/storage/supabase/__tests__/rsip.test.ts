import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getRSIPNodes,
  saveRSIPNodes,
  getRSIPMeta,
  saveRSIPMeta,
  getRSIPGroups,
  saveRSIPGroups,
  saveRSIPPolicyLibrary,
  saveRSIPRunHistory,
  saveRSIPTaskLinks,
  getRSIPExecutionRecords,
} from '../rsip';
import {
  createMockContext,
  createMockQueryBuilder,
  createSupabaseError,
} from './testHelpers';
import type { RSIPNode, RSIPMeta } from '../../../../types';

vi.mock('../../../../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    dbOperation: vi.fn(),
  },
}));

const createMockRSIPNodeRow = (
  overrides: Partial<Record<string, unknown>> = {},
) => ({
  id: 'rsip-1',
  parent_id: null,
  title: 'Morning Routine',
  rule: 'Wake up at 6am every day',
  sort_order: 1,
  created_at: '2024-01-01T00:00:00Z',
  use_timer: true,
  timer_minutes: 30,
  user_id: 'test-user-123',
  ...overrides,
});

const createMockRSIPMetaRow = (
  overrides: Partial<Record<string, unknown>> = {},
) => ({
  user_id: 'test-user-123',
  last_added_at: '2024-01-15T10:00:00Z',
  allow_multiple_per_day: false,
  ...overrides,
});

describe('rsip.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRSIPNodes', () => {
    it('should return empty array when user is not authenticated', async () => {
      const ctx = createMockContext({ user: null });

      const result = await getRSIPNodes(ctx);

      expect(result).toEqual([]);
    });

    it('rejects failed reads instead of representing an empty persisted collection', async () => {
      const ctx = createMockContext({
        queryBuilder: createMockQueryBuilder({
          data: null,
          error: createSupabaseError('UNKNOWN', 'Database error'),
        }),
      });
      await expect(getRSIPNodes(ctx)).rejects.toThrow(
        'Cannot prepare rsip_nodes',
      );
      expect(ctx.mockClient.rpc).not.toHaveBeenCalled();
    });

    it('rejects malformed node rows instead of returning an empty tree', async () => {
      const ctx = createMockContext({
        queryBuilder: createMockQueryBuilder({
          data: [createMockRSIPNodeRow({ id: 1 })],
          error: null,
        }),
      });
      await expect(getRSIPNodes(ctx)).rejects.toThrow('Expected string');
    });

    it('should return mapped RSIP nodes on success', async () => {
      const mockData = [createMockRSIPNodeRow()];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPNodes(ctx);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('rsip-1');
      expect(result[0].title).toBe('Morning Routine');
      expect(result[0].rule).toBe('Wake up at 6am every day');
      expect(result[0].sortOrder).toBe(1);
      expect(result[0].useTimer).toBe(true);
      expect(result[0].timerMinutes).toBe(30);
      expect(result[0].createdAt).toBeInstanceOf(Date);
    });

    it('should handle nodes with parent relationships', async () => {
      const mockData = [
        createMockRSIPNodeRow({ id: 'parent', parent_id: null }),
        createMockRSIPNodeRow({ id: 'child', parent_id: 'parent' }),
      ];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPNodes(ctx);

      expect(result).toHaveLength(2);
      expect(result[0].parentId).toBeUndefined();
      expect(result[1].parentId).toBe('parent');
    });

    it('should handle nodes without timer settings', async () => {
      const mockData = [
        createMockRSIPNodeRow({
          use_timer: null,
          timer_minutes: null,
        }),
      ];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPNodes(ctx);

      expect(result[0].useTimer).toBe(false);
      expect(result[0].timerMinutes).toBeUndefined();
    });

    it('should handle empty parent_id string as undefined', async () => {
      const mockData = [createMockRSIPNodeRow({ parent_id: '' })];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPNodes(ctx);

      expect(result[0].parentId).toBeUndefined();
    });
  });

  describe('bulk collection writes', () => {
    const nodes: RSIPNode[] = [
      {
        id: 'rsip-1',
        title: 'Morning Routine',
        rule: 'Wake up at 6am',
        sortOrder: 1,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        useTimer: true,
        timerMinutes: 30,
      },
    ];
    function setup(rows: Record<string, unknown>[] = []) {
      const queryBuilder = createMockQueryBuilder({ data: rows, error: null });
      const ctx = createMockContext({ queryBuilder });
      ctx.mockClient.rpc.mockImplementation(
        async (_name, args: { p_operation_id: string }) => ({
          data: { success: true, operation_id: args.p_operation_id },
          error: null,
        }),
      );
      return { ctx, queryBuilder };
    }

    it('rejects unauthenticated saves', async () => {
      const ctx = createMockContext({ user: null });
      await expect(saveRSIPNodes(ctx, nodes)).rejects.toThrow(
        'Authentication required',
      );
      expect(ctx.mockClient.rpc).not.toHaveBeenCalled();
    });

    it('rejects every unauthenticated collection save, including empty replacements', async () => {
      const ctx = createMockContext({ user: null });
      for (const save of [
        saveRSIPGroups,
        saveRSIPPolicyLibrary,
        saveRSIPRunHistory,
        saveRSIPTaskLinks,
      ]) {
        await expect(save(ctx, [])).rejects.toThrow('Authentication required');
      }
      expect(ctx.mockClient.from).not.toHaveBeenCalled();
      expect(ctx.mockClient.rpc).not.toHaveBeenCalled();
    });

    it('replaces nodes in one RPC with full mapped fields and the observed snapshot', async () => {
      const before = [
        createMockRSIPNodeRow(),
        createMockRSIPNodeRow({ id: 'removed' }),
      ];
      const { ctx, queryBuilder } = setup(before);
      await getRSIPNodes(ctx);
      await saveRSIPNodes(ctx, nodes);
      expect(ctx.mockClient.rpc).toHaveBeenCalledWith(
        'commit_storage_operation',
        expect.objectContaining({
          p_changes: [
            {
              table: 'rsip_nodes',
              before,
              after: [
                expect.objectContaining({
                  id: 'rsip-1',
                  title: 'Morning Routine',
                  rule: 'Wake up at 6am',
                  user_id: 'test-user-123',
                  parent_id: null,
                  use_timer: true,
                  timer_minutes: 30,
                  consecutive_executions: 0,
                }),
              ],
            },
          ],
        }),
      );
      expect(queryBuilder.delete).not.toHaveBeenCalled();
      expect(queryBuilder.upsert).not.toHaveBeenCalled();
    });

    it('surfaces missing migrations without destructive fallback', async () => {
      const { ctx, queryBuilder } = setup([createMockRSIPNodeRow()]);
      ctx.mockClient.rpc.mockResolvedValue({
        data: null,
        error: createSupabaseError('PGRST202', 'RPC is missing'),
      });
      await expect(saveRSIPNodes(ctx, [])).rejects.toThrow(
        'Requires the storage operations migration',
      );
      expect(queryBuilder.delete).not.toHaveBeenCalled();
      expect(queryBuilder.upsert).not.toHaveBeenCalled();
    });

    it('does not issue any write after a snapshot read fails', async () => {
      const ctx = createMockContext({
        queryBuilder: createMockQueryBuilder({
          data: null,
          error: createSupabaseError('UNKNOWN', 'read failed'),
        }),
      });
      await expect(saveRSIPNodes(ctx, nodes)).rejects.toThrow(
        'Cannot prepare rsip_nodes',
      );
      expect(ctx.mockClient.rpc).not.toHaveBeenCalled();
    });

    it('surfaces concurrent modification without deleting nodes', async () => {
      const { ctx, queryBuilder } = setup([createMockRSIPNodeRow()]);
      ctx.mockClient.rpc.mockResolvedValue({
        data: null,
        error: createSupabaseError('40001', 'Collection changed'),
      });
      await expect(saveRSIPNodes(ctx, nodes)).rejects.toThrow(
        'Collection changed',
      );
      expect(queryBuilder.delete).not.toHaveBeenCalled();
    });

    it('saves group membership and tolerance in the same collection RPC', async () => {
      const { ctx, queryBuilder } = setup([]);
      await saveRSIPGroups(ctx, [
        {
          id: 'group-1',
          title: 'Group',
          faultTolerance: 2,
          faultToleranceUsed: 1,
          createdAt: nodes[0].createdAt,
        },
      ]);
      expect(ctx.mockClient.rpc).toHaveBeenCalledWith(
        'commit_storage_operation',
        expect.objectContaining({
          p_changes: [
            {
              table: 'rsip_groups',
              before: [],
              after: [
                expect.objectContaining({
                  id: 'group-1',
                  fault_tolerance: 2,
                  fault_tolerance_used: 1,
                  user_id: 'test-user-123',
                }),
              ],
            },
          ],
        }),
      );
      expect(queryBuilder.delete).not.toHaveBeenCalled();
      expect(queryBuilder.upsert).not.toHaveBeenCalled();
    });
  });

  describe('getRSIPMeta', () => {
    it('should return empty object when user is not authenticated', async () => {
      const ctx = createMockContext({ user: null });

      const result = await getRSIPMeta(ctx);

      expect(result).toEqual({});
    });

    it('should return empty object on error', async () => {
      const queryBuilder = createMockQueryBuilder({
        data: null,
        error: createSupabaseError('UNKNOWN', 'Database error'),
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPMeta(ctx);

      expect(result).toEqual({});
    });

    it('should return empty object when no data exists', async () => {
      const queryBuilder = createMockQueryBuilder({ data: [], error: null });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPMeta(ctx);

      expect(result).toEqual({});
    });

    it('should return mapped RSIP meta on success', async () => {
      const mockData = [createMockRSIPMetaRow()];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPMeta(ctx);

      expect(result.lastAddedAt).toBeInstanceOf(Date);
      expect(result.allowMultiplePerDay).toBe(false);
    });

    it('should handle meta with allowMultiplePerDay true', async () => {
      const mockData = [
        createMockRSIPMetaRow({ allow_multiple_per_day: true }),
      ];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPMeta(ctx);

      expect(result.allowMultiplePerDay).toBe(true);
    });

    it('should handle meta with null last_added_at', async () => {
      const mockData = [createMockRSIPMetaRow({ last_added_at: null })];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPMeta(ctx);

      expect(result.lastAddedAt).toBeUndefined();
    });
  });

  describe('saveRSIPMeta', () => {
    it('should return early when user is not authenticated', async () => {
      const ctx = createMockContext({ user: null });
      const meta: RSIPMeta = {
        lastAddedAt: new Date(),
        allowMultiplePerDay: true,
      };

      await saveRSIPMeta(ctx, meta);

      expect(ctx.mockClient.from).not.toHaveBeenCalled();
    });

    it('should upsert meta successfully', async () => {
      const ctx = createMockContext();
      let upsertData: Record<string, unknown> = {};

      ctx.mockClient.from = vi.fn().mockReturnValue({
        upsert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          upsertData = data;
          return { error: null };
        }),
      });

      const meta: RSIPMeta = {
        lastAddedAt: new Date('2024-01-15T10:00:00Z'),
        allowMultiplePerDay: true,
      };

      await saveRSIPMeta(ctx, meta);

      expect(upsertData.user_id).toBe('test-user-123');
      expect(upsertData.last_added_at).toBe('2024-01-15T10:00:00.000Z');
      expect(upsertData.allow_multiple_per_day).toBe(true);
    });

    it('should surface missing migrated meta columns without retrying', async () => {
      const ctx = createMockContext();
      const upsert = vi.fn().mockReturnValue({
        error: createSupabaseError(
          'PGRST204',
          "Could not find the 'last_tree_opened_at' column of 'rsip_meta'",
        ),
      });

      ctx.mockClient.from = vi.fn().mockReturnValue({ upsert });

      const meta: RSIPMeta = {
        lastAddedAt: new Date('2024-01-15T10:00:00Z'),
        allowMultiplePerDay: true,
        lastTreeOpenedAt: new Date('2024-01-15T11:00:00Z'),
        dailyTreeOpenRequired: true,
        treeOpenStreak: 3,
      };

      await expect(saveRSIPMeta(ctx, meta)).rejects.toThrow(
        'Failed to save RSIP meta',
      );
      expect(upsert).toHaveBeenCalledTimes(1);
      expect(upsert.mock.calls[0]?.[0]).toHaveProperty('last_tree_opened_at');
      expect(ctx.markSchemaCapabilityMissing).not.toHaveBeenCalled();
    });

    it('should throw error when upsert fails', async () => {
      const ctx = createMockContext();
      ctx.mockClient.from = vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          error: createSupabaseError('UNKNOWN', 'Upsert failed'),
        }),
      });

      const meta: RSIPMeta = {
        lastAddedAt: new Date(),
        allowMultiplePerDay: true,
      };

      await expect(saveRSIPMeta(ctx, meta)).rejects.toThrow(
        'Failed to save RSIP meta',
      );
    });

    it('should handle empty meta', async () => {
      const ctx = createMockContext();
      let upsertData: Record<string, unknown> = {};

      ctx.mockClient.from = vi.fn().mockReturnValue({
        upsert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          upsertData = data;
          return { error: null };
        }),
      });

      const meta: RSIPMeta = {};

      await saveRSIPMeta(ctx, meta);

      expect(upsertData.last_added_at).toBeNull();
      expect(upsertData.allow_multiple_per_day).toBe(false);
    });

    it('should handle meta with only allowMultiplePerDay', async () => {
      const ctx = createMockContext();
      let upsertData: Record<string, unknown> = {};

      ctx.mockClient.from = vi.fn().mockReturnValue({
        upsert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          upsertData = data;
          return { error: null };
        }),
      });

      const meta: RSIPMeta = {
        allowMultiplePerDay: false,
      };

      await saveRSIPMeta(ctx, meta);

      expect(upsertData.last_added_at).toBeNull();
      expect(upsertData.allow_multiple_per_day).toBe(false);
    });
  });

  describe('getRSIPGroups', () => {
    it('should return mapped groups on success', async () => {
      const queryBuilder = createMockQueryBuilder({
        data: [
          {
            id: 'group-1',
            title: 'Group A',
            fault_tolerance: 2,
            emoji: '🧭',
            created_at: '2024-02-01T00:00:00Z',
          },
        ],
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPGroups(ctx);

      expect(result).toEqual([
        {
          id: 'group-1',
          title: 'Group A',
          faultTolerance: 2,
          emoji: '🧭',
          createdAt: new Date('2024-02-01T00:00:00Z'),
        },
      ]);
    });
  });

  describe('getRSIPExecutionRecords', () => {
    it('should return mapped execution records on success', async () => {
      const queryBuilder = createMockQueryBuilder({
        data: [
          {
            id: 'record-1',
            node_id: 'node-1',
            executed_at: '2024-03-01T09:00:00Z',
            status: 'completed',
            notes: 'done',
            reason_code: 'ok',
            repair_hint: 'none',
            source_chain_id: 'chain-1',
            source_event: 'manual',
          },
        ],
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getRSIPExecutionRecords(ctx);

      expect(result).toEqual([
        {
          id: 'record-1',
          userId: 'test-user-123',
          nodeId: 'node-1',
          executedAt: new Date('2024-03-01T09:00:00Z'),
          status: 'completed',
          notes: 'done',
          reasonCode: 'ok',
          repairHint: 'none',
          sourceChainId: 'chain-1',
          sourceEvent: 'manual',
        },
      ]);
    });
  });
});
