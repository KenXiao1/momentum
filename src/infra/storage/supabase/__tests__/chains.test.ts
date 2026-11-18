import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getChains,
  getActiveChains,
  getDeletedChains,
  softDeleteChain,
  restoreChain,
  permanentlyDeleteChain,
  cleanupExpiredDeletedChains,
  saveChains,
  upsertChain,
} from '../chains';
import {
  createMockContext,
  createMockQueryBuilder,
  createSupabaseError,
  TEST_USER_ID,
} from './testHelpers';
import type { Chain } from '../../../../types';
import { logger } from '../../../../utils/logger';

vi.mock('../../../../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    dbOperation: vi.fn(),
  },
}));

const createMockChainRow = (
  overrides: Partial<Record<string, unknown>> = {},
) => ({
  id: 'chain-1',
  name: 'Test Chain',
  parent_id: null,
  type: 'unit',
  sort_order: 1,
  trigger: 'Test trigger',
  duration: 30,
  description: 'Test description',
  current_streak: 5,
  auxiliary_streak: 0,
  total_completions: 10,
  total_failures: 2,
  auxiliary_failures: 0,
  exceptions: ['exception1'],
  auxiliary_exceptions: [],
  auxiliary_signal: 'Signal',
  auxiliary_duration: 15,
  auxiliary_completion_trigger: 'Complete',
  is_durationless: false,
  minimum_duration: null,
  task_repeat_count: null,
  time_limit_exceptions: [],
  deleted_at: null,
  created_at: '2024-01-01T00:00:00Z',
  last_completed_at: '2024-01-10T00:00:00Z',
  time_limit_hours: null,
  group_started_at: null,
  group_expires_at: null,
  is_task_group: null,
  group_repeat_count: null,
  ...overrides,
});

const createMockChain = (overrides: Partial<Chain> = {}): Chain =>
  ({
    id: 'chain-1',
    name: 'Test Chain',
    parentId: undefined,
    type: 'unit',
    sortOrder: 1,
    trigger: 'Test trigger',
    duration: 30,
    description: 'Test description',
    currentStreak: 5,
    auxiliaryStreak: 0,
    totalCompletions: 10,
    totalFailures: 2,
    auxiliaryFailures: 0,
    exceptions: ['exception1'],
    auxiliaryExceptions: [],
    auxiliarySignal: 'Signal',
    auxiliaryDuration: 15,
    auxiliaryCompletionTrigger: 'Complete',
    isDurationless: false,
    timeLimitExceptions: [],
    deletedAt: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    lastCompletedAt: new Date('2024-01-10T00:00:00Z'),
    ...overrides,
  }) as Chain;

