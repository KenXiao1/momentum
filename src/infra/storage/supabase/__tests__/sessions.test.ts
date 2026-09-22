import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getScheduledSessions,
  removeScheduledSession,
  saveScheduledSessions,
  setScheduledSession,
  getActiveSession,
  saveActiveSession,
} from '../sessions';
import {
  createMockContext,
  createMockQueryBuilder,
  createSupabaseError,
} from './testHelpers';
import type { ActiveSession, ScheduledSession } from '../../../../types';

vi.mock('../../../../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    dbOperation: vi.fn(),
  },
}));

const createMockScheduledSessionRow = (
  overrides: Partial<Record<string, unknown>> = {},
) => ({
  chain_id: 'chain-1',
  scheduled_at: '2024-01-15T10:00:00Z',
  expires_at: '2024-01-15T11:00:00Z',
  auxiliary_signal: 'Set alarm',
  user_id: 'test-user-123',
  ...overrides,
});

const createMockActiveSessionRow = (
  overrides: Partial<Record<string, unknown>> = {},
) => ({
  id: 'session-1',
  chain_id: 'chain-1',
  started_at: '2024-01-15T10:00:00Z',
  duration: 30,
  is_paused: false,
  paused_at: null,
  total_paused_time: 0,
  is_forward_timer: false,
  forward_elapsed_time: 0,
  user_id: 'test-user-123',
  ...overrides,
});

