import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Dispatch, SetStateAction } from 'react';
import type { AppState } from '../../../../types';
import {
  createAppState,
  createGroupChain,
  createLocalStorageMock,
  createSupabaseStorageMock,
  createUnitChain,
} from '../../../../test/factories';
import { createCompletionHandlers } from '../completion';
import { buildChainTree } from '../../../../utils/chainTree';
import { forwardTimerManager } from '../../../../utils/forwardTimer';
import { systemNotificationService } from '../../../../services/platform/SystemNotificationService';
import { emitPointsChanged } from '../../../../utils/pointsEvents';
import {
  incrementGroupCompletionCount,
  isGroupFullyCompleted,
  resetGroupCompletionCount,
} from '../../../../utils/chainTree';
import { logger } from '../../../../utils/logger';

vi.mock('../../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../../utils/forwardTimer', () => ({
  forwardTimerManager: {
    stopTimer: vi.fn(() => 0),
    clearTimer: vi.fn(),
  },
}));

vi.mock('../../../../services/platform/SystemNotificationService', () => ({
  systemNotificationService: {
    notifyTaskCompleted: vi.fn(),
  },
}));

vi.mock('../../../../utils/pointsEvents', () => ({
  emitPointsChanged: vi.fn(),
}));

vi.mock('../../../../utils/chainTree', () => ({
  buildChainTree: vi.fn(() => []),
  incrementGroupCompletionCount: vi.fn((chains) => chains),
  isGroupFullyCompleted: vi.fn(() => false),
  resetGroupCompletionCount: vi.fn((chains) => chains),
}));

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createStateContainer(initialState: AppState) {
  let state = initialState;
  const setState: Dispatch<SetStateAction<AppState>> = (update) => {
    state =
      typeof update === 'function'
        ? (update as (prev: AppState) => AppState)(state)
        : update;
  };
  return {
    getState: () => state,
    setState,
  };
}

