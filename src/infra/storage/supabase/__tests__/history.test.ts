import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  appendCompletionHistory,
  getCompletionHistory,
  saveCompletionHistory,
} from '../history';
import {
  createMockContext,
  createMockQueryBuilder,
  createSupabaseError,
} from './testHelpers';
import type { CompletionHistory } from '../../../../types';

vi.mock('../../../../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    dbOperation: vi.fn(),
  },
}));

const createMockHistoryRow = (
  overrides: Partial<Record<string, unknown>> = {},
) => ({
  id: 'history-1',
  chain_id: 'chain-1',
  completed_at: '2024-01-15T10:00:00Z',
  duration: 30,
  was_successful: true,
  reason_for_failure: null,
  actual_duration: 28,
  is_forward_timed: false,
  description: 'Completed task',
  notes: 'Good progress',
  user_id: 'test-user-123',
  ...overrides,
});

describe('history.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCompletionHistory', () => {
    it('should return empty array when user is not authenticated', async () => {
      const ctx = createMockContext({ user: null });

      const result = await getCompletionHistory(ctx);

      expect(result).toEqual([]);
    });

    it('rejects failed reads instead of representing an empty persisted collection', async () => {
      const ctx = createMockContext({
        queryBuilder: createMockQueryBuilder({
          data: null,
          error: createSupabaseError('UNKNOWN', 'Database error'),
        }),
      });
      await expect(getCompletionHistory(ctx)).rejects.toThrow(
        'Cannot prepare completion_history',
      );
      expect(ctx.mockClient.rpc).not.toHaveBeenCalled();
    });

    it('rejects a missing response snapshot', async () => {
      const ctx = createMockContext({
        queryBuilder: createMockQueryBuilder({ data: null, error: null }),
      });
      await expect(getCompletionHistory(ctx)).rejects.toThrow(
        'Missing completion_history snapshot',
      );
    });

    it('should return mapped completion history on success', async () => {
      const mockData = [createMockHistoryRow()];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getCompletionHistory(ctx);

      expect(result).toHaveLength(1);
      expect(result[0].chainId).toBe('chain-1');
      expect(result[0].duration).toBe(30);
      expect(result[0].wasSuccessful).toBe(true);
      expect(result[0].actualDuration).toBe(28);
      expect(result[0].isForwardTimed).toBe(false);
      expect(result[0].description).toBe('Completed task');
      expect(result[0].notes).toBe('Good progress');
      expect(result[0].completedAt).toBeInstanceOf(Date);
    });

    it('should handle failure records correctly', async () => {
      const mockData = [
        createMockHistoryRow({
          was_successful: false,
          reason_for_failure: 'Got distracted',
        }),
      ];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getCompletionHistory(ctx);

      expect(result[0].wasSuccessful).toBe(false);
      expect(result[0].reasonForFailure).toBe('Got distracted');
    });

    it('should handle forward timed records', async () => {
      const mockData = [
        createMockHistoryRow({
          is_forward_timed: true,
          actual_duration: 45,
        }),
      ];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getCompletionHistory(ctx);

      expect(result[0].isForwardTimed).toBe(true);
      expect(result[0].actualDuration).toBe(45);
    });

    it('should use duration as fallback for actual_duration when null', async () => {
      const mockData = [
        createMockHistoryRow({
          actual_duration: null,
          duration: 30,
        }),
      ];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getCompletionHistory(ctx);

      expect(result[0].actualDuration).toBe(30);
    });

    it('should handle missing optional fields', async () => {
      const mockData = [
        createMockHistoryRow({
          reason_for_failure: null,
          description: null,
          notes: null,
        }),
      ];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getCompletionHistory(ctx);

      expect(result[0].reasonForFailure).toBeUndefined();
      expect(result[0].description).toBeUndefined();
      expect(result[0].notes).toBeUndefined();
    });
  });

  describe('saveCompletionHistory', () => {
    const history: CompletionHistory[] = [
      {
        chainId: 'chain-1',
        completedAt: new Date('2024-01-15T10:00:00Z'),
        duration: 30,
        wasSuccessful: true,
        actualDuration: 28,
        notes: 'updated',
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
    it('rejects unauthenticated replacement', async () => {
      const ctx = createMockContext({ user: null });
      await expect(saveCompletionHistory(ctx, history)).rejects.toThrow(
        'Authentication required',
      );
      expect(ctx.mockClient.rpc).not.toHaveBeenCalled();
    });
    it('preserves existing history IDs and trigger metadata while replacing atomically', async () => {
      const before = [
        createMockHistoryRow({ metadata: { session_id: 'old-session' } }),
        createMockHistoryRow({ id: 'removed', chain_id: 'other' }),
      ];
      const { ctx, queryBuilder } = setup(before);
      await getCompletionHistory(ctx);
      await saveCompletionHistory(ctx, history);
      expect(ctx.mockClient.rpc).toHaveBeenCalledWith(
        'commit_storage_operation',
        expect.objectContaining({
          p_changes: [
            {
              table: 'completion_history',
              before,
              after: [
                expect.objectContaining({
                  id: 'history-1',
                  notes: 'updated',
                  metadata: { session_id: 'old-session' },
                  actual_duration: 28,
                  was_successful: true,
                }),
              ],
            },
          ],
        }),
      );
      expect(queryBuilder.delete).not.toHaveBeenCalled();
      expect(queryBuilder.upsert).not.toHaveBeenCalled();
    });
    it('clears history in a single RPC', async () => {
      const before = [createMockHistoryRow()];
      const { ctx, queryBuilder } = setup(before);
      await saveCompletionHistory(ctx, []);
      expect(ctx.mockClient.rpc).toHaveBeenCalledWith(
        'commit_storage_operation',
        expect.objectContaining({
          p_changes: [{ table: 'completion_history', before, after: [] }],
        }),
      );
      expect(queryBuilder.delete).not.toHaveBeenCalled();
    });
    it('keeps a stable new history identity after a lost response', async () => {
      const { ctx } = setup();
      ctx.mockClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { code: '', message: 'network response lost' },
      });
      await expect(saveCompletionHistory(ctx, history)).rejects.toThrow(
        'Save not confirmed',
      );
      const first = ctx.mockClient.rpc.mock.calls[0];
      await saveCompletionHistory(ctx, history);
      expect(ctx.mockClient.rpc.mock.calls[1]).toEqual(first);
    });
    it('surfaces missing migration errors without any table mutation', async () => {
      const { ctx, queryBuilder } = setup([createMockHistoryRow()]);
      ctx.mockClient.rpc.mockResolvedValue({
        data: null,
        error: createSupabaseError('PGRST202', 'RPC is missing'),
      });
      await expect(saveCompletionHistory(ctx, history)).rejects.toThrow(
        'Requires the storage operations migration',
      );
      expect(queryBuilder.delete).not.toHaveBeenCalled();
      expect(queryBuilder.insert).not.toHaveBeenCalled();
      expect(queryBuilder.upsert).not.toHaveBeenCalled();
    });
  });

  describe('appendCompletionHistory', () => {
    it('should fallback to basic fields when timing columns are missing', async () => {
      const ctx = createMockContext();
      let callCount = 0;
      let secondCallRow: Record<string, unknown> | null = null;
      ctx.mockClient.from = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ data: null, error: null }),
        }),
        upsert: vi.fn().mockImplementation((data: unknown[]) => {
          callCount++;
          if (callCount === 1) {
            return {
              data: null,
              error: createSupabaseError(
                '42703',
                'actual_duration does not exist',
              ),
            };
          }
          secondCallRow = data[0] as Record<string, unknown>;
          return { data: null, error: null };
        }),
      });

      const history: CompletionHistory[] = [
        {
          chainId: 'chain-1',
          completedAt: new Date('2024-01-15T10:00:00.000Z'),
          duration: 30,
          wasSuccessful: true,
          actualDuration: 28,
          isForwardTimed: true,
        },
      ];

      await appendCompletionHistory(ctx, history[0]);

      expect(callCount).toBe(2);
      expect(secondCallRow).not.toBeNull();
      expect('actual_duration' in (secondCallRow || {})).toBe(false);
      expect('is_forward_timed' in (secondCallRow || {})).toBe(false);
    });

    it('should fall back to legacy insert when unique index is missing', async () => {
      const ctx = createMockContext();
      let insertCalled = false;
      const upsert = vi.fn().mockReturnValue({
        data: null,
        error: createSupabaseError(
          '42P10',
          'no unique or exclusion constraint matching',
        ),
      });
      const selectEq = vi.fn().mockReturnValue({ data: [], error: null });
      const insert = vi.fn().mockImplementation(() => {
        insertCalled = true;
        return { data: null, error: null };
      });

      ctx.mockClient.from = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ data: null, error: null }),
        }),
        upsert,
        select: vi.fn().mockReturnValue({ eq: selectEq }),
        insert,
      });

      const history: CompletionHistory[] = [
        {
          chainId: 'chain-1',
          completedAt: new Date('2024-01-15T10:00:00.000Z'),
          duration: 30,
          wasSuccessful: false,
          reasonForFailure: 'Interrupted',
          actualDuration: 15,
          isForwardTimed: true,
          description: 'Task description',
          notes: 'Some notes',
        },
      ];

      await appendCompletionHistory(ctx, history[0]);

      expect(upsert).toHaveBeenCalled();
      expect(selectEq).toHaveBeenCalledWith('user_id', 'test-user-123');
      expect(insertCalled).toBe(true);
    });

    it('should upsert a single completion record', async () => {
      const history: CompletionHistory = {
        chainId: 'chain-1',
        completedAt: new Date('2024-01-15T10:00:00Z'),
        duration: 30,
        wasSuccessful: true,
        actualDuration: 25,
        isForwardTimed: false,
      };
      const upsert = vi.fn().mockReturnValue({ data: null, error: null });
      const ctx = createMockContext();

      ctx.mockClient.from = vi.fn().mockImplementation((table) => {
        if (table !== 'completion_history') return createMockQueryBuilder();
        return {
          upsert,
          select: vi.fn(),
        };
      });

      await appendCompletionHistory(ctx, history);

      expect(upsert).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            chain_id: 'chain-1',
            user_id: 'test-user-123',
            actual_duration: 25,
          }),
        ],
        {
          onConflict: 'user_id,chain_id,completed_at',
          ignoreDuplicates: true,
        },
      );
    });
  });
});
