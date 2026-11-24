import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppError } from '../../../domain/errors';
import { err, ok } from '../../../domain/result';
import {
  createAppState,
  createLocalStorageMock,
  createSupabaseStorageMock,
  createUnitChain,
} from '../../../test/factories';
import { migrateCompletionHistoryForTiming } from '../../../utils/completionHistoryTimingMigration';
import { fireAndForget } from '../../../utils/fireAndForget';
import { isSessionExpired } from '../../../domain/scheduling';
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

vi.mock('../../../domain/scheduling', () => ({
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
    // The timing migration is derived in memory; persisting it would replace
    // the whole history and race completions recorded since the load.
    expect(storage.saveCompletionHistory).not.toHaveBeenCalled();

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

  it('repairs self-parented chains by upserting only those chains and keeps the loaded data', async () => {
    const circular = createUnitChain({
      id: 'circular-1',
      parentId: 'circular-1',
    });
    const healthy = createUnitChain({ id: 'healthy-1' });
    const history = [
      {
        chainId: healthy.id,
        completedAt: new Date('2026-01-31T10:00:00.000Z'),
        duration: 25,
        wasSuccessful: true,
      },
    ];
    navigationStore.getState().navigateToView('focus');
    const storage = createLocalStorageMock({
      getActiveChains: vi.fn(async () => [circular, healthy]),
      getCompletionHistory: vi.fn(async () => history),
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

    expect(storage.saveChains).not.toHaveBeenCalled();
    expect(storage.upsertChains).toHaveBeenCalledWith([
      expect.objectContaining({ id: circular.id, parentId: undefined }),
    ]);

    const stateUpdater = setState.mock.calls.at(-1)?.[0] as (
      prev: ReturnType<typeof createAppState>,
    ) => ReturnType<typeof createAppState>;
    const next = stateUpdater(createAppState());
    expect(next.chains.map((chain) => [chain.id, chain.parentId])).toEqual([
      [circular.id, undefined],
      [healthy.id, healthy.parentId],
    ]);
    expect(next.completionHistory).toEqual(history);
    expect(navigationStore.getState().currentView).toBe('dashboard');
    expect(result.current.loadError).toBeNull();
  });

  it('reports a load error and never populates state when a read fails', async () => {
    const storage = createLocalStorageMock({
      getActiveChains: vi.fn(async () => [createUnitChain({ id: 'chain-1' })]),
      getRSIPGroups: vi.fn(async () => {
        throw new Error('rsip groups failed');
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
      expect(result.current.loadError?.message).toBe('rsip groups failed');
    });
    expect(result.current.isLoadingData).toBe(false);
    expect(setState).not.toHaveBeenCalled();
    expect(storage.cleanupExpiredDeletedChains).not.toHaveBeenCalled();
  });

  it('reports a load error when the authentication check fails', async () => {
    const storage = createSupabaseStorageMock({
      waitForAuthentication: vi.fn(async () =>
        err({ code: 'NETWORK', message: 'offline' } as AppError),
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
      expect(result.current.loadError?.message).toContain('offline');
    });
    expect(storage.getActiveChains).not.toHaveBeenCalled();
    expect(setState).not.toHaveBeenCalled();
  });

  it('loads normally on retry after a failed load', async () => {
    const chain = createUnitChain({ id: 'chain-1' });
    const getActiveChains = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValue([chain]);
    const storage = createLocalStorageMock({ getActiveChains });
    const setState = vi.fn();

    const { result } = renderHook(() =>
      useAppDataLoad({
        storage,
        isInitialized: true,
        setState,
      }),
    );

    await waitFor(() => {
      expect(result.current.loadError).not.toBeNull();
    });
    expect(setState).not.toHaveBeenCalled();

    act(() => result.current.retryDataLoad());

    await waitFor(() => {
      expect(setState).toHaveBeenCalledTimes(1);
    });
    expect(result.current.loadError).toBeNull();
    const stateUpdater = setState.mock.calls[0][0] as (
      prev: ReturnType<typeof createAppState>,
    ) => ReturnType<typeof createAppState>;
    expect(stateUpdater(createAppState()).chains).toEqual([chain]);
  });
});