describe('createCompletionHandlers', () => {
  const tr = vi.fn((zh: string, _en: string) => zh);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update local state and persist completion when session completes', async () => {
    const group = createGroupChain({
      id: 'group-1',
      name: 'Parent Group',
      currentStreak: 2,
    });
    const chain = createUnitChain({
      id: 'chain-1',
      name: 'Unit 1',
      parentId: group.id,
      currentStreak: 1,
      totalCompletions: 3,
      duration: 25,
    });

    const initialState = createAppState({
      chains: [group, chain],
      activeSession: {
        chainId: chain.id,
        startedAt: new Date('2026-02-01T10:00:00.000Z'),
        duration: 25,
        isPaused: false,
        totalPausedTime: 0,
      },
      completionHistory: [],
    });
    const stateRef = createStateContainer(initialState);

    const storage = createLocalStorageMock({
      appendCompletionHistory: vi.fn(async () => undefined),
      saveActiveSession: vi.fn(async () => undefined),
      updateTaskTimeStats: vi.fn(async () => undefined),
    });
    const safelySaveChains = vi.fn(async () => undefined);
    const setActiveSessionId = vi.fn();
    const onNavigateToDashboard = vi.fn();
    const onTaskLifecycleEvent = vi.fn();

    vi.mocked(buildChainTree).mockReturnValue([
      { id: group.id, type: 'group', name: group.name },
    ] as unknown as ReturnType<typeof buildChainTree>);
    vi.mocked(isGroupFullyCompleted).mockReturnValue(true);
    vi.mocked(incrementGroupCompletionCount).mockImplementation((chains) =>
      chains.map((item) =>
        item.id === group.id
          ? { ...item, currentStreak: item.currentStreak + 1 }
          : item,
      ),
    );

    const { handleCompleteSession } = createCompletionHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      activeSessionId: null,
      setActiveSessionId,
      onNavigateToDashboard,
      onTaskLifecycleEvent,
      tr,
    });

    handleCompleteSession('desc', 'notes');
    await flushPromises();

    const nextState = stateRef.getState();
    const updatedChain = nextState.chains.find((item) => item.id === chain.id);
    expect(updatedChain?.currentStreak).toBe(2);
    expect(updatedChain?.totalCompletions).toBe(4);
    expect(nextState.activeSession).toBeNull();
    expect(onNavigateToDashboard).toHaveBeenCalledTimes(1);
    expect(nextState.completionHistory).toHaveLength(1);
    expect(nextState.completionHistory[0]).toMatchObject({
      chainId: chain.id,
      wasSuccessful: true,
      description: 'desc',
      notes: 'notes',
      actualDuration: 25,
      isForwardTimed: false,
    });

    expect(safelySaveChains).toHaveBeenCalledTimes(1);
    expect(storage.appendCompletionHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: chain.id,
        wasSuccessful: true,
        description: 'desc',
        notes: 'notes',
      }),
    );
    expect(storage.saveActiveSession).toHaveBeenCalledWith(null);
    expect(storage.updateTaskTimeStats).toHaveBeenCalledWith(chain.id, 25);
    expect(systemNotificationService.notifyTaskCompleted).toHaveBeenCalledWith(
      chain.name,
      2,
    );
    expect(setActiveSessionId).toHaveBeenCalledWith(null);
    expect(isGroupFullyCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ id: group.id, type: 'group' }),
    );
    expect(incrementGroupCompletionCount).toHaveBeenCalledWith(
      expect.any(Array),
      group.id,
    );
    expect(logger.debug).toHaveBeenCalledWith('SESSIONS', expect.any(String));
    expect(
      (vi.mocked(logger.debug).mock.calls[0]?.[1] ?? '').length,
    ).toBeGreaterThan(0);
    expect(systemNotificationService.notifyTaskCompleted).toHaveBeenCalledWith(
      group.name,
      expect.any(Number),
      '任务群完成一轮',
    );
    expect(tr).toHaveBeenCalledWith(
      expect.any(String),
      'Group completed a cycle',
    );
    expect(emitPointsChanged).not.toHaveBeenCalled();
    expect(onTaskLifecycleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'task_completed',
        chainId: chain.id,
        chainKind: 'unit',
      }),
    );
    expect(onTaskLifecycleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'group_cycle_completed',
        chainId: group.id,
        chainKind: 'group',
      }),
    );
  });

  it('should skip group cycle checks when completed chain has no parent group', async () => {
    const chain = createUnitChain({
      id: 'no-parent-chain',
      parentId: undefined,
      currentStreak: 1,
      totalCompletions: 2,
    });

    const stateRef = createStateContainer(
      createAppState({
        chains: [chain],
        activeSession: {
          chainId: chain.id,
          startedAt: new Date('2026-02-01T10:10:00.000Z'),
          duration: 20,
          isPaused: false,
          totalPausedTime: 0,
        },
      }),
    );

    const storage = createLocalStorageMock({
      appendCompletionHistory: vi.fn(async () => undefined),
      saveActiveSession: vi.fn(async () => undefined),
      updateTaskTimeStats: vi.fn(async () => undefined),
    });

    const { handleCompleteSession } = createCompletionHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      activeSessionId: null,
      setActiveSessionId: vi.fn(),
      tr,
    });

    handleCompleteSession();
    await flushPromises();

    expect(buildChainTree).not.toHaveBeenCalled();
    expect(isGroupFullyCompleted).not.toHaveBeenCalled();
    expect(incrementGroupCompletionCount).not.toHaveBeenCalled();
    expect(tr).not.toHaveBeenCalled();
  });

  it('should not increment group cycle when parent group is incomplete', async () => {
    const group = createGroupChain({
      id: 'incomplete-group',
      name: 'Incomplete Group',
    });
    const chain = createUnitChain({
      id: 'incomplete-unit',
      parentId: group.id,
    });
    const stateRef = createStateContainer(
      createAppState({
        chains: [group, chain],
        activeSession: {
          chainId: chain.id,
          startedAt: new Date('2026-02-01T10:20:00.000Z'),
          duration: 20,
          isPaused: false,
          totalPausedTime: 0,
        },
      }),
    );
    const storage = createLocalStorageMock({
      appendCompletionHistory: vi.fn(async () => undefined),
      saveActiveSession: vi.fn(async () => undefined),
      updateTaskTimeStats: vi.fn(async () => undefined),
    });

    vi.mocked(buildChainTree).mockReturnValue([
      { id: group.id, type: 'group', name: group.name },
    ] as unknown as ReturnType<typeof buildChainTree>);
    vi.mocked(isGroupFullyCompleted).mockReturnValue(false);

    const { handleCompleteSession } = createCompletionHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      activeSessionId: null,
      setActiveSessionId: vi.fn(),
      tr,
    });

    handleCompleteSession();
    await flushPromises();

    expect(isGroupFullyCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ id: group.id }),
    );
    expect(incrementGroupCompletionCount).not.toHaveBeenCalled();
    expect(tr).not.toHaveBeenCalled();
  });

  it('should skip parent group completion notification when parent chain is missing after increment', async () => {
    const group = createGroupChain({
      id: 'missing-parent-group',
      name: 'Missing Parent Group',
    });
    const chain = createUnitChain({
      id: 'missing-parent-unit',
      parentId: group.id,
      currentStreak: 2,
    });
    const stateRef = createStateContainer(
      createAppState({
        chains: [group, chain],
        activeSession: {
          chainId: chain.id,
          startedAt: new Date('2026-02-01T10:30:00.000Z'),
          duration: 20,
          isPaused: false,
          totalPausedTime: 0,
        },
      }),
    );
    const storage = createLocalStorageMock({
      appendCompletionHistory: vi.fn(async () => undefined),
      saveActiveSession: vi.fn(async () => undefined),
      updateTaskTimeStats: vi.fn(async () => undefined),
    });

    vi.mocked(buildChainTree).mockReturnValue([
      { id: group.id, type: 'group', name: group.name },
    ] as unknown as ReturnType<typeof buildChainTree>);
    vi.mocked(isGroupFullyCompleted).mockReturnValue(true);
    vi.mocked(incrementGroupCompletionCount).mockReturnValue(
      stateRef
        .getState()
        .chains.filter((item) => item.id !== group.id)
        .map((item) =>
          item.id === chain.id
            ? { ...item, currentStreak: item.currentStreak + 1 }
            : item,
        ),
    );

    const { handleCompleteSession } = createCompletionHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      activeSessionId: null,
      setActiveSessionId: vi.fn(),
      tr,
    });

    handleCompleteSession();
    await flushPromises();

    expect(incrementGroupCompletionCount).toHaveBeenCalledWith(
      expect.any(Array),
      group.id,
    );
    expect(systemNotificationService.notifyTaskCompleted).toHaveBeenCalledWith(
      chain.name,
      3,
    );
    expect(systemNotificationService.notifyTaskCompleted).toHaveBeenCalledTimes(
      1,
    );
    expect(tr).not.toHaveBeenCalled();
  });

  it('should only update the completed chain and keep sibling chains untouched', async () => {
    const completed = createUnitChain({
      id: 'completed-chain',
      name: 'Completed',
      currentStreak: 1,
      totalCompletions: 2,
    });
    const untouched = createUnitChain({
      id: 'untouched-chain',
      name: 'Untouched',
      currentStreak: 9,
      totalCompletions: 99,
    });

    const stateRef = createStateContainer(
      createAppState({
        chains: [completed, untouched],
        activeSession: {
          chainId: completed.id,
          startedAt: new Date('2026-02-01T10:00:00.000Z'),
          duration: 20,
          isPaused: false,
          totalPausedTime: 0,
        },
      }),
    );

    const storage = createLocalStorageMock({
      appendCompletionHistory: vi.fn(async () => undefined),
      saveActiveSession: vi.fn(async () => undefined),
      updateTaskTimeStats: vi.fn(async () => undefined),
    });

    const { handleCompleteSession } = createCompletionHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      activeSessionId: null,
      setActiveSessionId: vi.fn(),
      tr,
    });

    handleCompleteSession();
    await flushPromises();

    const nextState = stateRef.getState();
    const completedNext = nextState.chains.find(
      (item) => item.id === completed.id,
    );
    const untouchedNext = nextState.chains.find(
      (item) => item.id === untouched.id,
    );

    expect(completedNext).toMatchObject({
      currentStreak: 2,
      totalCompletions: 3,
    });
    expect(untouchedNext).toMatchObject({
      currentStreak: 9,
      totalCompletions: 99,
    });
    expect(buildChainTree).not.toHaveBeenCalled();
    expect(incrementGroupCompletionCount).not.toHaveBeenCalled();
  });

  it('should use forward timer for durationless chains and invoke pet callback', async () => {
    const chain = createUnitChain({
      id: 'durationless-chain',
      isDurationless: true,
      duration: 0,
      currentStreak: 0,
    });
    const initialState = createAppState({
      chains: [chain],
      activeSession: {
        chainId: chain.id,
        startedAt: new Date('2026-02-01T11:00:00.000Z'),
        duration: 0,
        isPaused: false,
        totalPausedTime: 0,
      },
    });
    const stateRef = createStateContainer(initialState);

    const storage = createLocalStorageMock({
      appendCompletionHistory: vi.fn(async () => undefined),
      saveActiveSession: vi.fn(async () => undefined),
      updateTaskTimeStats: vi.fn(async () => undefined),
    });
    const safelySaveChains = vi.fn(async () => undefined);
    const onPetTaskCompleted = vi.fn();

    vi.mocked(forwardTimerManager.stopTimer).mockReturnValue(125);

    const { handleCompleteSession } = createCompletionHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      activeSessionId: null,
      setActiveSessionId: vi.fn(),
      onPetTaskCompleted,
      tr,
    });

    handleCompleteSession();
    await flushPromises();

    expect(forwardTimerManager.stopTimer).toHaveBeenCalledWith(
      `${chain.id}_${initialState.activeSession?.startedAt.getTime()}`,
    );
    expect(storage.updateTaskTimeStats).toHaveBeenCalledWith(chain.id, 3);
    expect(onPetTaskCompleted).toHaveBeenCalledWith(3, true);
    expect(stateRef.getState().completionHistory[0].actualDuration).toBe(3);
    expect(stateRef.getState().completionHistory[0].isForwardTimed).toBe(true);
  });

  it('should not persist task-time stats or pet callback when actual duration is zero', async () => {
    const chain = createUnitChain({
      id: 'zero-duration-chain',
      currentStreak: 4,
      duration: 0,
    });
    const stateRef = createStateContainer(
      createAppState({
        chains: [chain],
        activeSession: {
          chainId: chain.id,
          startedAt: new Date('2026-02-01T11:30:00.000Z'),
          duration: 0,
          isPaused: false,
          totalPausedTime: 0,
        },
      }),
    );
    const storage = createLocalStorageMock({
      appendCompletionHistory: vi.fn(async () => undefined),
      saveActiveSession: vi.fn(async () => undefined),
      updateTaskTimeStats: vi.fn(async () => undefined),
    });
    const onPetTaskCompleted = vi.fn();

    const { handleCompleteSession } = createCompletionHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      activeSessionId: null,
      setActiveSessionId: vi.fn(),
      onPetTaskCompleted,
      tr,
    });

    handleCompleteSession();
    await flushPromises();

    expect(storage.updateTaskTimeStats).not.toHaveBeenCalled();
    expect(onPetTaskCompleted).not.toHaveBeenCalled();
    expect(stateRef.getState().completionHistory[0]?.actualDuration).toBe(0);
  });

  it('should persist supabase completion and clear active session with points emit', async () => {
    const chain = createUnitChain({ id: 'supa-chain', currentStreak: 10 });
    const initialState = createAppState({
      chains: [chain],
      activeSession: {
        chainId: chain.id,
        startedAt: new Date('2026-02-01T12:00:00.000Z'),
        duration: 15,
        isPaused: false,
        totalPausedTime: 0,
      },
    });
    const stateRef = createStateContainer(initialState);

    const storage = createSupabaseStorageMock({
      appendCompletionHistory: vi.fn(async () => undefined),
      saveActiveSession: vi.fn(async () => undefined),
    });
    const setActiveSessionId = vi.fn();
    const safelySaveChains = vi.fn(async () => undefined);

    const { handleCompleteSession } = createCompletionHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      activeSessionId: 'session-id',
      setActiveSessionId,
      tr,
    });

    handleCompleteSession();
    await flushPromises();

    expect(storage.appendCompletionHistory).toHaveBeenCalledTimes(1);
    const persisted = vi.mocked(storage.appendCompletionHistory).mock
      .calls[0]?.[0];
    expect(persisted).toMatchObject({
      chainId: chain.id,
      wasSuccessful: true,
    });
    expect(storage.saveActiveSession).toHaveBeenCalledWith(null);
    expect(setActiveSessionId).toHaveBeenCalledWith(null);
    expect(emitPointsChanged).toHaveBeenCalledTimes(1);
  });

  it('should avoid supabase cleanup helper when activeSessionId is null', async () => {
    const chain = createUnitChain({
      id: 'supabase-no-active-id',
      currentStreak: 1,
    });
    const existingRecord = {
      chainId: 'old-record',
      completedAt: new Date('2026-01-01T10:00:00.000Z'),
      duration: 10,
      wasSuccessful: true,
      actualDuration: 10,
      isForwardTimed: false,
    };
    const stateRef = createStateContainer(
      createAppState({
        chains: [chain],
        completionHistory: [existingRecord],
        activeSession: {
          chainId: chain.id,
          startedAt: new Date('2026-02-01T12:00:00.000Z'),
          duration: 15,
          isPaused: false,
          totalPausedTime: 0,
        },
      }),
    );
    const storage = createSupabaseStorageMock({
      appendCompletionHistory: vi.fn(async () => undefined),
      saveActiveSession: vi.fn(async () => undefined),
    });
    const setActiveSessionId = vi.fn();

    const { handleCompleteSession } = createCompletionHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      activeSessionId: null,
      setActiveSessionId,
      tr,
    });

    handleCompleteSession();
    await flushPromises();

    expect(setActiveSessionId).toHaveBeenCalledWith(null);
    expect(emitPointsChanged).not.toHaveBeenCalled();
    expect(storage.appendCompletionHistory).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: chain.id, wasSuccessful: true }),
    );
  });

  it('should keep local cleanup path when activeSessionId is set', async () => {
    const chain = createUnitChain({ id: 'local-active-id' });
    const existingRecord = {
      chainId: 'old-record',
      completedAt: new Date('2026-01-01T10:00:00.000Z'),
      duration: 8,
      wasSuccessful: true,
      actualDuration: 8,
      isForwardTimed: false,
    };
    const stateRef = createStateContainer(
      createAppState({
        chains: [chain],
        completionHistory: [existingRecord],
        activeSession: {
          chainId: chain.id,
          startedAt: new Date('2026-02-01T12:30:00.000Z'),
          duration: 15,
          isPaused: false,
          totalPausedTime: 0,
        },
      }),
    );
    const storage = createLocalStorageMock({
      appendCompletionHistory: vi.fn(async () => undefined),
      saveActiveSession: vi.fn(async () => undefined),
      updateTaskTimeStats: vi.fn(async () => undefined),
    });

    const { handleCompleteSession } = createCompletionHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      activeSessionId: 'local-session-id',
      setActiveSessionId: vi.fn(),
      tr,
    });

    handleCompleteSession();
    await flushPromises();

    const persisted = vi.mocked(storage.appendCompletionHistory).mock
      .calls[0]?.[0];
    expect(persisted).toMatchObject({
      chainId: chain.id,
      wasSuccessful: true,
    });
    expect(emitPointsChanged).not.toHaveBeenCalled();
  });

  it('should keep only one history record for supabase persistence even with prior local history', async () => {
    const chain = createUnitChain({ id: 'supabase-history-slice' });
    const existingRecord = {
      chainId: 'old-record',
      completedAt: new Date('2026-01-01T10:00:00.000Z'),
      duration: 9,
      wasSuccessful: true,
      actualDuration: 9,
      isForwardTimed: false,
    };
    const stateRef = createStateContainer(
      createAppState({
        chains: [chain],
        completionHistory: [existingRecord],
        activeSession: {
          chainId: chain.id,
          startedAt: new Date('2026-02-01T12:40:00.000Z'),
          duration: 15,
          isPaused: false,
          totalPausedTime: 0,
        },
      }),
    );
    const storage = createSupabaseStorageMock({
      appendCompletionHistory: vi.fn(async () => undefined),
      saveActiveSession: vi.fn(async () => undefined),
    });

    const { handleCompleteSession } = createCompletionHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      activeSessionId: 'supabase-session-id',
      setActiveSessionId: vi.fn(),
      tr,
    });

    handleCompleteSession();
    await flushPromises();

    const persisted = vi.mocked(storage.appendCompletionHistory).mock
      .calls[0]?.[0];
    expect(persisted).toMatchObject({
      chainId: chain.id,
      wasSuccessful: true,
    });
    expect(stateRef.getState().completionHistory).toHaveLength(2);
  });

  it('should emit cleanup side-effects even when supabase persistence fails', async () => {
    const chain = createUnitChain({ id: 'supa-fail-chain', currentStreak: 2 });
    const initialState = createAppState({
      chains: [chain],
      activeSession: {
        chainId: chain.id,
        startedAt: new Date('2026-02-01T12:00:00.000Z'),
        duration: 15,
        isPaused: false,
        totalPausedTime: 0,
      },
    });
    const stateRef = createStateContainer(initialState);

    const storage = createSupabaseStorageMock({
      appendCompletionHistory: vi.fn(async () => {
        throw new Error('history failed');
      }),
      saveActiveSession: vi.fn(async () => {
        throw new Error('active session failed');
      }),
    });

    const setActiveSessionId = vi.fn();
    const { handleCompleteSession } = createCompletionHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      activeSessionId: 'supabase-session-id',
      setActiveSessionId,
      tr,
    });

    handleCompleteSession();
    await flushPromises();

    expect(setActiveSessionId).toHaveBeenCalledWith(null);
    expect(emitPointsChanged).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'SESSIONS',
      'Failed to persist completion history after completion',
      undefined,
      expect.any(Error),
    );
    expect(logger.error).toHaveBeenCalledWith(
      'SESSIONS',
      'Failed to clear active session after completion',
      undefined,
      expect.any(Error),
    );
  });

  it('should log unexpected supabase cleanup errors from cleanup callback', async () => {
    const chain = createUnitChain({
      id: 'supa-unexpected-chain',
      currentStreak: 2,
    });
    const initialState = createAppState({
      chains: [chain],
      activeSession: {
        chainId: chain.id,
        startedAt: new Date('2026-02-01T12:00:00.000Z'),
        duration: 15,
        isPaused: false,
        totalPausedTime: 0,
      },
    });
    const stateRef = createStateContainer(initialState);

    const storage = createSupabaseStorageMock({
      appendCompletionHistory: vi.fn(async () => undefined),
      saveActiveSession: vi.fn(async () => undefined),
    });

    const setActiveSessionId = vi.fn(() => {
      throw new Error('set active session id failed');
    });
    const { handleCompleteSession } = createCompletionHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      activeSessionId: 'supabase-session-id',
      setActiveSessionId,
      tr,
    });

    handleCompleteSession();
    await flushPromises();

    expect(logger.error).toHaveBeenCalledWith(
      'SESSIONS',
      'Unexpected completion cleanup error',
      undefined,
      expect.any(Error),
    );
  });

  it('should reset streak and clear timer when interrupting a durationless session', async () => {
    const chain = createUnitChain({
      id: 'interrupt-chain',
      isDurationless: true,
      currentStreak: 6,
      totalFailures: 2,
      parentId: 'group-9',
    });
    const untouched = createUnitChain({
      id: 'interrupt-untouched',
      currentStreak: 7,
      totalFailures: 1,
    });
    const initialState = createAppState({
      chains: [chain, untouched],
      activeSession: {
        chainId: chain.id,
        startedAt: new Date('2026-02-01T13:00:00.000Z'),
        duration: 20,
        isPaused: false,
        totalPausedTime: 0,
      },
    });
    const stateRef = createStateContainer(initialState);
    const storage = createLocalStorageMock({
      appendCompletionHistory: vi.fn(async () => undefined),
      saveActiveSession: vi.fn(async () => undefined),
    });
    const safelySaveChains = vi.fn(async () => undefined);
    const onNavigateToDashboard = vi.fn();
    const onTaskLifecycleEvent = vi.fn();

    vi.mocked(resetGroupCompletionCount).mockImplementation((chains) => chains);

    const { handleInterruptSession } = createCompletionHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      activeSessionId: null,
      setActiveSessionId: vi.fn(),
      onNavigateToDashboard,
      onTaskLifecycleEvent,
      tr,
    });

    handleInterruptSession('manual-stop');
    await flushPromises();

    expect(forwardTimerManager.clearTimer).toHaveBeenCalledWith(
      `${chain.id}_${initialState.activeSession?.startedAt.getTime()}`,
    );
    const nextState = stateRef.getState();
    const updated = nextState.chains.find((item) => item.id === chain.id);
    const untouchedAfter = nextState.chains.find(
      (item) => item.id === untouched.id,
    );
    expect(updated?.currentStreak).toBe(0);
    expect(updated?.totalFailures).toBe(3);
    expect(untouchedAfter).toMatchObject({
      currentStreak: 7,
      totalFailures: 1,
    });
    expect(nextState.activeSession).toBeNull();
    expect(onNavigateToDashboard).toHaveBeenCalledTimes(1);
    expect(nextState.completionHistory.at(-1)).toMatchObject({
      chainId: chain.id,
      wasSuccessful: false,
      reasonForFailure: 'manual-stop',
    });
    expect(resetGroupCompletionCount).toHaveBeenCalledWith(
      expect.any(Array),
      'group-9',
    );
    expect(logger.debug).toHaveBeenCalledWith('SESSIONS', expect.any(String));
    expect(
      (vi.mocked(logger.debug).mock.calls.at(-1)?.[1] ?? '').length,
    ).toBeGreaterThan(0);
    expect(onTaskLifecycleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'task_interrupted',
        chainId: chain.id,
        chainKind: 'unit',
      }),
    );
  });

  it('should use default interrupt reason when reason is not provided', async () => {
    const chain = createUnitChain({
      id: 'interrupt-default-reason',
      isDurationless: false,
      currentStreak: 3,
      totalFailures: 1,
    });

    const stateRef = createStateContainer(
      createAppState({
        chains: [chain],
        activeSession: {
          chainId: chain.id,
          startedAt: new Date('2026-02-01T13:00:00.000Z'),
          duration: 20,
          isPaused: false,
          totalPausedTime: 0,
        },
      }),
    );

    const onNavigateToDashboard = vi.fn();
    const { handleInterruptSession } = createCompletionHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage: createLocalStorageMock({
        appendCompletionHistory: vi.fn(async () => undefined),
        saveActiveSession: vi.fn(async () => undefined),
      }),
      safelySaveChains: vi.fn(async () => undefined),
      activeSessionId: null,
      setActiveSessionId: vi.fn(),
      onNavigateToDashboard,
      tr,
    });

    handleInterruptSession();
    await flushPromises();

    expect(forwardTimerManager.clearTimer).not.toHaveBeenCalled();
    expect(onNavigateToDashboard).toHaveBeenCalledTimes(1);
    expect(stateRef.getState().completionHistory.at(-1)?.reasonForFailure).toBe(
      '用户主动中断',
    );
  });

  it('should not reset group completion count when interrupted chain itself is a group', async () => {
    const group = createGroupChain({
      id: 'group-self',
      parentId: 'parent-group',
      currentStreak: 4,
      totalFailures: 2,
    });

    const stateRef = createStateContainer(
      createAppState({
        chains: [group],
        activeSession: {
          chainId: group.id,
          startedAt: new Date('2026-02-01T13:00:00.000Z'),
          duration: 20,
          isPaused: false,
          totalPausedTime: 0,
        },
      }),
    );

    const { handleInterruptSession } = createCompletionHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage: createLocalStorageMock({
        appendCompletionHistory: vi.fn(async () => undefined),
        saveActiveSession: vi.fn(async () => undefined),
      }),
      safelySaveChains: vi.fn(async () => undefined),
      activeSessionId: null,
      setActiveSessionId: vi.fn(),
      tr,
    });

    handleInterruptSession('group-fail');
    await flushPromises();

    expect(resetGroupCompletionCount).not.toHaveBeenCalled();
  });

  it('should log non-empty chain persistence context when interrupt persistence fails', async () => {
    const chain = createUnitChain({
      id: 'interrupt-save-fail',
      parentId: 'group-z',
    });
    const stateRef = createStateContainer(
      createAppState({
        chains: [chain],
        activeSession: {
          chainId: chain.id,
          startedAt: new Date('2026-02-01T13:10:00.000Z'),
          duration: 20,
          isPaused: false,
          totalPausedTime: 0,
        },
      }),
    );

    const { handleInterruptSession } = createCompletionHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage: createLocalStorageMock({
        appendCompletionHistory: vi.fn(async () => undefined),
        saveActiveSession: vi.fn(async () => undefined),
      }),
      safelySaveChains: vi.fn(async () => {
        throw new Error('interrupt chain save failed');
      }),
      activeSessionId: null,
      setActiveSessionId: vi.fn(),
      tr,
    });

    handleInterruptSession('manual');
    await flushPromises();
    const interruptErrorCall = vi
      .mocked(logger.error)
      .mock.calls.find(
        (call) => call[0] === 'SESSIONS' && typeof call[1] === 'string',
      );
    expect(interruptErrorCall?.[1]).toEqual(expect.any(String));
    expect((interruptErrorCall?.[1] as string).length).toBeGreaterThan(0);
  });

  it('should no-op when completing or interrupting without active session / chain', async () => {
    const chain = createUnitChain({ id: 'valid-chain' });
    const stateRefNoSession = createStateContainer(
      createAppState({ chains: [chain], activeSession: null }),
    );
    const storage = createLocalStorageMock({
      appendCompletionHistory: vi.fn(async () => undefined),
      saveActiveSession: vi.fn(async () => undefined),
    });

    const noSessionHandlers = createCompletionHandlers({
      state: stateRefNoSession.getState(),
      setState: stateRefNoSession.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      activeSessionId: null,
      setActiveSessionId: vi.fn(),
      tr,
    });

    noSessionHandlers.handleCompleteSession();
    noSessionHandlers.handleInterruptSession('reason');
    await flushPromises();

    expect(storage.appendCompletionHistory).not.toHaveBeenCalled();
    expect(stateRefNoSession.getState().completionHistory).toHaveLength(0);

    const stateRefMissingChain = createStateContainer(
      createAppState({
        chains: [chain],
        activeSession: {
          chainId: 'missing-chain-id',
          startedAt: new Date('2026-02-01T13:00:00.000Z'),
          duration: 20,
          isPaused: false,
          totalPausedTime: 0,
        },
      }),
    );
    const missingChainHandlers = createCompletionHandlers({
      state: stateRefMissingChain.getState(),
      setState: stateRefMissingChain.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      activeSessionId: null,
      setActiveSessionId: vi.fn(),
      tr,
    });

    missingChainHandlers.handleCompleteSession();
    missingChainHandlers.handleInterruptSession();
    await flushPromises();

    expect(stateRefMissingChain.getState().completionHistory).toHaveLength(0);
  });

  it('should persist full interrupt history for local storage when activeSessionId is present', async () => {
    const chain = createUnitChain({
      id: 'local-interrupt-history',
      currentStreak: 5,
      totalFailures: 1,
    });
    const existingRecord = {
      chainId: 'old-failure',
      completedAt: new Date('2026-01-31T10:00:00.000Z'),
      duration: 20,
      wasSuccessful: false,
      reasonForFailure: 'old',
      actualDuration: 20,
      isForwardTimed: false,
    };
    const stateRef = createStateContainer(
      createAppState({
        chains: [chain],
        completionHistory: [existingRecord],
        activeSession: {
          chainId: chain.id,
          startedAt: new Date('2026-02-01T15:00:00.000Z'),
          duration: 30,
          isPaused: false,
          totalPausedTime: 0,
        },
      }),
    );
    const storage = createLocalStorageMock({
      appendCompletionHistory: vi.fn(async () => undefined),
      saveActiveSession: vi.fn(async () => undefined),
    });

    const { handleInterruptSession } = createCompletionHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      activeSessionId: 'local-active-id',
      setActiveSessionId: vi.fn(),
      tr,
    });

    handleInterruptSession('manual-stop');
    await flushPromises();

    const persisted = vi.mocked(storage.appendCompletionHistory).mock
      .calls[0]?.[0];
    expect(persisted).toMatchObject({
      chainId: chain.id,
      wasSuccessful: false,
      reasonForFailure: 'manual-stop',
    });
    expect(emitPointsChanged).not.toHaveBeenCalled();
  });

  it('should persist only one interrupt history record for supabase sessions', async () => {
    const chain = createUnitChain({
      id: 'supa-interrupt-chain',
      currentStreak: 5,
      totalFailures: 1,
    });
    const existingRecord = {
      chainId: 'old-record',
      completedAt: new Date('2026-01-31T10:00:00.000Z'),
      duration: 10,
      wasSuccessful: true,
      actualDuration: 10,
      isForwardTimed: false,
    };
    const stateRef = createStateContainer(
      createAppState({
        chains: [chain],
        completionHistory: [existingRecord],
        activeSession: {
          chainId: chain.id,
          startedAt: new Date('2026-02-01T15:00:00.000Z'),
          duration: 30,
          isPaused: false,
          totalPausedTime: 0,
        },
      }),
    );

    const storage = createSupabaseStorageMock({
      appendCompletionHistory: vi.fn(async () => undefined),
      saveActiveSession: vi.fn(async () => undefined),
    });
    const setActiveSessionId = vi.fn();

    const { handleInterruptSession } = createCompletionHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains: vi.fn(async () => undefined),
      activeSessionId: 'supabase-session-id',
      setActiveSessionId,
      tr,
    });

    handleInterruptSession('manual-stop');
    await flushPromises();

    const persisted = vi.mocked(storage.appendCompletionHistory).mock
      .calls[0]?.[0];
    expect(persisted).toMatchObject({
      chainId: chain.id,
      wasSuccessful: false,
      reasonForFailure: 'manual-stop',
    });
    expect(stateRef.getState().completionHistory).toHaveLength(2);
    expect(setActiveSessionId).toHaveBeenCalledWith(null);
    expect(emitPointsChanged).toHaveBeenCalled();
  });

  it('should still update state when persistence fails', async () => {
    const chain = createUnitChain({
      id: 'persist-fail-chain',
      currentStreak: 0,
    });
    const initialState = createAppState({
      chains: [chain],
      activeSession: {
        chainId: chain.id,
        startedAt: new Date('2026-02-01T14:00:00.000Z'),
        duration: 10,
        isPaused: false,
        totalPausedTime: 0,
      },
    });
    const stateRef = createStateContainer(initialState);
    const storage = createLocalStorageMock({
      appendCompletionHistory: vi.fn(async () => {
        throw new Error('history fail');
      }),
      saveActiveSession: vi.fn(async () => {
        throw new Error('session fail');
      }),
      updateTaskTimeStats: vi.fn(async () => {
        throw new Error('stats fail');
      }),
    });
    const safelySaveChains = vi.fn(async () => {
      throw new Error('chain fail');
    });

    const { handleCompleteSession } = createCompletionHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      activeSessionId: null,
      setActiveSessionId: vi.fn(),
      tr,
    });

    handleCompleteSession();
    await flushPromises();

    expect(stateRef.getState().activeSession).toBeNull();
    expect(stateRef.getState().completionHistory).toHaveLength(1);
    expect(logger.error).toHaveBeenCalledWith(
      'SESSIONS',
      'Failed to persist completion history after completion',
      undefined,
      expect.any(Error),
    );
    expect(logger.error).toHaveBeenCalledWith(
      'SESSIONS',
      'Failed to clear active session after completion',
      undefined,
      expect.any(Error),
    );
    expect(logger.error).toHaveBeenCalledWith(
      'SESSIONS',
      'Failed to update task time stats after completion',
      { chainId: chain.id },
      expect.any(Error),
    );
    expect(logger.error).toHaveBeenCalledWith(
      'SESSIONS',
      expect.stringContaining('保存链条'),
      undefined,
      expect.any(Error),
    );
  });
});
