import { createChain as createFixtureChain } from '../../../test/factories/chainFactory';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ChainRecord,
  ChainTreeNode,
  ScheduledSession,
} from '../../../types';
import { useChainCard } from '../useChainCard';

const getLastCompletionTimeMock = vi.hoisted(() => vi.fn());
const getTimeRemainingMock = vi.hoisted(() => vi.fn());
const notifyScheduleWarningMock = vi.hoisted(() => vi.fn());
const notifyScheduleFailedMock = vi.hoisted(() => vi.fn());
const playTimerFinishedMock = vi.hoisted(() => vi.fn());
const loggerWarnMock = vi.hoisted(() => vi.fn());
const getChainTypeConfigMock = vi.hoisted(() =>
  vi.fn(() => ({
    icon: 'zap' as const,
    bgColor: 'bg-slate-100',
    color: 'text-slate-700',
    name: 'Unit',
  })),
);

vi.mock('../../../storage/useStorage', () => ({
  useStorage: () => ({
    kind: 'local',
    getLastCompletionTime: getLastCompletionTimeMock,
  }),
}));

vi.mock('../../../utils/time', () => ({
  getTimeRemaining: getTimeRemainingMock,
}));

vi.mock('../../../utils/chainTree', () => ({
  getChainTypeConfig: getChainTypeConfigMock,
}));

vi.mock('../../../services/platform/SystemNotificationService', () => ({
  systemNotificationService: {
    notifyScheduleWarning: notifyScheduleWarningMock,
    notifyScheduleFailed: notifyScheduleFailedMock,
  },
}));

vi.mock('../../../utils/soundManager', () => ({
  soundManager: {
    playTimerFinished: playTimerFinishedMock,
  },
}));

vi.mock('../../../utils/env', () => ({
  isDev: true,
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    warn: loggerWarnMock,
  },
}));

vi.mock('../../../i18n', () => ({
  useI18n: () => ({
    language: 'en' as const,
    tr: (_zh: string, en: string) => en,
  }),
}));

function createChain(overrides: Partial<ChainTreeNode> = {}): ChainTreeNode {
  const fields: Partial<ChainRecord> & {
    children?: ChainTreeNode[];
    depth?: number;
  } = {
    id: 'chain-1',
    parentId: undefined,
    type: 'unit',
    sortOrder: 0,
    name: 'Demo chain',
    trigger: 'demo',
    duration: 25,
    description: 'demo description',
    currentStreak: 3,
    auxiliaryStreak: 1,
    totalCompletions: 18,
    totalFailures: 8,
    auxiliaryFailures: 3,
    exceptions: [],
    auxiliaryExceptions: [],
    auxiliarySignal: 'bell',
    auxiliaryDuration: 10,
    auxiliaryCompletionTrigger: 'demo',
    timeLimitExceptions: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    children: [],
    depth: 0,
    ...overrides,
  };
  return {
    ...createFixtureChain(fields.type === 'group' ? 'group' : 'unit', fields),
    children: fields.children ?? [],
    depth: fields.depth ?? 0,
  };
}

function createScheduledSession(
  overrides: Partial<ScheduledSession> = {},
): ScheduledSession {
  return {
    chainId: overrides.chainId ?? 'chain-1',
    scheduledAt: overrides.scheduledAt ?? new Date('2026-01-01T00:00:00.000Z'),
    expiresAt: overrides.expiresAt ?? new Date('2026-01-01T00:10:00.000Z'),
    auxiliarySignal: overrides.auxiliarySignal ?? 'bell',
  };
}

