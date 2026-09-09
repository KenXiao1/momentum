import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ok } from '../../../domain/result';
import {
  createAppState,
  createLocalStorageMock,
  createSupabaseStorageMock,
  createUnitChain,
} from '../../../test/factories';
import { migrateCompletionHistoryForTiming } from '../../../utils/completionHistoryTimingMigration';
import { fireAndForget } from '../../../utils/fireAndForget';
import { isSessionExpired } from '../../../utils/time';
import { runWhenIdle } from '../../../utils/runWhenIdle';
import { useAppDataLoad } from '../useAppDataLoad';
import {
  navigationStore,
  createInitialNavigationState,
} from '../../../stores/navigationStore';

vi.mock('../../../utils/env', () => ({
  isDev: false,
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../utils/fireAndForget', () => ({
  fireAndForget: vi.fn((promise: Promise<unknown>) => {
    promise.catch(() => undefined);
  }),
}));

vi.mock('../../../utils/runWhenIdle', () => ({
  runWhenIdle: vi.fn((callback: () => void) => callback()),
}));

vi.mock('../../../utils/completionHistoryTimingMigration', () => ({
  migrateCompletionHistoryForTiming: vi.fn((history) => ({
    updatedHistory: history,
    hasChanges: false,
  })),
}));

vi.mock('../../../utils/time', () => ({
  isSessionExpired: vi.fn(() => false),
}));

