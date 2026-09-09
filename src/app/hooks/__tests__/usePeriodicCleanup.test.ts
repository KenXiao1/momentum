import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  createAppState,
  createGroupChain,
  createLocalStorageMock,
  createUnitChain,
} from '../../../test/factories';
import { usePeriodicCleanup } from '../usePeriodicCleanup';
import { isGroupExpired, resetGroupProgress } from '../../../utils/timeLimit';
import { isSessionExpired } from '../../../utils/time';
import { systemNotificationService } from '../../../services/platform/SystemNotificationService';
import { soundManager } from '../../../utils/soundManager';
import {
  navigationStore,
  createInitialNavigationState,
} from '../../../stores/navigationStore';

vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('../../../utils/timeLimit', () => ({
  isGroupExpired: vi.fn(() => false),
  resetGroupProgress: vi.fn((group) => group),
}));

vi.mock('../../../utils/time', () => ({
  isSessionExpired: vi.fn(() => false),
}));

vi.mock('../../../services/platform/SystemNotificationService', () => ({
  systemNotificationService: {
    notifyScheduleFailed: vi.fn(),
  },
}));

vi.mock('../../../utils/soundManager', () => ({
  soundManager: {
    playTimerFinished: vi.fn(),
  },
}));

describe('usePeriodicCleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-02T15:00:00.000Z'));
    navigationStore.setState(createInitialNavigationState());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should periodically reset expired groups and persist changes', async () => {
    const expiredGroup = createGroupChain({
      id: 'group-1',
      name: 'Expired Group',
    });
    const resetGroup = createGroupChain({
      ...expiredGroup,
      totalFailures: expiredGroup.totalFailures + 1,
    });
    const state = createAppState({ chains: [expiredGroup], chainsRevision: 2 });
    const setState = vi.fn();
    const storage = createLocalStorageMock({
      upsertChain: vi.fn(async () => undefined),
      saveScheduledSessions: vi.fn(async () => undefined),
    });

    vi.mocked(isGroupExpired).mockReturnValue(true);
    vi.mocked(resetGroupProgress).mockReturnValue(resetGroup);
    vi.mocked(isSessionExpired).mockReturnValue(false);

    renderHook(() =>
      usePeriodicCleanup({
        state,
        setState,
        storage,
        isInitialized: true,
      }),
    );

    vi.advanceTimersByTime(60000);
    await Promise.resolve();

    expect(storage.upsertChain).toHaveBeenCalledWith(resetGroup);
    expect(storage.saveChains).not.toHaveBeenCalled();
    expect(setState).toHaveBeenCalledWith(expect.any(Function));
  });

  it('keeps expired schedules pending while showing judgment', async () => {
    const expiredChain = createUnitChain({
      id: 'expired-chain',
      name: 'Expired Schedule Chain',
    });
    const activeChain = createUnitChain({
      id: 'active-chain',
      name: 'Active Schedule Chain',
    });
    const expiredSession = {
      chainId: expiredChain.id,
      scheduledAt: new Date('2026-02-02T14:50:00.000Z'),
      expiresAt: new Date('2026-02-02T14:55:00.000Z'),
      auxiliarySignal: 'expired',
    };
    const activeSession = {
      chainId: activeChain.id,
      scheduledAt: new Date('2026-02-02T14:59:00.000Z'),
      expiresAt: new Date('2026-02-02T15:10:00.000Z'),
      auxiliarySignal: 'active',
    };
    const state = createAppState({
      chains: [expiredChain, activeChain],
      scheduledSessions: [expiredSession, activeSession],
    });
    const setState = vi.fn();
    const storage = createLocalStorageMock({
      removeScheduledSession: vi.fn(async () => undefined),
    });

    vi.mocked(isSessionExpired).mockImplementation(
      (expiresAt) => expiresAt.getTime() <= Date.now(),
    );

    renderHook(() =>
      usePeriodicCleanup({
        state,
        setState,
        storage,
        isInitialized: true,
      }),
    );

    vi.advanceTimersByTime(10000);
    await Promise.resolve();

    expect(soundManager.playTimerFinished).toHaveBeenCalledTimes(1);
    expect(systemNotificationService.notifyScheduleFailed).toHaveBeenCalledWith(
      expiredChain.name,
    );
    expect(navigationStore.getState().showAuxiliaryJudgment).toBe(
      expiredChain.id,
    );
    expect(storage.removeScheduledSession).not.toHaveBeenCalled();
    expect(state.scheduledSessions).toEqual([expiredSession, activeSession]);
    vi.advanceTimersByTime(10000);
    expect(soundManager.playTimerFinished).toHaveBeenCalledTimes(1);
  });

  it('should not start periodic tasks before initialization', () => {
    const setState = vi.fn();
    const storage = createLocalStorageMock({
      upsertChain: vi.fn(async () => undefined),
      removeScheduledSession: vi.fn(async () => undefined),
    });

    renderHook(() =>
      usePeriodicCleanup({
        state: createAppState(),
        setState,
        storage,
        isInitialized: false,
      }),
    );

    vi.advanceTimersByTime(120000);

    expect(storage.upsertChain).not.toHaveBeenCalled();
    expect(storage.removeScheduledSession).not.toHaveBeenCalled();
    expect(setState).not.toHaveBeenCalled();
  });
  it('B03 reads schedules created after initialization and presents each expired booking for judgment', () => {
    const chain = createUnitChain({ id: 'late' });
    const otherChain = createUnitChain({ id: 'other-late' });
    let current = createAppState({ chains: [chain, otherChain] });
    const getState = () => current;
    vi.mocked(isSessionExpired).mockImplementation(
      (date) => date.getTime() <= Date.now(),
    );
    renderHook(() =>
      usePeriodicCleanup({
        getState,
        setState: vi.fn(),
        storage: createLocalStorageMock(),
        isInitialized: true,
      }),
    );
    current = {
      ...current,
      scheduledSessions: [chain, otherChain].map((item) => ({
        chainId: item.id,
        scheduledAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
        auxiliarySignal: 'test',
      })),
    };
    vi.advanceTimersByTime(60000);
    expect(navigationStore.getState().showAuxiliaryJudgment).toBe(chain.id);
    expect(current.scheduledSessions).toHaveLength(2);
    current = {
      ...current,
      scheduledSessions: current.scheduledSessions.slice(1),
    };
    navigationStore.getState().setShowAuxiliaryJudgment(null);
    vi.advanceTimersByTime(10000);
    expect(navigationStore.getState().showAuxiliaryJudgment).toBe(
      otherChain.id,
    );
  });
});
