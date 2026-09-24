import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n';
import { createLocalStorageMock } from '../../../test/factories/storageMock';
import type { ActiveSession, Chain } from '../../../types';
import { forwardTimerManager } from '../../../utils/forwardTimer';
import { useFocusTimers } from './useFocusTimers';

const notificationBoundary = vi.hoisted(() => ({
  notifyTaskWarning: vi.fn(async () => undefined),
}));

const soundBoundary = vi.hoisted(() => ({
  playTimerFinished: vi.fn(),
}));

vi.mock('../../../services/platform/SystemNotificationService', () => ({
  systemNotificationService: notificationBoundary,
}));

vi.mock('../../../utils/soundManager', () => ({
  soundManager: soundBoundary,
}));

const NOW = new Date('2026-07-14T08:00:00.000Z');

function createSession(overrides: Partial<ActiveSession> = {}): ActiveSession {
  return {
    chainId: 'chain-1',
    startedAt: NOW,
    duration: 2,
    isPaused: false,
    totalPausedTime: 0,
    ...overrides,
  };
}

function createChain(overrides: Partial<Chain> = {}): Chain {
  return {
    id: 'chain-1',
    name: 'Deep work',
    type: 'unit',
    sortOrder: 1,
    trigger: 'start',
    duration: 2,
    description: '',
    currentStreak: 0,
    auxiliaryStreak: 0,
    totalCompletions: 0,
    totalFailures: 0,
    auxiliaryFailures: 0,
    exceptions: [],
    auxiliaryExceptions: [],
    auxiliarySignal: '',
    auxiliaryDuration: 10,
    auxiliaryCompletionTrigger: '',
    timeLimitExceptions: [],
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  } as Chain;
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

describe('useFocusTimers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    localStorage.setItem('language', 'en');
  });

  afterEach(() => {
    forwardTimerManager.destroy();
    localStorage.clear();
    vi.useRealTimers();
  });

  it('counts down from wall-clock time after subtracting prior pauses', async () => {
    const session = createSession({
      startedAt: new Date(NOW.getTime() - 30_000),
      totalPausedTime: 10_000,
    });

    const { result } = renderHook(
      () =>
        useFocusTimers({
          session,
          chain: createChain(),
          isDurationless: false,
          storage: createLocalStorageMock(),
          onTimeUp: vi.fn(),
        }),
      { wrapper },
    );

    expect(result.current.timeRemaining).toBe(100);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(result.current.timeRemaining).toBe(98);
  });

  it('warns once at the one-minute threshold for sessions longer than three minutes', async () => {
    const session = createSession({
      duration: 4,
      startedAt: new Date(NOW.getTime() - 180_000),
    });

    renderHook(
      () =>
        useFocusTimers({
          session,
          chain: createChain({ name: 'Write report', duration: 4 }),
          isDurationless: false,
          storage: createLocalStorageMock(),
          onTimeUp: vi.fn(),
        }),
      { wrapper },
    );

    expect(notificationBoundary.notifyTaskWarning).toHaveBeenCalledWith(
      'Write report',
      '1 min',
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(notificationBoundary.notifyTaskWarning).toHaveBeenCalledTimes(1);
  });

  it('does not warn for a three-minute session even inside the final minute', () => {
    renderHook(
      () =>
        useFocusTimers({
          session: createSession({
            duration: 3,
            startedAt: new Date(NOW.getTime() - 150_000),
          }),
          chain: createChain({ duration: 3 }),
          isDurationless: false,
          storage: createLocalStorageMock(),
          onTimeUp: vi.fn(),
        }),
      { wrapper },
    );

    expect(notificationBoundary.notifyTaskWarning).not.toHaveBeenCalled();
  });

  it('fires completion effects once per session identity', async () => {
    const onTimeUp = vi.fn();
    let session = createSession({
      startedAt: new Date(NOW.getTime() - 59_001),
      duration: 1,
    });

    const { rerender } = renderHook(
      () =>
        useFocusTimers({
          session,
          chain: createChain({ duration: 1 }),
          isDurationless: false,
          storage: createLocalStorageMock(),
          onTimeUp,
        }),
      { wrapper },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(onTimeUp).toHaveBeenCalledTimes(1);
    expect(soundBoundary.playTimerFinished).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(onTimeUp).toHaveBeenCalledTimes(1);
    expect(soundBoundary.playTimerFinished).toHaveBeenCalledTimes(1);

    session = createSession({
      chainId: 'chain-2',
      startedAt: new Date(Date.now() - 60_000),
      duration: 1,
    });
    rerender();

    expect(onTimeUp).toHaveBeenCalledTimes(2);
    expect(soundBoundary.playTimerFinished).toHaveBeenCalledTimes(2);
  });

  it('stops timed-session effects after unmount', async () => {
    const onTimeUp = vi.fn();
    const { unmount } = renderHook(
      () =>
        useFocusTimers({
          session: createSession({
            startedAt: new Date(NOW.getTime() - 59_001),
            duration: 1,
          }),
          chain: createChain({ duration: 1 }),
          isDurationless: false,
          storage: createLocalStorageMock(),
          onTimeUp,
        }),
      { wrapper },
    );

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(onTimeUp).not.toHaveBeenCalled();
    expect(soundBoundary.playTimerFinished).not.toHaveBeenCalled();
  });

  it('uses the real forward timer across minimum, pause, and resume transitions', async () => {
    const lastCompletion = new Date('2026-07-13T08:00:00.000Z').getTime();
    const storage = createLocalStorageMock({
      getLastCompletionTime: vi.fn(async () => lastCompletion),
    });
    let session = createSession({ duration: 0 });

    const { result, rerender } = renderHook(
      () =>
        useFocusTimers({
          session,
          chain: createChain({
            duration: 0,
            isDurationless: true,
            minimumDuration: 0.05,
          }),
          isDurationless: true,
          storage,
          onTimeUp: vi.fn(),
        }),
      { wrapper },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.lastCompletionTime).toEqual(lastCompletion);
    expect(result.current.forwardElapsedSeconds).toBe(0);
    expect(result.current.minimumCountdown).toBe(3);
    expect(result.current.hasReachedMinimum).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(result.current.forwardElapsedSeconds).toBe(2);
    expect(result.current.minimumCountdown).toBe(1);

    session = { ...session, isPaused: true, pausedAt: new Date(Date.now()) };
    rerender();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(result.current.forwardElapsedSeconds).toBe(2);
    expect(result.current.hasReachedMinimum).toBe(false);

    session = { ...session, isPaused: false, pausedAt: undefined };
    rerender();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(result.current.forwardElapsedSeconds).toBe(3);
    expect(result.current.minimumCountdown).toBe(0);
    expect(result.current.hasReachedMinimum).toBe(true);
  });

  it('clears stale completion data when the storage boundary rejects', async () => {
    const lastCompletion = new Date('2026-07-13T08:00:00.000Z').getTime();
    const getLastCompletionTime = vi.fn(async (chainId: string) => {
      if (chainId === 'unavailable-chain') {
        throw new Error('storage unavailable');
      }
      return lastCompletion;
    });
    const storage = createLocalStorageMock({ getLastCompletionTime });
    let chain = createChain({
      isDurationless: true,
      minimumDuration: undefined,
    });

    const { result, rerender } = renderHook(
      () =>
        useFocusTimers({
          session: createSession({ duration: 0 }),
          chain,
          isDurationless: true,
          storage,
          onTimeUp: vi.fn(),
        }),
      { wrapper },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.lastCompletionTime).toEqual(lastCompletion);
    expect(result.current.hasReachedMinimum).toBe(true);
    expect(result.current.minimumCountdown).toBe(0);

    chain = createChain({
      id: 'unavailable-chain',
      isDurationless: true,
      minimumDuration: undefined,
    });
    rerender();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.lastCompletionTime).toBeNull();
    expect(getLastCompletionTime).toHaveBeenNthCalledWith(
      2,
      'unavailable-chain',
    );
  });
});