describe('useChainCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTimeRemainingMock.mockReturnValue(0);
    getLastCompletionTimeMock.mockResolvedValue(null);
  });

  it('skips loading last completion time for regular chains', () => {
    const onDelete = vi.fn();
    const chain = createChain({ isDurationless: false, duration: 25 });
    const { result } = renderHook(() => useChainCard({ chain, onDelete }));

    expect(getLastCompletionTimeMock).not.toHaveBeenCalled();
    expect(result.current.lastCompletionTime).toBeNull();
  });

  it('loads last completion time for durationless chains', async () => {
    const onDelete = vi.fn();
    const durationlessChain = createChain({
      isDurationless: true,
      duration: 0,
    });

    getLastCompletionTimeMock.mockResolvedValue(123456);

    const { result } = renderHook(() =>
      useChainCard({ chain: durationlessChain, onDelete }),
    );

    await waitFor(() => {
      expect(getLastCompletionTimeMock).toHaveBeenCalled();
      expect(result.current.lastCompletionTime).toBe(123456);
    });
  });

  it('logs warning when loading last completion time fails in development mode', async () => {
    const onDelete = vi.fn();
    const durationlessChain = createChain({
      isDurationless: true,
      duration: 0,
    });

    getLastCompletionTimeMock.mockRejectedValue(new Error('load failed'));

    const { result } = renderHook(() =>
      useChainCard({ chain: durationlessChain, onDelete }),
    );

    await waitFor(() => {
      expect(loggerWarnMock).toHaveBeenCalledTimes(1);
    });
    expect(result.current.lastCompletionTime).toBeNull();
  });

  it('emits warning and failure notifications and only plays end sound once per session', async () => {
    vi.useFakeTimers();
    const onDelete = vi.fn();
    const chain = createChain({ auxiliaryDuration: 9 });
    const scheduledSession = createScheduledSession();

    const remainingQueue = [50, 50, 0, 0, 0];
    getTimeRemainingMock.mockImplementation(() => remainingQueue.shift() ?? 0);

    renderHook(() =>
      useChainCard({
        chain,
        scheduledSession,
        onDelete,
      }),
    );

    expect(notifyScheduleWarningMock).toHaveBeenCalled();
    expect(notifyScheduleWarningMock).toHaveBeenCalledWith(
      'Demo chain',
      '1 min',
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(notifyScheduleFailedMock).toHaveBeenCalled();
    expect(playTimerFinishedMock).toHaveBeenCalledTimes(1);
  });

  it('does not warn when auxiliary duration is too short', async () => {
    const onDelete = vi.fn();
    const chain = createChain({ auxiliaryDuration: 3 });
    const scheduledSession = createScheduledSession();

    getTimeRemainingMock.mockReturnValue(30);

    const { result } = renderHook(() =>
      useChainCard({
        chain,
        scheduledSession,
        onDelete,
      }),
    );

    await waitFor(() => {
      expect(result.current.timeRemaining).toBe(30);
    });
    expect(notifyScheduleWarningMock).not.toHaveBeenCalled();
  });

  it('resets warning state when scheduled session changes', async () => {
    const onDelete = vi.fn();
    const chain = createChain({ auxiliaryDuration: 9 });
    const firstSession = createScheduledSession({
      scheduledAt: new Date('2026-01-01T00:00:00.000Z'),
      expiresAt: new Date('2026-01-01T00:10:00.000Z'),
    });

    const remainingQueue = [50, 50, 50, 50];
    getTimeRemainingMock.mockImplementation(() => remainingQueue.shift() ?? 50);

    const { rerender } = renderHook(
      ({ session }) =>
        useChainCard({
          chain,
          scheduledSession: session,
          onDelete,
        }),
      { initialProps: { session: firstSession } },
    );

    await waitFor(() => {
      expect(notifyScheduleWarningMock).toHaveBeenCalled();
    });
    const warningCallsBeforeSessionChange =
      notifyScheduleWarningMock.mock.calls.length;

    const secondSession = createScheduledSession({
      scheduledAt: new Date('2026-01-01T01:00:00.000Z'),
      expiresAt: new Date('2026-01-01T01:10:00.000Z'),
    });

    rerender({ session: secondSession });

    await waitFor(() => {
      expect(notifyScheduleWarningMock.mock.calls.length).toBeGreaterThan(
        warningCallsBeforeSessionChange,
      );
    });
  });

  it('handles menu and delete state transitions', () => {
    const onDelete = vi.fn();
    const chain = createChain();

    const { result } = renderHook(() =>
      useChainCard({
        chain,
        onDelete,
      }),
    );

    act(() => {
      result.current.handleToggleMenu();
    });
    expect(result.current.showMenu).toBe(true);

    act(() => {
      result.current.handleShowDeleteConfirm();
    });
    expect(result.current.showDeleteConfirm).toBe(true);
    expect(result.current.showMenu).toBe(false);

    act(() => {
      result.current.handleShowDeleteConfirm();
      result.current.handleConfirmDelete();
    });
    expect(onDelete).toHaveBeenCalledWith('chain-1');
    expect(result.current.showDeleteConfirm).toBe(false);

    act(() => {
      result.current.handleShowDeleteConfirm();
      result.current.handleCancelDelete();
    });
    expect(result.current.showDeleteConfirm).toBe(false);
  });
});
