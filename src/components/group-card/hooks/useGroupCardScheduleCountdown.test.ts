import { createTranslator } from '../../../i18n/translate';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChainTreeNode, ScheduledSession } from '../../../types';
import { useGroupCardScheduleCountdown } from './useGroupCardScheduleCountdown';

const notificationMocks = vi.hoisted(() => ({
  notifyScheduleWarning: vi.fn(async () => undefined),
  notifyScheduleFailed: vi.fn(async () => undefined),
}));

vi.mock('../../../services/platform/SystemNotificationService', () => ({
  systemNotificationService: notificationMocks,
}));

const NOW = new Date('2026-02-06T10:00:00.000Z');

function createGroup(overrides: Partial<ChainTreeNode> = {}): ChainTreeNode {
  return {
    id: 'group-1',
    name: 'Morning routine',
    type: 'group',
    auxiliaryDuration: 10,
    children: [],
    ...overrides,
  } as ChainTreeNode;
}

function createSession(
  expiresInSeconds: number,
  overrides: Partial<ScheduledSession> = {},
): ScheduledSession {
  return {
    chainId: 'group-1',
    scheduledAt: new Date(NOW.getTime() - 60_000),
    expiresAt: new Date(NOW.getTime() + expiresInSeconds * 1000),
    auxiliarySignal: 'signal',
    ...overrides,
  };
}

describe('useGroupCardScheduleCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not create a timer or notification without a scheduled session', () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

    const { result } = renderHook(() =>
      useGroupCardScheduleCountdown({
        group: createGroup(),
        nextUnit: null,
        t: createTranslator('en'),
      }),
    );

    expect(result.current.timeRemaining).toBe(0);
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(notificationMocks.notifyScheduleWarning).not.toHaveBeenCalled();
    expect(notificationMocks.notifyScheduleFailed).not.toHaveBeenCalled();
  });

  it('shows one warning when the countdown crosses the warning threshold', async () => {
    const session = createSession(70);
    const { result } = renderHook(() =>
      useGroupCardScheduleCountdown({
        scheduledSession: session,
        group: createGroup(),
        nextUnit: null,
        t: createTranslator('en'),
      }),
    );

    expect(result.current.timeRemaining).toBe(70);
    expect(notificationMocks.notifyScheduleWarning).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(notificationMocks.notifyScheduleWarning).toHaveBeenCalledWith(
      'Morning routine',
      '1 min',
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(notificationMocks.notifyScheduleWarning).toHaveBeenCalledTimes(1);
  });

  it('notifies when a scheduled session expires', async () => {
    const { result } = renderHook(() =>
      useGroupCardScheduleCountdown({
        scheduledSession: createSession(1),
        group: createGroup({ auxiliaryDuration: 3 }),
        nextUnit: null,
        t: createTranslator('en'),
      }),
    );

    expect(result.current.timeRemaining).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(result.current.timeRemaining).toBe(0);
    expect(notificationMocks.notifyScheduleFailed).toHaveBeenCalledWith(
      'Morning routine',
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(notificationMocks.notifyScheduleFailed).toHaveBeenCalledTimes(1);
  });

  it('allows a warning again when the scheduled session changes', async () => {
    let session = createSession(50);
    const { rerender } = renderHook(() =>
      useGroupCardScheduleCountdown({
        scheduledSession: session,
        group: createGroup(),
        nextUnit: null,
        t: createTranslator('en'),
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(notificationMocks.notifyScheduleWarning).toHaveBeenCalledTimes(1);

    session = createSession(50, {
      scheduledAt: new Date(NOW.getTime() + 1_000),
      expiresAt: new Date(NOW.getTime() + 50_000),
    });
    await act(async () => {
      rerender();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(notificationMocks.notifyScheduleWarning).toHaveBeenCalledTimes(2);
  });

  it('clears the countdown interval on unmount', async () => {
    const { unmount } = renderHook(() =>
      useGroupCardScheduleCountdown({
        scheduledSession: createSession(70),
        group: createGroup(),
        nextUnit: null,
        t: createTranslator('en'),
      }),
    );

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(notificationMocks.notifyScheduleWarning).not.toHaveBeenCalled();
    expect(notificationMocks.notifyScheduleFailed).not.toHaveBeenCalled();
  });
});