describe('sessions.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getScheduledSessions', () => {
    it('should return empty array when user is not authenticated', async () => {
      const ctx = createMockContext({ user: null });

      const result = await getScheduledSessions(ctx);

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      const queryBuilder = createMockQueryBuilder({
        data: null,
        error: createSupabaseError('UNKNOWN', 'Database error'),
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getScheduledSessions(ctx);

      expect(result).toEqual([]);
    });

    it('should return mapped scheduled sessions on success', async () => {
      const mockData = [createMockScheduledSessionRow()];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getScheduledSessions(ctx);

      expect(result).toHaveLength(1);
      expect(result[0].chainId).toBe('chain-1');
      expect(result[0].auxiliarySignal).toBe('Set alarm');
      expect(result[0].scheduledAt).toBeInstanceOf(Date);
      expect(result[0].expiresAt).toBeInstanceOf(Date);
    });

    it('should return empty array when data is null', async () => {
      const queryBuilder = createMockQueryBuilder({ data: null, error: null });
      const ctx = createMockContext({ queryBuilder });

      const result = await getScheduledSessions(ctx);

      expect(result).toEqual([]);
    });
  });

  describe('saveScheduledSessions', () => {
    it('should return early when user is not authenticated', async () => {
      const ctx = createMockContext({ user: null });
      const sessions: ScheduledSession[] = [
        {
          chainId: 'chain-1',
          scheduledAt: new Date(),
          expiresAt: new Date(),
          auxiliarySignal: 'Signal',
        },
      ];

      await saveScheduledSessions(ctx, sessions);

      expect(ctx.mockClient.from).not.toHaveBeenCalled();
    });

    it('should delete removed sessions and upsert current sessions', async () => {
      const sessions: ScheduledSession[] = [
        {
          chainId: 'chain-1',
          scheduledAt: new Date('2024-01-15T10:00:00Z'),
          expiresAt: new Date('2024-01-15T11:00:00Z'),
          auxiliarySignal: 'Signal',
        },
      ];
      const ctx = createMockContext();

      const selectEq = vi.fn().mockReturnValue({
        data: [{ chain_id: 'chain-2' }], // existing row to be deleted
        error: null,
      });

      const deleteIn = vi.fn().mockReturnValue({ data: null, error: null });
      const deleteEq = vi
        .fn()
        .mockReturnValue({ in: deleteIn, data: null, error: null });

      const upsert = vi.fn().mockReturnValue({ data: null, error: null });

      ctx.mockClient.from = vi.fn().mockImplementation((table) => {
        if (table !== 'scheduled_sessions') return createMockQueryBuilder();
        return {
          select: vi.fn().mockReturnValue({ eq: selectEq }),
          delete: vi.fn().mockReturnValue({ eq: deleteEq }),
          upsert,
          insert: vi.fn(),
        };
      });

      await saveScheduledSessions(ctx, sessions);

      expect(ctx.mockClient.from).toHaveBeenCalledWith('scheduled_sessions');
      expect(deleteIn).toHaveBeenCalledWith('chain_id', ['chain-2']);
      expect(upsert).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            chain_id: 'chain-1',
            auxiliary_signal: 'Signal',
            user_id: 'test-user-123',
          }),
        ],
        { onConflict: 'user_id,chain_id' },
      );
    });

    it('should not insert when sessions array is empty', async () => {
      const ctx = createMockContext();
      let deleteCall = false;
      let upsertCall = false;

      ctx.mockClient.from = vi.fn().mockImplementation((table) => {
        if (table === 'scheduled_sessions') {
          return {
            delete: vi.fn().mockImplementation(() => {
              deleteCall = true;
              return {
                eq: vi.fn().mockReturnValue({ data: null, error: null }),
              };
            }),
            upsert: vi.fn().mockImplementation(() => {
              upsertCall = true;
              return { data: null, error: null };
            }),
          };
        }
        return createMockQueryBuilder();
      });

      await saveScheduledSessions(ctx, []);

      expect(deleteCall).toBe(true);
      expect(upsertCall).toBe(false);
    });

    it('should fall back to delete+insert when unique index is missing', async () => {
      const sessions: ScheduledSession[] = [
        {
          chainId: 'chain-1',
          scheduledAt: new Date('2024-01-15T10:00:00Z'),
          expiresAt: new Date('2024-01-15T11:00:00Z'),
          auxiliarySignal: 'Signal',
        },
      ];
      const ctx = createMockContext();

      const upsert = vi.fn().mockReturnValueOnce({
        data: null,
        error: createSupabaseError(
          '42P10',
          'no unique or exclusion constraint matching',
        ),
      });

      const deleteEq = vi.fn().mockReturnValue({ data: null, error: null });
      const insert = vi.fn().mockReturnValue({ data: null, error: null });

      ctx.mockClient.from = vi.fn().mockImplementation((table) => {
        if (table !== 'scheduled_sessions') return createMockQueryBuilder();
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ data: [], error: null }),
          }),
          delete: vi.fn().mockReturnValue({ eq: deleteEq }),
          upsert,
          insert,
        };
      });

      await saveScheduledSessions(ctx, sessions);

      expect(upsert).toHaveBeenCalled();
      expect(deleteEq).toHaveBeenCalledWith('user_id', 'test-user-123');
      expect(insert).toHaveBeenCalledWith([
        expect.objectContaining({
          chain_id: 'chain-1',
          user_id: 'test-user-123',
        }),
      ]);
    });
  });

  describe('setScheduledSession', () => {
    it('should upsert a single scheduled session without querying the full list', async () => {
      const session: ScheduledSession = {
        chainId: 'chain-1',
        scheduledAt: new Date('2024-01-15T10:00:00Z'),
        expiresAt: new Date('2024-01-15T11:00:00Z'),
        auxiliarySignal: 'Signal',
      };
      const upsert = vi.fn().mockReturnValue({ data: null, error: null });
      const ctx = createMockContext();

      ctx.mockClient.from = vi.fn().mockImplementation((table) => {
        if (table !== 'scheduled_sessions') return createMockQueryBuilder();
        return {
          upsert,
          delete: vi.fn(),
          insert: vi.fn(),
          eq: vi.fn(),
        };
      });

      await setScheduledSession(ctx, session);

      expect(ctx.mockClient.from).toHaveBeenCalledWith('scheduled_sessions');
      expect(upsert).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            chain_id: 'chain-1',
            auxiliary_signal: 'Signal',
            user_id: 'test-user-123',
          }),
        ],
        { onConflict: 'user_id,chain_id' },
      );
    });
  });

  describe('removeScheduledSession', () => {
    it('should delete a single scheduled session by chain id', async () => {
      const deleteChain = vi.fn().mockReturnValue({ data: null, error: null });
      const deleteUser = vi.fn().mockReturnValue({ eq: deleteChain });
      const ctx = createMockContext();

      ctx.mockClient.from = vi.fn().mockImplementation((table) => {
        if (table !== 'scheduled_sessions') return createMockQueryBuilder();
        return {
          delete: vi.fn().mockReturnValue({ eq: deleteUser }),
        };
      });

      await removeScheduledSession(ctx, 'chain-1');

      expect(deleteUser).toHaveBeenCalledWith('user_id', 'test-user-123');
      expect(deleteChain).toHaveBeenCalledWith('chain_id', 'chain-1');
    });
  });

  describe('getActiveSession', () => {
    it('should return null when user is not authenticated', async () => {
      const ctx = createMockContext({ user: null });

      const result = await getActiveSession(ctx);

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const queryBuilder = createMockQueryBuilder({
        data: null,
        error: createSupabaseError('UNKNOWN', 'Database error'),
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getActiveSession(ctx);

      expect(result).toBeNull();
    });

    it('should return null when no active session exists', async () => {
      const queryBuilder = createMockQueryBuilder({ data: [], error: null });
      const ctx = createMockContext({ queryBuilder });

      const result = await getActiveSession(ctx);

      expect(result).toBeNull();
    });

    it('should return mapped active session on success', async () => {
      const mockData = [createMockActiveSessionRow()];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getActiveSession(ctx);

      expect(result).not.toBeNull();
      expect(result!.id).toBe('session-1');
      expect(result!.chainId).toBe('chain-1');
      expect(result!.duration).toBe(30);
      expect(result!.isPaused).toBe(false);
      expect(result!.totalPausedTime).toBe(0);
      expect(result!.startedAt).toBeInstanceOf(Date);
    });

    it('should map paused session correctly', async () => {
      const mockData = [
        createMockActiveSessionRow({
          is_paused: true,
          paused_at: '2024-01-15T10:15:00Z',
          total_paused_time: 120,
        }),
      ];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getActiveSession(ctx);

      expect(result!.isPaused).toBe(true);
      expect(result!.pausedAt).toBeInstanceOf(Date);
      expect(result!.totalPausedTime).toBe(120);
    });

    it('should map forward timer fields correctly', async () => {
      const mockData = [
        createMockActiveSessionRow({
          is_forward_timer: true,
          forward_elapsed_time: 600,
        }),
      ];
      const queryBuilder = createMockQueryBuilder({
        data: mockData,
        error: null,
      });
      const ctx = createMockContext({ queryBuilder });

      const result = await getActiveSession(ctx);

      expect(result!.isForwardTimer).toBe(true);
      expect(result!.forwardElapsedTime).toBe(600);
    });

    it('should fallback to basic select when forward timer columns are missing', async () => {
      const ctx = createMockContext();

      const firstQuery = createMockQueryBuilder({
        data: null,
        error: createSupabaseError(
          'PGRST204',
          'is_forward_timer does not exist',
        ),
      });

      const basicRow = {
        id: 'session-1',
        chain_id: 'chain-1',
        started_at: '2024-01-15T10:00:00Z',
        duration: 30,
        is_paused: false,
        paused_at: null,
        total_paused_time: 0,
        user_id: 'test-user-123',
      };

      const secondQuery = createMockQueryBuilder({
        data: [basicRow],
        error: null,
      });

      ctx.mockClient.from = vi
        .fn()
        .mockReturnValueOnce(firstQuery)
        .mockReturnValueOnce(secondQuery);

      const result = await getActiveSession(ctx);

      expect(result).not.toBeNull();
      expect(result!.isForwardTimer).toBe(false);
      expect(result!.forwardElapsedTime).toBe(0);
      expect(ctx.mockClient.from).toHaveBeenCalledTimes(2);
    });

    it('should skip full select after forward-timer columns are marked missing', async () => {
      const ctx = createMockContext();

      const firstQuery = createMockQueryBuilder({
        data: null,
        error: createSupabaseError(
          'PGRST204',
          'is_forward_timer does not exist',
        ),
      });

      const basicRow = {
        id: 'session-1',
        chain_id: 'chain-1',
        started_at: '2024-01-15T10:00:00Z',
        duration: 30,
        is_paused: false,
        paused_at: null,
        total_paused_time: 0,
        user_id: 'test-user-123',
      };

      const secondQuery = createMockQueryBuilder({
        data: [basicRow],
        error: null,
      });
      const thirdQuery = createMockQueryBuilder({
        data: [basicRow],
        error: null,
      });

      ctx.mockClient.from = vi
        .fn()
        .mockReturnValueOnce(firstQuery)
        .mockReturnValueOnce(secondQuery)
        .mockReturnValueOnce(thirdQuery);

      const firstResult = await getActiveSession(ctx);
      const secondResult = await getActiveSession(ctx);

      expect(firstResult).not.toBeNull();
      expect(secondResult).not.toBeNull();
      expect(ctx.mockClient.from).toHaveBeenCalledTimes(3);
    });
  });

  describe('saveActiveSession', () => {
    it('rejects saving and clearing a session when authentication is lost', async () => {
      const ctx = createMockContext({ user: null });
      const session: ActiveSession = {
        id: 'session-1',
        chainId: 'chain-1',
        startedAt: new Date(),
        duration: 30,
        isPaused: false,
        totalPausedTime: 0,
      };

      await expect(saveActiveSession(ctx, session)).rejects.toThrow(
        'Authentication required',
      );
      await expect(saveActiveSession(ctx, null)).rejects.toThrow(
        'Authentication required',
      );

      expect(ctx.mockClient.from).not.toHaveBeenCalled();
    });

    it('should delete active session when session is null', async () => {
      const queryBuilder = createMockQueryBuilder({ data: null, error: null });
      const ctx = createMockContext({ queryBuilder });

      await saveActiveSession(ctx, null);

      expect(ctx.mockClient.from).toHaveBeenCalledWith('active_sessions');
    });

    it('should throw error when delete fails', async () => {
      const ctx = createMockContext();
      ctx.mockClient.from = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            error: createSupabaseError('UNKNOWN', 'Delete failed'),
          }),
        }),
      });

      await expect(saveActiveSession(ctx, null)).rejects.toThrow(
        'Delete failed',
      );
    });

    it('should upsert active session successfully', async () => {
      const session: ActiveSession = {
        id: 'session-1',
        chainId: 'chain-1',
        startedAt: new Date('2024-01-15T10:00:00Z'),
        duration: 30,
        isPaused: false,
        totalPausedTime: 0,
      };
      const queryBuilder = createMockQueryBuilder({ data: null, error: null });
      const ctx = createMockContext({ queryBuilder });

      await saveActiveSession(ctx, session);

      expect(ctx.mockClient.from).toHaveBeenCalledWith('active_sessions');
    });

    it('should include forward timer fields when isForwardTimer is true', async () => {
      const session: ActiveSession = {
        id: 'session-1',
        chainId: 'chain-1',
        startedAt: new Date('2024-01-15T10:00:00Z'),
        duration: 30,
        isPaused: false,
        totalPausedTime: 0,
        isForwardTimer: true,
        forwardElapsedTime: 600,
      };
      const queryBuilder = createMockQueryBuilder({ data: null, error: null });
      const ctx = createMockContext({ queryBuilder });

      await saveActiveSession(ctx, session);

      expect(ctx.mockClient.from).toHaveBeenCalledWith('active_sessions');
    });

    it('should fallback to basic payload when forward timer columns are missing', async () => {
      const session: ActiveSession = {
        id: 'session-1',
        chainId: 'chain-1',
        startedAt: new Date('2024-01-15T10:00:00Z'),
        duration: 30,
        isPaused: false,
        totalPausedTime: 0,
        isForwardTimer: true,
        forwardElapsedTime: 600,
      };

      const ctx = createMockContext();
      let callCount = 0;
      ctx.mockClient.from = vi.fn().mockImplementation(() => ({
        upsert: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return {
              error: createSupabaseError(
                '42703',
                'is_forward_timer does not exist',
              ),
            };
          }
          return { error: null };
        }),
      }));

      await saveActiveSession(ctx, session);

      expect(callCount).toBe(2);
    });

    it('should skip strict payload after detecting missing forward-timer columns', async () => {
      const session: ActiveSession = {
        id: 'session-1',
        chainId: 'chain-1',
        startedAt: new Date('2024-01-15T10:00:00Z'),
        duration: 30,
        isPaused: false,
        totalPausedTime: 0,
        isForwardTimer: true,
        forwardElapsedTime: 600,
      };

      const ctx = createMockContext();
      const upsert = vi
        .fn()
        .mockImplementation((payload: Record<string, unknown>) => {
          if (
            Object.prototype.hasOwnProperty.call(payload, 'is_forward_timer')
          ) {
            return {
              error: createSupabaseError(
                '42703',
                'is_forward_timer does not exist',
              ),
            };
          }
          return { error: null };
        });

      ctx.mockClient.from = vi.fn().mockReturnValue({ upsert });

      await saveActiveSession(ctx, session);
      await saveActiveSession(ctx, session);

      expect(upsert).toHaveBeenCalledTimes(3);
      expect(upsert.mock.calls[2]?.[0]).not.toHaveProperty('is_forward_timer');
    });

    it('should throw error when both upsert attempts fail', async () => {
      const session: ActiveSession = {
        id: 'session-1',
        chainId: 'chain-1',
        startedAt: new Date('2024-01-15T10:00:00Z'),
        duration: 30,
        isPaused: false,
        totalPausedTime: 0,
        isForwardTimer: true,
        forwardElapsedTime: 600,
      };

      const ctx = createMockContext();
      ctx.mockClient.from = vi.fn().mockImplementation(() => ({
        upsert: vi.fn().mockImplementation(() => ({
          error: createSupabaseError(
            '42703',
            'is_forward_timer does not exist',
          ),
        })),
      }));

      await expect(saveActiveSession(ctx, session)).rejects.toThrow(
        'is_forward_timer does not exist',
      );
    });

    it('should throw error on general upsert failure', async () => {
      const session: ActiveSession = {
        id: 'session-1',
        chainId: 'chain-1',
        startedAt: new Date('2024-01-15T10:00:00Z'),
        duration: 30,
        isPaused: false,
        totalPausedTime: 0,
      };

      const ctx = createMockContext();
      ctx.mockClient.from = vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          error: createSupabaseError('UNKNOWN', 'Upsert failed'),
        }),
      });

      await expect(saveActiveSession(ctx, session)).rejects.toThrow(
        'Upsert failed',
      );
    });
  });
});