describe('useAppDataLoad', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigationStore.setState(createInitialNavigationState());
    vi.mocked(migrateCompletionHistoryForTiming).mockImplementation(
      (history) => ({
        updatedHistory: history,
        hasChanges: false,
      }),
    );
    vi.mocked(isSessionExpired).mockReturnValue(false);
  });

  it('should stop loading immediately when app is not initialized', async () => {
    const storage = createLocalStorageMock();
    const setState = vi.fn();

    const { result } = renderHook(() =>
      useAppDataLoad({
        storage,
        isInitialized: false,
        setState,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingData).toBe(false);
    });
    expect(storage.getActiveChains).not.toHaveBeenCalled();
  });

  it('should load local data, retain expired schedules for judgment, and update app state', async () => {
    const chain = createUnitChain({ id: 'chain-1', name: 'Chain 1' });
    const expiredSession = {
      chainId: chain.id,
      scheduledAt: new Date('2026-02-01T08:00:00.000Z'),
      expiresAt: new Date('2026-02-01T08:30:00.000Z'),
      auxiliarySignal: 'expired',
    };
    const activeSessionBooking = {
      chainId: chain.id,
      scheduledAt: new Date('2026-02-01T09:00:00.000Z'),
      expiresAt: new Date('2026-02-01T10:00:00.000Z'),
      auxiliarySignal: 'active',
    };
    const activeSession = {
      chainId: chain.id,
      startedAt: new Date('2026-02-01T09:05:00.000Z'),
      duration: 25,
      isPaused: false,
      totalPausedTime: 0,
    };
    const completionHistory = [
      {
        chainId: chain.id,
        completedAt: new Date('2026-01-31T10:00:00.000Z'),
        duration: 25,
        wasSuccessful: true,
      },
    ];
    const migratedHistory = [
      {
        ...completionHistory[0],
        actualDuration: 25,
        isForwardTimed: false,
      },
    ];

    vi.mocked(isSessionExpired).mockImplementation(
      (expiresAt) => expiresAt.getTime() === expiredSession.expiresAt.getTime(),
    );
    vi.mocked(migrateCompletionHistoryForTiming).mockReturnValue({
      updatedHistory: migratedHistory,
      hasChanges: true,
    });

    const storage = createLocalStorageMock({
      cleanupExpiredDeletedChains: vi.fn(async () => 1),
      getActiveChains: vi.fn(async () => [chain]),
      getScheduledSessions: vi.fn(async () => [
        expiredSession,
        activeSessionBooking,
      ]),
      getActiveSession: vi.fn(async () => activeSession),
      getCompletionHistory: vi.fn(async () => completionHistory),
      getRSIPNodes: vi.fn(async () => []),
      getRSIPMeta: vi.fn(async () => ({})),
      getTaskTimeStats: vi.fn(async () => []),
      saveCompletionHistory: vi.fn(async () => undefined),
      removeScheduledSession: vi.fn(async () => undefined),
    });

    const setState = vi.fn();

    const { result } = renderHook(() =>
      useAppDataLoad({
        storage,
        isInitialized: true,
        setState,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingData).toBe(false);
    });

    expect(runWhenIdle).toHaveBeenCalled();
    expect(fireAndForget).toHaveBeenCalled();
    expect(storage.cleanupExpiredDeletedChains).toHaveBeenCalledWith(30);
    expect(storage.removeScheduledSession).not.toHaveBeenCalled();
    expect(storage.saveCompletionHistory).toHaveBeenCalledWith(migratedHistory);

    const stateUpdater = setState.mock.calls.at(-1)?.[0] as (
      prev: ReturnType<typeof createAppState>,
    ) => ReturnType<typeof createAppState>;
    const next = stateUpdater(createAppState());
    expect(next.chains).toEqual([chain]);
    expect(next.scheduledSessions).toEqual([
      expiredSession,
      activeSessionBooking,
    ]);
    expect(next.activeSession).toEqual(activeSession);
    expect(next.completionHistory).toEqual(migratedHistory);
    expect(navigationStore.getState().currentView).toBe('focus');
  });

  it('should skip data load when supabase user is not authenticated', async () => {
    const storage = createSupabaseStorageMock({
      waitForAuthentication: vi.fn(async () =>
        ok({ user: null, isAuthenticated: false }),
      ),
    });
    const setState = vi.fn();

    const { result } = renderHook(() =>
      useAppDataLoad({
        storage,
        isInitialized: true,
        setState,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingData).toBe(false);
    });

    expect(storage.waitForAuthentication).toHaveBeenCalledWith(10000);
    expect(storage.getActiveChains).not.toHaveBeenCalled();
    expect(setState).not.toHaveBeenCalled();
  });

  it('should fix circular parent references and persist repaired chains', async () => {
    const circular = createUnitChain({
      id: 'circular-1',
      parentId: 'circular-1',
    });
    navigationStore.getState().navigateToView('focus');
    const storage = createLocalStorageMock({
      getActiveChains: vi.fn(async () => [circular]),
      getScheduledSessions: vi.fn(async () => []),
      getActiveSession: vi.fn(async () => null),
      getCompletionHistory: vi.fn(async () => []),
      getRSIPNodes: vi.fn(async () => []),
      getRSIPMeta: vi.fn(async () => ({})),
      getTaskTimeStats: vi.fn(async () => []),
      saveChains: vi.fn(async () => undefined),
      cleanupExpiredDeletedChains: vi.fn(async () => 0),
    });
    const setState = vi.fn();

    const { result } = renderHook(() =>
      useAppDataLoad({
        storage,
        isInitialized: true,
        setState,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingData).toBe(false);
    });

    expect(storage.saveChains).toHaveBeenCalledWith([
      expect.objectContaining({
        id: circular.id,
        parentId: undefined,
      }),
    ]);

    const stateUpdater = setState.mock.calls.at(-1)?.[0] as (
      prev: ReturnType<typeof createAppState>,
    ) => ReturnType<typeof createAppState>;
    const next = stateUpdater(createAppState());
    expect(navigationStore.getState().currentView).toBe('dashboard');
    expect(next.scheduledSessions).toEqual([]);
    expect(next.activeSession).toBeNull();
    expect(next.completionHistory).toEqual([]);
  });

  it('should keep loading flow resilient when individual reads fail', async () => {
    const storage = createLocalStorageMock({
      getActiveChains: vi.fn(async () => {
        throw new Error('chains failed');
      }),
      getScheduledSessions: vi.fn(async () => {
        throw new Error('sessions failed');
      }),
      getActiveSession: vi.fn(async () => {
        throw new Error('active session failed');
      }),
      getCompletionHistory: vi.fn(async () => {
        throw new Error('history failed');
      }),
      getRSIPNodes: vi.fn(async () => {
        throw new Error('rsip nodes failed');
      }),
      getRSIPMeta: vi.fn(async () => {
        throw new Error('rsip meta failed');
      }),
      getTaskTimeStats: vi.fn(async () => {
        throw new Error('stats failed');
      }),
    });
    const setState = vi.fn();

    const { result } = renderHook(() =>
      useAppDataLoad({
        storage,
        isInitialized: true,
        setState,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingData).toBe(false);
    });

    const stateUpdater = setState.mock.calls.at(-1)?.[0] as (
      prev: ReturnType<typeof createAppState>,
    ) => ReturnType<typeof createAppState>;
    const next = stateUpdater(createAppState());
    expect(next.chains).toEqual([]);
    expect(next.scheduledSessions).toEqual([]);
    expect(next.activeSession).toBeNull();
    expect(next.completionHistory).toEqual([]);
  });
});
