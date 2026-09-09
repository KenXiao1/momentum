import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { AppState } from '../../../../types';
import {
  createAppState,
  createGroupChain,
  createLocalStorageMock,
  createSupabaseStorageMock,
  createUnitChain,
} from '../../../../test/factories';
import { createStartChainHandler } from '../start';
import { queryOptimizer } from '../../../../utils/queryOptimizer';
import { logger } from '../../../../utils/logger';
import { systemNotificationService } from '../../../../services/platform/SystemNotificationService';
import { toast } from '../../../../utils/toast';
import {
  getNextUnitInGroup,
  incrementGroupCompletionCount,
} from '../../../../utils/chainTree';
import {
  isGroupExpired,
  resetGroupProgress,
  startGroupTimer,
} from '../../../../utils/timeLimit';

vi.mock('../../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../../../utils/queryOptimizer', () => ({
  queryOptimizer: {
    memoizedBuildChainTree: vi.fn(() => []),
    onDataChange: vi.fn(),
  },
}));

vi.mock('../../../../services/platform/SystemNotificationService', () => ({
  systemNotificationService: {
    notifyTaskCompleted: vi.fn(),
    notifyTaskFailed: vi.fn(),
  },
}));

vi.mock('../../../../utils/toast', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('../../../../utils/chainTree', () => ({
  getNextUnitInGroup: vi.fn(() => null),
  incrementGroupCompletionCount: vi.fn((chains) => chains),
}));

vi.mock('../../../../utils/timeLimit', () => ({
  isGroupExpired: vi.fn(() => false),
  resetGroupProgress: vi.fn((group) => group),
  startGroupTimer: vi.fn((group) => group),
}));

function createStateContainer(initialState: AppState) {
  let state = initialState;
  const setState = vi.fn(
    (update: AppState | ((prev: AppState) => AppState)) => {
      state =
        typeof update === 'function'
          ? (update as (prev: AppState) => AppState)(state)
          : update;
    },
  );
  return {
    getState: () => state,
    setState,
  };
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createStartChainHandler', () => {
  const tr = (_zh: string, en: string) => en;
  const zhTr = (zh: string) => zh;

  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-02-02T08:00:00.000Z'));
    vi.clearAllMocks();
    vi.mocked(isGroupExpired).mockReturnValue(false);
  });

  it('should start a local unit chain and switch to focus view', async () => {
    const chain = createUnitChain({ id: 'unit-1', duration: 45 });
    const stateRef = createStateContainer(createAppState({ chains: [chain] }));
    const storage = createLocalStorageMock({
      saveActiveSession: vi.fn(async () => undefined),
      saveScheduledSessions: vi.fn(async () => undefined),
    });
    const safelySaveChains = vi.fn(async () => undefined);
    const onNavigateToFocus = vi.fn();

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      onNavigateToFocus,
      tr,
    });

    await handleStartChain(chain.id);

    expect(storage.saveActiveSession).toHaveBeenCalledTimes(1);
    const persisted = vi.mocked(storage.saveActiveSession).mock.calls[0]?.[0];
    expect(persisted).toMatchObject({
      chainId: chain.id,
      duration: chain.duration,
      isPaused: false,
      totalPausedTime: 0,
    });
    expect(onNavigateToFocus).toHaveBeenCalledTimes(1);
    expect(stateRef.getState().activeSession?.chainId).toBe(chain.id);
  });

  it('should include betting session id and zero duration for durationless chains', async () => {
    const chain = createUnitChain({
      id: 'unit-durationless',
      duration: 120,
      isDurationless: true,
    });
    const stateRef = createStateContainer(createAppState({ chains: [chain] }));
    const storage = createLocalStorageMock({
      saveActiveSession: vi.fn(async () => undefined),
      saveScheduledSessions: vi.fn(async () => undefined),
    });

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      pendingChainId: chain.id,
      setPendingChainId: vi.fn(),
      currentSessionId: 'bet-session-123',
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr,
    });

    await handleStartChain(chain.id);

    expect(storage.saveActiveSession).toHaveBeenCalledTimes(1);
    expect(storage.saveActiveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'bet-session-123',
        chainId: chain.id,
        duration: 0,
      }),
    );
  });

  it('should consume scheduled session and increment auxiliary streak when starting chain', async () => {
    const chain = createUnitChain({
      id: 'unit-2',
      auxiliaryStreak: 1,
      name: 'Schedulable',
    });
    const stateRef = createStateContainer(
      createAppState({
        chains: [chain],
        scheduledSessions: [
          {
            chainId: chain.id,
            scheduledAt: new Date('2026-02-02T08:00:00.000Z'),
            expiresAt: new Date('2026-02-02T08:30:00.000Z'),
            auxiliarySignal: 'signal',
          },
        ],
      }),
    );
    const storage = createLocalStorageMock({
      saveActiveSession: vi.fn(async () => undefined),
      removeScheduledSession: vi.fn(async () => undefined),
    });
    const safelySaveChains = vi.fn(async () => undefined);

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr,
    });

    await handleStartChain(chain.id);

    expect(storage.removeScheduledSession).toHaveBeenCalledWith(chain.id);
    expect(safelySaveChains).toHaveBeenCalledTimes(1);
    expect(stateRef.getState().scheduledSessions).toHaveLength(0);
    expect(
      stateRef.getState().chains.find((item) => item.id === chain.id)
        ?.auxiliaryStreak,
    ).toBe(2);
    expect(systemNotificationService.notifyTaskCompleted).toHaveBeenCalledWith(
      chain.name,
      2,
      'Schedule completed',
    );
  });

  it('should open betting modal for authenticated supabase users when betting is enabled', async () => {
    const chain = createUnitChain({ id: 'unit-3', duration: 20 });
    const stateRef = createStateContainer(createAppState({ chains: [chain] }));
    const storage = createSupabaseStorageMock({
      isGamblingModeEnabled: vi.fn(async () => ({ ok: true, value: true })),
      createBettingSession: vi.fn(async () => ({
        ok: true,
        value: 'bet-session-id',
      })),
      saveActiveSession: vi.fn(async () => undefined),
    });
    const setPendingChainId = vi.fn();
    const setCurrentSessionId = vi.fn();
    const setShowBettingModal = vi.fn();

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      pendingChainId: null,
      setPendingChainId,
      currentSessionId: null,
      setCurrentSessionId,
      setShowBettingModal,
      tr,
    });

    await handleStartChain(chain.id);

    expect(storage.createBettingSession).toHaveBeenCalledWith(
      chain.id,
      chain.duration,
    );
    expect(setPendingChainId).toHaveBeenCalledWith(chain.id);
    expect(setCurrentSessionId).toHaveBeenCalledWith('bet-session-id');
    expect(setShowBettingModal).toHaveBeenCalledWith(true);
    expect(storage.saveActiveSession).not.toHaveBeenCalled();
  });

  it('should skip betting probe when a pending chain already exists', async () => {
    const chain = createUnitChain({ id: 'unit-pending', duration: 25 });
    const stateRef = createStateContainer(createAppState({ chains: [chain] }));
    const storage = createSupabaseStorageMock({
      isGamblingModeEnabled: vi.fn(async () => ({ ok: true, value: true })),
      createBettingSession: vi.fn(async () => ({
        ok: true,
        value: 'new-session',
      })),
      saveActiveSession: vi.fn(async () => undefined),
      saveScheduledSessions: vi.fn(async () => undefined),
    });

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      pendingChainId: 'already-pending',
      setPendingChainId: vi.fn(),
      currentSessionId: 'current',
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr,
    });

    await handleStartChain(chain.id);

    expect(storage.isGamblingModeEnabled).not.toHaveBeenCalled();
    expect(storage.createBettingSession).not.toHaveBeenCalled();
    expect(storage.saveActiveSession).toHaveBeenCalledTimes(1);
  });

  it('should not probe gambling for local storage and should not reuse a mismatched betting session id', async () => {
    const chain = createUnitChain({ id: 'local-unit', duration: 30 });
    const stateRef = createStateContainer(createAppState({ chains: [chain] }));
    const storage = createLocalStorageMock({
      isGamblingModeEnabled: vi.fn(async () => ({ ok: true, value: true })),
      saveActiveSession: vi.fn(async () => undefined),
      saveScheduledSessions: vi.fn(async () => undefined),
    });

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      pendingChainId: 'different-chain',
      setPendingChainId: vi.fn(),
      currentSessionId: 'should-not-be-used',
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr,
    });

    await handleStartChain(chain.id);

    expect(storage.isGamblingModeEnabled).not.toHaveBeenCalled();
    expect(storage.saveActiveSession).toHaveBeenCalledWith(
      expect.not.objectContaining({ id: 'should-not-be-used' }),
    );
  });

  it('should fall back to normal start when gambling mode is disabled', async () => {
    const chain = createUnitChain({ id: 'unit-gambling-off' });
    const stateRef = createStateContainer(createAppState({ chains: [chain] }));
    const storage = createSupabaseStorageMock({
      isGamblingModeEnabled: vi.fn(async () => ({ ok: true, value: false })),
      createBettingSession: vi.fn(async () => ({
        ok: true,
        value: 'never-called',
      })),
      saveActiveSession: vi.fn(async () => undefined),
      saveScheduledSessions: vi.fn(async () => undefined),
    });

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr,
    });

    await handleStartChain(chain.id);

    expect(storage.createBettingSession).not.toHaveBeenCalled();
    expect(storage.saveActiveSession).toHaveBeenCalledTimes(1);
  });

  it('should not start when gambling is enabled but target chain is missing', async () => {
    const stateRef = createStateContainer(createAppState({ chains: [] }));
    const storage = createSupabaseStorageMock({
      isGamblingModeEnabled: vi.fn(async () => ({ ok: true, value: true })),
      createBettingSession: vi.fn(async () => ({
        ok: true,
        value: 'unexpected',
      })),
      saveActiveSession: vi.fn(async () => undefined),
      saveScheduledSessions: vi.fn(async () => undefined),
    });
    const setPendingChainId = vi.fn();
    const setCurrentSessionId = vi.fn();
    const setShowBettingModal = vi.fn();

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      pendingChainId: null,
      setPendingChainId,
      currentSessionId: null,
      setCurrentSessionId,
      setShowBettingModal,
      tr,
    });

    await handleStartChain('missing-chain');

    expect(storage.createBettingSession).not.toHaveBeenCalled();
    expect(storage.saveActiveSession).not.toHaveBeenCalled();
    expect(setPendingChainId).not.toHaveBeenCalled();
    expect(setCurrentSessionId).not.toHaveBeenCalled();
    expect(setShowBettingModal).not.toHaveBeenCalled();
    expect(stateRef.setState).not.toHaveBeenCalled();
  });

  it('should log gambling mode probe failures and still start normally', async () => {
    const chain = createUnitChain({ id: 'unit-gambling-error' });
    const stateRef = createStateContainer(createAppState({ chains: [chain] }));
    const storage = createSupabaseStorageMock({
      isGamblingModeEnabled: vi.fn(async () => {
        throw new Error('gambling probe failed');
      }),
      saveActiveSession: vi.fn(async () => undefined),
      saveScheduledSessions: vi.fn(async () => undefined),
    });

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr,
    });

    await handleStartChain(chain.id);

    expect(logger.error).toHaveBeenCalledWith(
      'SESSIONS',
      'Failed to check gambling mode',
      undefined,
      expect.any(Error),
    );
    expect(storage.saveActiveSession).toHaveBeenCalledTimes(1);
  });

  it('should fall back to normal start when gambling status check returns error result', async () => {
    const chain = createUnitChain({ id: 'unit-gambling-err-result' });
    const stateRef = createStateContainer(createAppState({ chains: [chain] }));
    const storage = createSupabaseStorageMock({
      isGamblingModeEnabled: vi.fn(async () => ({
        ok: false,
        error: { code: 'READ_ONLY', message: 'blocked', recoverable: true },
      })),
      saveActiveSession: vi.fn(async () => undefined),
      saveScheduledSessions: vi.fn(async () => undefined),
    });
    const onNavigateToFocus = vi.fn();

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      onNavigateToFocus,
      tr,
    });

    await handleStartChain(chain.id);

    expect(storage.createBettingSession).not.toHaveBeenCalled();
    expect(storage.saveActiveSession).toHaveBeenCalledTimes(1);
    expect(onNavigateToFocus).toHaveBeenCalledTimes(1);
  });

  it('should reset an expired group and notify failure', async () => {
    const group = createGroupChain({
      id: 'group-expired',
      name: 'Expired Group',
    });
    const untouched = createUnitChain({ id: 'untouched-chain' });
    const resetGroup = createGroupChain({
      ...group,
      totalFailures: group.totalFailures + 1,
    });
    const stateRef = createStateContainer(
      createAppState({ chains: [group, untouched], chainsRevision: 5 }),
    );
    const storage = createLocalStorageMock();

    vi.mocked(isGroupExpired).mockReturnValue(true);
    vi.mocked(resetGroupProgress).mockReturnValue(resetGroup);

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr,
    });

    await handleStartChain(group.id);

    expect(
      stateRef.getState().chains.find((item) => item.id === group.id)
        ?.totalFailures,
    ).toBe(resetGroup.totalFailures);
    expect(
      stateRef.getState().chains.find((item) => item.id === untouched.id),
    ).toEqual(untouched);
    expect(stateRef.getState().chainsRevision).toBe(6);
    expect(systemNotificationService.notifyTaskFailed).toHaveBeenCalledWith(
      group.name,
      'Group has expired',
    );
  });

  it('should use chinese copy for expired group notifications', async () => {
    const group = createGroupChain({
      id: 'group-expired-zh',
      name: '过期任务群',
    });
    vi.mocked(isGroupExpired).mockReturnValue(true);
    vi.mocked(resetGroupProgress).mockReturnValue(group);
    const handleStartChain = createStartChainHandler({
      state: createAppState({ chains: [group], chainsRevision: 1 }),
      setState: vi.fn(),
      storage: createLocalStorageMock(),
      safelySaveChains: vi.fn(async () => undefined),
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr: zhTr,
    });

    await handleStartChain(group.id);

    expect(systemNotificationService.notifyTaskFailed).toHaveBeenCalledWith(
      group.name,
      '任务群已超时',
    );
  });

  it('should start next unit when group has available child', async () => {
    const group = createGroupChain({
      id: 'group-1',
      name: 'Group',
      timeLimitHours: 2,
      groupStartedAt: undefined,
    });
    const child = createUnitChain({
      id: 'child-1',
      parentId: group.id,
      duration: 33,
    });
    const stateRef = createStateContainer(
      createAppState({ chains: [group, child], chainsRevision: 9 }),
    );
    const storage = createLocalStorageMock({
      saveActiveSession: vi.fn(async () => undefined),
      removeScheduledSession: vi.fn(async () => undefined),
    });
    const safelySaveChains = vi.fn(async () => undefined);

    vi.mocked(queryOptimizer.memoizedBuildChainTree).mockReturnValue([
      {
        id: group.id,
        type: 'group',
        name: group.name,
        children: [{ id: child.id }],
      },
    ] as unknown as ReturnType<typeof queryOptimizer.memoizedBuildChainTree>);
    vi.mocked(isGroupExpired).mockReturnValue(false);
    vi.mocked(getNextUnitInGroup).mockReturnValue({
      id: child.id,
      name: child.name,
    } as never);
    vi.mocked(startGroupTimer).mockImplementation((value) => ({
      ...value,
      groupStartedAt: new Date(),
    }));

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr,
    });

    await handleStartChain(group.id);

    expect(startGroupTimer).toHaveBeenCalledWith(group);
    expect(storage.saveActiveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: child.id,
        duration: child.duration,
      }),
    );
    expect(stateRef.getState().activeSession?.chainId).toBe(child.id);
    expect(stateRef.getState().chainsRevision).toBe(11);
  });

  it('should not start group timer when group already started', async () => {
    const group = createGroupChain({
      id: 'group-started',
      name: 'Started Group',
      timeLimitHours: 2,
      groupStartedAt: new Date('2026-02-01T00:00:00.000Z'),
    });
    const child = createUnitChain({
      id: 'group-started-child',
      parentId: group.id,
    });
    const stateRef = createStateContainer(
      createAppState({ chains: [group, child], chainsRevision: 4 }),
    );
    const storage = createLocalStorageMock({
      saveActiveSession: vi.fn(async () => undefined),
      saveScheduledSessions: vi.fn(async () => undefined),
    });

    vi.mocked(queryOptimizer.memoizedBuildChainTree).mockReturnValue([
      {
        id: group.id,
        type: 'group',
        name: group.name,
        children: [{ id: child.id }],
      },
    ] as unknown as ReturnType<typeof queryOptimizer.memoizedBuildChainTree>);
    vi.mocked(getNextUnitInGroup).mockReturnValue({
      id: child.id,
      name: child.name,
    } as never);

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr,
    });

    await handleStartChain(group.id);

    expect(startGroupTimer).not.toHaveBeenCalled();
    expect(storage.saveActiveSession).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: child.id }),
    );
  });

  it('should complete group cycle and schedule next cycle attempt when no next unit exists', async () => {
    vi.useFakeTimers();

    const group = createGroupChain({
      id: 'group-2',
      name: 'Cycling Group',
      totalCompletions: 2,
    });
    const incremented = createGroupChain({ ...group, totalCompletions: 3 });
    const stateRef = createStateContainer(
      createAppState({ chains: [group], chainsRevision: 1 }),
    );
    const storage = createLocalStorageMock({
      getActiveChains: vi.fn(async () => [incremented]),
    });
    const safelySaveChains = vi.fn(async () => undefined);

    vi.mocked(isGroupExpired).mockReturnValue(false);
    vi.mocked(queryOptimizer.memoizedBuildChainTree).mockReturnValue([
      { id: group.id, type: 'group', name: group.name, children: [] },
    ] as unknown as ReturnType<typeof queryOptimizer.memoizedBuildChainTree>);
    vi.mocked(getNextUnitInGroup).mockReturnValue(null);
    vi.mocked(incrementGroupCompletionCount).mockReturnValue([incremented]);

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr,
    });

    await handleStartChain(group.id);
    await vi.runAllTimersAsync();

    expect(incrementGroupCompletionCount).toHaveBeenCalledWith(
      [group],
      group.id,
    );
    expect(safelySaveChains).toHaveBeenCalledWith([incremented]);
    expect(systemNotificationService.notifyTaskCompleted).toHaveBeenCalledWith(
      incremented.name,
      incremented.totalCompletions,
      'Cycle 3 completed. Starting cycle 4.',
    );
    expect(queryOptimizer.onDataChange).toHaveBeenCalledWith('chains');
  });

  it('should start first unit in next cycle when group is found in fresh chains', async () => {
    vi.useFakeTimers();

    const group = createGroupChain({
      id: 'group-cycle-start',
      name: 'Cycle Start Group',
      totalCompletions: 4,
    });
    const firstUnit = createUnitChain({
      id: 'cycle-first-unit',
      parentId: group.id,
      name: 'Cycle Unit',
    });
    const incremented = createGroupChain({ ...group, totalCompletions: 5 });
    const stateRef = createStateContainer(
      createAppState({ chains: [group, firstUnit], chainsRevision: 3 }),
    );
    const storage = createLocalStorageMock({
      getActiveChains: vi.fn(async () => [group, firstUnit]),
      saveActiveSession: vi.fn(async () => undefined),
      saveScheduledSessions: vi.fn(async () => undefined),
    });
    const safelySaveChains = vi.fn(async () => undefined);

    vi.mocked(queryOptimizer.memoizedBuildChainTree)
      .mockReturnValueOnce([
        { id: group.id, type: 'group', name: group.name, children: [] },
      ] as never)
      .mockReturnValueOnce([
        {
          id: group.id,
          type: 'group',
          name: group.name,
          children: [{ id: firstUnit.id }],
        },
      ] as never);
    vi.mocked(getNextUnitInGroup)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ id: firstUnit.id, name: firstUnit.name } as never);
    vi.mocked(incrementGroupCompletionCount).mockReturnValue([incremented]);

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr,
    });

    await handleStartChain(group.id);
    await vi.runAllTimersAsync();

    expect(storage.getActiveChains).toHaveBeenCalledTimes(1);
    expect(storage.saveActiveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: firstUnit.id,
        duration: firstUnit.duration,
      }),
    );
  });

  it('should publish the exact group cycle lifecycle event', async () => {
    vi.useFakeTimers();

    const group = createGroupChain({
      id: 'group-rsip-event',
      name: 'RSIP Group',
      totalCompletions: 1,
    });
    const incremented = createGroupChain({ ...group, totalCompletions: 2 });
    const stateRef = createStateContainer(
      createAppState({ chains: [group], chainsRevision: 2 }),
    );
    const storage = createLocalStorageMock({
      getActiveChains: vi.fn(async () => [incremented]),
    });
    const taskLifecycleEvents = { publish: vi.fn() };

    vi.mocked(queryOptimizer.memoizedBuildChainTree).mockReturnValue([
      { id: group.id, type: 'group', name: group.name, children: [] },
    ] as never);
    vi.mocked(getNextUnitInGroup).mockReturnValue(null);
    vi.mocked(incrementGroupCompletionCount).mockReturnValue([incremented]);

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      taskLifecycleEvents,
      tr,
    });

    await handleStartChain(group.id);
    await Promise.resolve();
    await Promise.resolve();

    expect(taskLifecycleEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'group_cycle_completed',
        chainId: group.id,
        chainKind: 'group',
      }),
    );
  });

  it('should log when fetching fresh chains for next cycle fails', async () => {
    vi.useFakeTimers();

    const group = createGroupChain({
      id: 'group-cycle-error',
      name: 'Cycle Error Group',
      totalCompletions: 1,
    });
    const incremented = createGroupChain({ ...group, totalCompletions: 2 });
    const stateRef = createStateContainer(
      createAppState({ chains: [group], chainsRevision: 1 }),
    );
    const storage = createLocalStorageMock({
      getActiveChains: vi.fn(async () => {
        throw new Error('read failed');
      }),
    });
    const safelySaveChains = vi.fn(async () => undefined);

    vi.mocked(queryOptimizer.memoizedBuildChainTree).mockReturnValue([
      { id: group.id, type: 'group', name: group.name, children: [] },
    ] as never);
    vi.mocked(getNextUnitInGroup).mockReturnValue(null);
    vi.mocked(incrementGroupCompletionCount).mockReturnValue([incremented]);

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr,
    });

    await handleStartChain(group.id);
    await vi.runAllTimersAsync();

    expect(logger.error).toHaveBeenCalledWith(
      'SESSIONS',
      'Failed to start next cycle first unit',
      { chainId: group.id },
      expect.any(Error),
    );
  });

  it('should log and stop when group node cannot be found in tree', async () => {
    const group = createGroupChain({
      id: 'group-missing-node',
      name: 'Missing Node Group',
    });
    const stateRef = createStateContainer(
      createAppState({ chains: [group], chainsRevision: 6 }),
    );
    const storage = createLocalStorageMock();

    vi.mocked(queryOptimizer.memoizedBuildChainTree).mockReturnValue(
      [] as never,
    );

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr,
    });

    await handleStartChain(group.id);

    expect(logger.error).toHaveBeenCalledWith('SESSIONS', expect.any(String), {
      chainId: group.id,
    });
    expect(stateRef.getState().activeSession).toBeNull();
  });

  it('should log when saving group cycle progress fails', async () => {
    const group = createGroupChain({
      id: 'group-save-fail',
      name: 'Save Fail Group',
      totalCompletions: 7,
    });
    const incremented = createGroupChain({ ...group, totalCompletions: 8 });
    const stateRef = createStateContainer(
      createAppState({ chains: [group], chainsRevision: 2 }),
    );
    const storage = createLocalStorageMock();
    const safelySaveChains = vi.fn(async () => {
      throw new Error('save group cycle failed');
    });

    vi.mocked(queryOptimizer.memoizedBuildChainTree).mockReturnValue([
      { id: group.id, type: 'group', name: group.name, children: [] },
    ] as never);
    vi.mocked(getNextUnitInGroup).mockReturnValue(null);
    vi.mocked(incrementGroupCompletionCount).mockReturnValue([incremented]);

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr,
    });

    await handleStartChain(group.id);

    expect(queryOptimizer.onDataChange).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'SESSIONS',
      expect.any(String),
      undefined,
      expect.any(Error),
    );
  });

  it('should show toast when betting session creation returns error', async () => {
    const chain = createUnitChain({ id: 'unit-err' });
    const storage = createSupabaseStorageMock({
      isGamblingModeEnabled: vi.fn(async () => ({ ok: true, value: true })),
      createBettingSession: vi.fn(async () => ({
        ok: false,
        error: { code: 'FAIL', message: 'nope' },
      })),
      saveActiveSession: vi.fn(async () => undefined),
    });
    const stateRef = createStateContainer(createAppState({ chains: [chain] }));

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr,
    });

    await handleStartChain(chain.id);

    expect(toast.error).toHaveBeenCalledWith(
      'Failed to create betting session: database may be read-only (check console).',
    );
    expect(storage.saveActiveSession).not.toHaveBeenCalled();
  });

  it('should use chinese copy and exact logger payload when betting session creation fails', async () => {
    const chain = createUnitChain({ id: 'unit-err-zh', duration: 15 });
    const storage = createSupabaseStorageMock({
      isGamblingModeEnabled: vi.fn(async () => ({ ok: true, value: true })),
      createBettingSession: vi.fn(async () => ({
        ok: false,
        error: { code: 'FAIL', message: 'nope' },
      })),
      saveActiveSession: vi.fn(async () => undefined),
    });
    const handleStartChain = createStartChainHandler({
      state: createAppState({ chains: [chain] }),
      setState: vi.fn(),
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr: zhTr,
    });

    await handleStartChain(chain.id);

    expect(logger.error).toHaveBeenCalledWith(
      'SESSIONS',
      'Failed to create betting session',
      {
        chainId: chain.id,
        code: 'FAIL',
        message: 'nope',
      },
    );
    expect(toast.error).toHaveBeenCalledWith(
      '无法创建押注会话：数据库可能处于只读状态（查看控制台）',
    );
  });

  it('should show toast and log when active session persistence fails', async () => {
    const chain = createUnitChain({ id: 'persist-active-fail' });
    const stateRef = createStateContainer(createAppState({ chains: [chain] }));
    const storage = createLocalStorageMock({
      saveActiveSession: vi.fn(async () => {
        throw new Error('write denied');
      }),
      saveScheduledSessions: vi.fn(async () => undefined),
    });

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr,
    });

    await handleStartChain(chain.id);
    await flushPromises();

    expect(toast.error).toHaveBeenCalledWith(
      'Failed to persist session: database may be read-only or write is denied (check console).',
    );
    expect(logger.error).toHaveBeenCalledWith(
      'SESSIONS',
      'Failed to persist active session',
      { chainId: chain.id },
      expect.any(Error),
    );
  });

  it('should log when scheduled sessions persistence fails', async () => {
    const chain = createUnitChain({ id: 'persist-schedule-fail' });
    const stateRef = createStateContainer(
      createAppState({
        chains: [chain],
        scheduledSessions: [
          {
            chainId: chain.id,
            scheduledAt: new Date('2026-02-06T10:00:00.000Z'),
            expiresAt: new Date('2026-02-06T10:20:00.000Z'),
            auxiliarySignal: 'signal',
          },
        ],
      }),
    );
    const storage = createLocalStorageMock({
      saveActiveSession: vi.fn(async () => undefined),
      removeScheduledSession: vi.fn(async () => {
        throw new Error('schedule write failed');
      }),
    });

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr,
    });

    await handleStartChain(chain.id);
    await flushPromises();

    expect(logger.error).toHaveBeenCalledWith(
      'SESSIONS',
      'Failed to persist scheduled sessions',
      { chainId: chain.id },
      expect.any(Error),
    );
  });

  it('should log and continue when chains persistence fails after consuming a schedule', async () => {
    const chain = createUnitChain({
      id: 'persist-chains-fail',
      name: 'Persist Chains',
      auxiliaryStreak: 2,
    });
    const stateRef = createStateContainer(
      createAppState({
        chains: [chain],
        scheduledSessions: [
          {
            chainId: chain.id,
            scheduledAt: new Date('2026-02-06T10:00:00.000Z'),
            expiresAt: new Date('2026-02-06T10:20:00.000Z'),
            auxiliarySignal: 's',
          },
        ],
      }),
    );
    const storage = createLocalStorageMock({
      saveActiveSession: vi.fn(async () => undefined),
      saveScheduledSessions: vi.fn(async () => undefined),
    });
    const safelySaveChains = vi.fn(async () => {
      throw new Error('chains save failed');
    });
    const onNavigateToFocus = vi.fn();

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      onNavigateToFocus,
      tr,
    });

    await handleStartChain(chain.id);
    await flushPromises();

    expect(onNavigateToFocus).toHaveBeenCalledTimes(1);
    expect(
      stateRef.getState().chains.find((item) => item.id === chain.id)
        ?.auxiliaryStreak,
    ).toBe(3);
    expect(queryOptimizer.onDataChange).toHaveBeenCalledWith('chains');
    expect(logger.error).toHaveBeenCalledWith(
      'SESSIONS',
      expect.any(String),
      { chainId: chain.id },
      expect.any(Error),
    );
  });

  it('should preserve unrelated schedules and skip notification/persistChains when no matching schedule exists', async () => {
    const chain = createUnitChain({ id: 'plain-chain', name: 'Plain Chain' });
    const otherSchedule = {
      chainId: 'other-chain',
      scheduledAt: new Date('2026-02-06T11:00:00.000Z'),
      expiresAt: new Date('2026-02-06T11:20:00.000Z'),
      auxiliarySignal: 'other',
    };
    const stateRef = createStateContainer(
      createAppState({
        chains: [chain],
        scheduledSessions: [otherSchedule],
      }),
    );
    const storage = createLocalStorageMock({
      saveActiveSession: vi.fn(async () => undefined),
      saveScheduledSessions: vi.fn(async () => undefined),
    });
    const safelySaveChains = vi.fn(async () => undefined);

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr,
    });

    await handleStartChain(chain.id);

    expect(stateRef.getState().scheduledSessions).toEqual([otherSchedule]);
    expect(storage.removeScheduledSession).not.toHaveBeenCalled();
    expect(
      systemNotificationService.notifyTaskCompleted,
    ).not.toHaveBeenCalled();
    expect(safelySaveChains).not.toHaveBeenCalled();
  });

  it('should consume only the matching schedule when other schedules remain', async () => {
    const chain = createUnitChain({
      id: 'scheduled-chain',
      auxiliaryStreak: 4,
      name: 'Scheduled Chain',
    });
    const unrelated = {
      chainId: 'keep-me',
      scheduledAt: new Date('2026-02-06T12:00:00.000Z'),
      expiresAt: new Date('2026-02-06T12:20:00.000Z'),
      auxiliarySignal: 'keep',
    };
    const targetSchedule = {
      chainId: chain.id,
      scheduledAt: new Date('2026-02-06T13:00:00.000Z'),
      expiresAt: new Date('2026-02-06T13:20:00.000Z'),
      auxiliarySignal: 'target',
    };
    const untouched = createUnitChain({ id: 'other-chain' });
    const stateRef = createStateContainer(
      createAppState({
        chains: [chain, untouched],
        scheduledSessions: [unrelated, targetSchedule],
      }),
    );
    const storage = createLocalStorageMock({
      saveActiveSession: vi.fn(async () => undefined),
      saveScheduledSessions: vi.fn(async () => undefined),
    });
    const safelySaveChains = vi.fn(async () => undefined);

    const handleStartChain = createStartChainHandler({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr,
    });

    await handleStartChain(chain.id);

    expect(stateRef.getState().scheduledSessions).toEqual([unrelated]);
    expect(
      stateRef.getState().chains.find((item) => item.id === chain.id)
        ?.auxiliaryStreak,
    ).toBe(5);
    expect(
      stateRef.getState().chains.find((item) => item.id === untouched.id),
    ).toEqual(untouched);
    expect(systemNotificationService.notifyTaskCompleted).toHaveBeenCalledWith(
      chain.name,
      5,
      'Schedule completed',
    );
  });

  it('should return early for missing local chains without persisting anything', async () => {
    const storage = createLocalStorageMock({
      saveActiveSession: vi.fn(async () => undefined),
      removeScheduledSession: vi.fn(async () => undefined),
    });
    const handleStartChain = createStartChainHandler({
      state: createAppState({ chains: [] }),
      setState: vi.fn(),
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      pendingChainId: null,
      setPendingChainId: vi.fn(),
      currentSessionId: null,
      setCurrentSessionId: vi.fn(),
      setShowBettingModal: vi.fn(),
      tr,
    });

    await handleStartChain('missing-local-chain');

    expect(storage.saveActiveSession).not.toHaveBeenCalled();
    expect(storage.removeScheduledSession).not.toHaveBeenCalled();
  });
});