describe('chains.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getChains', () => {
    it('should return empty array when user is not authenticated', async () => {
      const ctx = createMockContext({ user: null });

      const result = await getChains(ctx);

      expect(result).toEqual([]);
    });

    it('rejects on a query error instead of reporting an empty account', async () => {
      const queryBuilder = createMockQueryBuilder({
        data: null,
        error: createSupabaseError('42P01', 'relation "chains" does not exist'),
      });
      const ctx = createMockContext({ queryBuilder });

      await expect(getChains(ctx)).rejects.toThrow('Failed to fetch chains');
    });

    it('rejects when the fetch itself fails', async () => {
      const ctx = createMockContext();
      ctx.retryOperation = vi
        .fn()
        .mockRejectedValue(new Error('Network error'));

      await expect(getChains(ctx)).rejects.toThrow('Network error');
    });

    it('should map group chains correctly', async () => {
      const mockData = [
        createMockChainRow({
          id: 'group-1',
          type: 'group',
          time_limit_hours: 24,
          group_started_at: '2024-01-01T00:00:00Z',
          group_expires_at: '2024-01-02T00:00:00Z',
          is_task_group: true,
          group_repeat_count: 3,
        }),
      ];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getChains(ctx);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('group');
      expect((result[0] as any).timeLimitHours).toBe(24);
      expect((result[0] as any).isTaskGroup).toBe(true);
    });
  });

  describe('getActiveChains', () => {
    it('should fallback to getChains when deleted_at column is missing', async () => {
      const ctx = createMockContext();
      let callCount = 0;
      ctx.mockClient.from = vi.fn().mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) {
          return createMockQueryBuilder({
            data: null,
            error: createSupabaseError('42703', 'deleted_at does not exist'),
          });
        }
        return createMockQueryBuilder({
          data: [
            createMockChainRow({ id: 'active-1', deleted_at: null }),
            createMockChainRow({
              id: 'deleted-1',
              deleted_at: '2026-01-01T00:00:00Z',
            }),
          ],
          error: null,
        });
      });

      const result = await getActiveChains(ctx);

      expect(result.map((chain) => chain.id)).toEqual(['active-1']);
    });

    it('rejects on a query error instead of reporting no active chains', async () => {
      const queryBuilder = createMockQueryBuilder({
        data: null,
        error: createSupabaseError('42P01', 'relation "chains" does not exist'),
      });
      const ctx = createMockContext({ queryBuilder });

      await expect(getActiveChains(ctx)).rejects.toThrow(
        'Failed to fetch active chains',
      );
    });
  });

  describe('getDeletedChains', () => {
    it('should return only deleted chains sorted by deletedAt descending', async () => {
      const mockData = [
        createMockChainRow({
          id: 'chain-3',
          deleted_at: '2024-01-20T00:00:00Z',
        }),
        createMockChainRow({
          id: 'chain-2',
          deleted_at: '2024-01-15T00:00:00Z',
        }),
      ];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getDeletedChains(ctx);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('chain-3');
      expect(result[1].id).toBe('chain-2');
    });

    it('should return empty array on error', async () => {
      const ctx = createMockContext({ user: null });

      const result = await getDeletedChains(ctx);

      expect(result).toEqual([]);
    });

    it('should fallback to getChains when deleted_at column is missing and keep descending order', async () => {
      const ctx = createMockContext();
      let callCount = 0;
      ctx.mockClient.from = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createMockQueryBuilder({
            data: null,
            error: createSupabaseError('42703', 'deleted_at does not exist'),
          });
        }

        return createMockQueryBuilder({
          data: [
            createMockChainRow({
              id: 'chain-old',
              deleted_at: '2024-01-01T00:00:00Z',
            }),
            createMockChainRow({ id: 'chain-live', deleted_at: null }),
            createMockChainRow({
              id: 'chain-new',
              deleted_at: '2024-02-01T00:00:00Z',
            }),
          ],
          error: null,
        });
      });

      const result = await getDeletedChains(ctx);

      expect(result.map((chain) => chain.id)).toEqual([
        'chain-new',
        'chain-old',
      ]);
    });
  });

  describe('softDeleteChain', () => {
    it('should throw error when user is not authenticated', async () => {
      const ctx = createMockContext({ user: null });

      await expect(softDeleteChain(ctx, 'chain-1')).rejects.toThrow(
        'User not authenticated',
      );
    });

    it('should soft delete chain and its children', async () => {
      const mockData = [
        createMockChainRow({ id: 'parent', parent_id: null }),
        createMockChainRow({ id: 'child', parent_id: 'parent' }),
      ];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      await softDeleteChain(ctx, 'parent');

      expect(ctx.mockClient.from).toHaveBeenCalledWith('chains');
    });

    it('should fallback to permanent delete when soft delete is not supported', async () => {
      const mockData = [createMockChainRow({ id: 'chain-1' })];

      const ctx = createMockContext();
      let callCount = 0;
      ctx.mockClient.from = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createMockQueryBuilder({ data: mockData, error: null });
        }
        if (callCount === 2) {
          const builder = createMockQueryBuilder({
            data: null,
            error: createSupabaseError('42703', 'deleted_at does not exist'),
          });
          return builder;
        }
        if (callCount === 3) {
          return createMockQueryBuilder({ data: mockData, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      });

      await softDeleteChain(ctx, 'chain-1');

      expect(ctx.mockClient.from).toHaveBeenCalled();
    });
  });

  describe('restoreChain', () => {
    it('should throw error when user is not authenticated', async () => {
      const ctx = createMockContext({ user: null });

      await expect(restoreChain(ctx, 'chain-1')).rejects.toThrow(
        'User not authenticated',
      );
    });

    it('should restore chain and its children', async () => {
      const mockData = [
        createMockChainRow({
          id: 'parent',
          deleted_at: '2024-01-15T00:00:00Z',
        }),
        createMockChainRow({
          id: 'child',
          parent_id: 'parent',
          deleted_at: '2024-01-15T00:00:00Z',
        }),
      ];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      await restoreChain(ctx, 'parent');

      expect(ctx.mockClient.from).toHaveBeenCalledWith('chains');
      expect(ctx.clearSchemaCache).toHaveBeenCalled();
    });

    it('should throw error when database does not support soft delete', async () => {
      const mockData = [createMockChainRow({ id: 'chain-1' })];

      const ctx = createMockContext();
      let callCount = 0;
      ctx.mockClient.from = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createMockQueryBuilder({ data: mockData, error: null });
        }
        return createMockQueryBuilder({
          data: null,
          error: createSupabaseError('42703', 'deleted_at does not exist'),
        });
      });
      ctx.retryOperation = vi.fn().mockImplementation((op) => op());

      await expect(restoreChain(ctx, 'chain-1')).rejects.toThrow(
        'Database does not support soft delete',
      );
    });
  });

  describe('permanentlyDeleteChain', () => {
    it('should throw error when user is not authenticated', async () => {
      const ctx = createMockContext({ user: null });

      await expect(permanentlyDeleteChain(ctx, 'chain-1')).rejects.toThrow(
        'User not authenticated',
      );
    });

    it('should permanently delete chain and its children', async () => {
      const mockData = [
        createMockChainRow({ id: 'parent' }),
        createMockChainRow({ id: 'child', parent_id: 'parent' }),
      ];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      await permanentlyDeleteChain(ctx, 'parent');

      expect(ctx.mockClient.from).toHaveBeenCalledWith('chains');
    });

    it('should throw error on delete failure', async () => {
      const mockData = [createMockChainRow({ id: 'chain-1' })];

      const ctx = createMockContext();
      let callCount = 0;
      ctx.mockClient.from = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createMockQueryBuilder({ data: mockData, error: null });
        }
        return createMockQueryBuilder({
          data: null,
          error: createSupabaseError('UNKNOWN', 'Delete failed'),
        });
      });

      await expect(permanentlyDeleteChain(ctx, 'chain-1')).rejects.toThrow(
        'Permanent delete chain failed',
      );
    });
  });

  describe('cleanupExpiredDeletedChains', () => {
    it('should return 0 when user is not authenticated', async () => {
      const ctx = createMockContext({ user: null });

      const result = await cleanupExpiredDeletedChains(ctx, 30);

      expect(result).toBe(0);
    });

    it('should return 0 when no expired chains found', async () => {
      const queryBuilder = createMockQueryBuilder({ data: [], error: null });
      const ctx = createMockContext({ queryBuilder });

      const result = await cleanupExpiredDeletedChains(ctx, 30);

      expect(result).toBe(0);
    });

    it('should return 0 when database does not support soft delete', async () => {
      const ctx = createMockContext();
      ctx.mockClient.from = vi.fn().mockReturnValue(
        createMockQueryBuilder({
          data: null,
          error: createSupabaseError('42703', 'deleted_at does not exist'),
        }),
      );

      const result = await cleanupExpiredDeletedChains(ctx, 30);

      expect(result).toBe(0);
    });
  });

  describe('saveChains', () => {
    it('should throw error when user authentication fails', async () => {
      const ctx = createMockContext({ user: null, isAuthenticated: false });

      await expect(saveChains(ctx, [])).rejects.toThrow(
        'User authentication failed or timed out',
      );
    });

    it('should throw error on duplicate chain ids', async () => {
      const chains = [
        createMockChain({ id: 'dup-id' }),
        createMockChain({ id: 'dup-id' }),
      ];
      const ctx = createMockContext();

      await expect(saveChains(ctx, chains)).rejects.toThrow(
        'Duplicate chain id detected',
      );
    });

    it('should fallback to base columns when new columns are missing', async () => {
      const chains = [createMockChain({ id: 'chain-1' })];
      const ctx = createMockContext();

      let callCount = 0;
      ctx.mockClient.from = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createMockQueryBuilder({ data: [], error: null });
        }
        return createMockQueryBuilder({
          data: [{ id: 'chain-1' }],
          error: null,
        });
      });

      let retryCallCount = 0;
      ctx.retryWithAuth = vi.fn().mockImplementation(async (op) => {
        retryCallCount++;
        if (retryCallCount === 1) {
          throw createSupabaseError(
            'PGRST204',
            "column 'deleted_at' does not exist",
          );
        }
        return op();
      });

      await saveChains(ctx, chains);

      expect(ctx.retryWithAuth).toHaveBeenCalled();
    });

    it('should fallback to base columns for 42703 missing-column errors', async () => {
      const chains = [createMockChain({ id: 'chain-1' })];
      const ctx = createMockContext();

      let callCount = 0;
      ctx.mockClient.from = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createMockQueryBuilder({ data: [], error: null });
        }
        return createMockQueryBuilder({
          data: [{ id: 'chain-1' }],
          error: null,
        });
      });

      let retryCallCount = 0;
      ctx.retryWithAuth = vi.fn().mockImplementation(async (op) => {
        retryCallCount++;
        if (retryCallCount === 1) {
          throw createSupabaseError(
            '42703',
            "column 'group_expires_at' does not exist",
          );
        }
        return op();
      });

      await saveChains(ctx, chains);

      expect(ctx.retryWithAuth).toHaveBeenCalledTimes(2);
    });

    it('should skip strict payload after detecting missing strict columns', async () => {
      const chains = [createMockChain({ id: 'chain-1' })];
      const ctx = createMockContext();

      const upsert = vi
        .fn()
        .mockImplementation((rows: Record<string, unknown>[]) => {
          const row = rows[0] ?? {};
          if (Object.prototype.hasOwnProperty.call(row, 'group_repeat_count')) {
            return {
              data: null,
              error: createSupabaseError(
                'PGRST204',
                "Could not find the 'group_repeat_count' column of 'chains' in the schema cache",
              ),
            };
          }
          return { data: [{ id: 'chain-1' }], error: null };
        });

      ctx.mockClient.from = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            data: [],
            error: null,
          }),
        }),
        upsert: vi
          .fn()
          .mockImplementation((rows: Record<string, unknown>[]) => ({
            select: vi.fn().mockReturnValue(upsert(rows)),
          })),
      }));

      ctx.retryWithAuth = vi.fn().mockImplementation((op) => op());

      await saveChains(ctx, chains);
      await saveChains(ctx, chains);

      expect(upsert).toHaveBeenCalledTimes(3);
      const thirdPayload = upsert.mock.calls[2]?.[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(thirdPayload).not.toHaveProperty('group_repeat_count');
    });

    it('should warn when some expected ids are missing from upsert result', async () => {
      const chains = [
        createMockChain({ id: 'chain-1' }),
        createMockChain({ id: 'chain-2' }),
      ];
      const ctx = createMockContext();
      (logger.warn as unknown as ReturnType<typeof vi.fn>).mockClear();

      let callCount = 0;
      ctx.mockClient.from = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createMockQueryBuilder({ data: [], error: null });
        }
        return createMockQueryBuilder({
          data: [{ id: 'chain-1' }],
          error: null,
        });
      });
      ctx.retryWithAuth = vi.fn().mockImplementation((op) => op());

      await saveChains(ctx, chains);

      expect(logger.warn).toHaveBeenCalledWith(
        'SUPABASE_STORAGE',
        'Some saved ids missing from result',
        expect.objectContaining({
          missingSavedIds: ['chain-2'],
        }),
      );
    });

    it('should throw when deleting extra chains fails', async () => {
      const chains = [createMockChain({ id: 'chain-1' })];
      const ctx = createMockContext();

      let callCount = 0;
      ctx.mockClient.from = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createMockQueryBuilder({
            data: [{ id: 'chain-1' }, { id: 'chain-2' }],
            error: null,
          });
        }
        if (callCount === 2) {
          return createMockQueryBuilder({
            data: [{ id: 'chain-1' }],
            error: null,
          });
        }
        return createMockQueryBuilder({
          data: null,
          error: createSupabaseError('UNKNOWN', 'Delete failed'),
        });
      });
      ctx.retryWithAuth = vi.fn().mockImplementation((op) => op());

      await expect(saveChains(ctx, chains)).rejects.toThrow(
        'Failed to delete extra chains',
      );
    });
  });

  describe('upsertChain', () => {
    it('should throw error when user authentication fails', async () => {
      const ctx = createMockContext({ user: null, isAuthenticated: false });

      await expect(upsertChain(ctx, createMockChain())).rejects.toThrow(
        'User authentication failed or timed out',
      );
    });

    it('should upsert a single chain without querying or deleting unrelated rows', async () => {
      const chain = createMockChain({ id: 'chain-upsert-1' });
      const ctx = createMockContext();

      ctx.mockClient.from = vi.fn().mockImplementation(() =>
        createMockQueryBuilder({
          data: [{ id: chain.id }],
          error: null,
        }),
      );
      ctx.retryWithAuth = vi.fn().mockImplementation((op) => op());

      await upsertChain(ctx, chain);

      expect(ctx.retryWithAuth).toHaveBeenCalledTimes(1);
      expect(ctx.mockClient.from).toHaveBeenCalledWith('chains');
    });

    it('should fallback to base columns when strict upsert columns are missing', async () => {
      const chain = createMockChain({ id: 'chain-upsert-2' });
      const ctx = createMockContext();

      ctx.mockClient.from = vi.fn().mockImplementation(() =>
        createMockQueryBuilder({
          data: [{ id: chain.id }],
          error: null,
        }),
      );

      let retryCallCount = 0;
      ctx.retryWithAuth = vi.fn().mockImplementation(async (op) => {
        retryCallCount++;
        if (retryCallCount === 1) {
          throw createSupabaseError(
            'PGRST204',
            "column 'deleted_at' does not exist",
          );
        }
        return op();
      });

      await upsertChain(ctx, chain);

      expect(ctx.retryWithAuth).toHaveBeenCalledTimes(2);
    });
  });
});
