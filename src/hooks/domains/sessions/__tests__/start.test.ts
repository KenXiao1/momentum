import { createTranslator } from '../../../../i18n/translate';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { AppState } from '../../../../types';
import {
  createAppState,
  createGroupChain,
  createLocalStorageMock,
  createSupabaseStorageMock,
  createTestStorage,
  createUnitChain,
} from '../../../../test/factories';
import type { MomentumStorage } from '../../../../storage/MomentumStorage';
import { createStartChainHandler } from '../start';
import { logger } from '../../../../utils/logger';
import { systemNotificationService } from '../../../../services/platform/SystemNotificationService';
import { toast } from '../../../../utils/toast';
vi.mock('../../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
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
  const t = createTranslator('en');
  const zhTr = createTranslator('zh');

  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-02-02T08:00:00.000Z'));
    vi.clearAllMocks();
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
      t,
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
      t,
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
      t,
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
      isGamblingModeEnabled: vi.fn(async () => ({
        ok: true as const,
        value: true,
      })),
      createBettingSession: vi.fn(async () => ({
        ok: true as const,
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
      t,
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
      isGamblingModeEnabled: vi.fn(async () => ({
        ok: true as const,
        value: true,
      })),
      createBettingSession: vi.fn(async () => ({
        ok: true as const,
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
      t,
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
      isGamblingModeEnabled: vi.fn(async () => ({
        ok: true as const,
        value: true,
      })),
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
      t,
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
      isGamblingModeEnabled: vi.fn(async () => ({
        ok: true as const,
        value: false,
      })),
      createBettingSession: vi.fn(async () => ({
        ok: true as const,
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
      t,
    });

    await handleStartChain(chain.id);

    expect(storage.createBettingSession).not.toHaveBeenCalled();
    expect(storage.saveActiveSession).toHaveBeenCalledTimes(1);
  });

  it('should not start when gambling is enabled but target chain is missing', async () => {
    const stateRef = createStateContainer(createAppState({ chains: [] }));
    const storage = createSupabaseStorageMock({
      isGamblingModeEnabled: vi.fn(async () => ({
        ok: true as const,
        value: true,
      })),
      createBettingSession: vi.fn(async () => ({
        ok: true as const,
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
      t,
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
      t,
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
        ok: false as const,
        error: {
          code: 'STORAGE' as const,
          message: 'blocked',
          recoverable: true,
        },
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
      t,
    });

    await handleStartChain(chain.id);

    expect(storage.createBettingSession).not.toHaveBeenCalled();
    expect(storage.saveActiveSession).toHaveBeenCalledTimes(1);
    expect(onNavigateToFocus).toHaveBeenCalledTimes(1);
  });

  describe('starting a task group (real tree and time-limit rules)', () => {
    const NOW = new Date('2026-02-02T08:00:00.000Z');

    function startGroup(params: {
      chains: AppState['chains'];
      storage?: MomentumStorage;
      safelySaveChains?: (chains: AppState['chains']) => Promise<void>;
      onTaskLifecycleEvent?: () => void;
      translator?: typeof t;
    }) {
      const stateRef = createStateContainer(
        createAppState({ chains: params.chains }),
      );
      const storage = params.storage ?? createTestStorage();
      const handleStartChain = createStartChainHandler({
        getState: stateRef.getState,
        setState: stateRef.setState,
        storage,
        safelySaveChains:
          params.safelySaveChains ?? ((chains) => storage.saveChains(chains)),
        pendingChainId: null,
        setPendingChainId: vi.fn(),
        currentSessionId: null,
        setCurrentSessionId: vi.fn(),
        setShowBettingModal: vi.fn(),
        onTaskLifecycleEvent: params.onTaskLifecycleEvent,
        t: params.translator ?? t,
      });
      const chain = (id: string) =>
        stateRef.getState().chains.find((item) => item.id === id);
      return { handleStartChain, stateRef, storage, chain };
    }

    const expiredGroup = (overrides = {}) =>
      createGroupChain({
        id: 'expired',
        name: 'Expired Group',
        timeLimitHours: 2,
        groupStartedAt: new Date('2026-02-02T05:00:00.000Z'),
        currentStreak: 3,
        totalFailures: 1,
        ...overrides,
      });

    it('resets an expired group, counts a failure and starts nothing', async () => {
      const untouched = createUnitChain({ id: 'untouched' });
      const unit = createUnitChain({ id: 'unit', parentId: 'expired' });
      const { handleStartChain, stateRef, storage, chain } = startGroup({
        chains: [expiredGroup(), unit, untouched],
      });

      await handleStartChain('expired');

      expect(chain('expired')).toMatchObject({
        currentStreak: 0,
        totalFailures: 2,
        groupStartedAt: undefined,
        groupExpiresAt: undefined,
      });
      expect(chain('untouched')).toEqual(untouched);
      expect(stateRef.getState().activeSession).toBeNull();
      expect(await storage.getActiveSession()).toBeNull();
      expect(systemNotificationService.notifyTaskFailed).toHaveBeenCalledWith(
        'Expired Group',
        'Group has expired',
      );
    });

    it('notifies an expired group in Chinese', async () => {
      const { handleStartChain } = startGroup({
        chains: [expiredGroup({ name: '过期任务群' })],
        translator: zhTr,
      });

      await handleStartChain('expired');

      expect(systemNotificationService.notifyTaskFailed).toHaveBeenCalledWith(
        '过期任务群',
        '任务群已超时',
      );
    });

    it('starts the first unfinished unit and starts the group timer', async () => {
      const group = createGroupChain({ id: 'group', timeLimitHours: 2 });
      const done = createUnitChain({
        id: 'done',
        parentId: 'group',
        sortOrder: 1,
        currentStreak: 1,
      });
      const next = createUnitChain({
        id: 'next',
        parentId: 'group',
        sortOrder: 2,
        duration: 33,
      });
      const { handleStartChain, stateRef, storage, chain } = startGroup({
        chains: [group, next, done],
      });

      await handleStartChain('group');

      expect(await storage.getActiveSession()).toMatchObject({
        chainId: 'next',
        duration: 33,
      });
      expect(stateRef.getState().activeSession?.chainId).toBe('next');
      expect(chain('group')).toMatchObject({
        groupStartedAt: NOW,
        groupExpiresAt: new Date('2026-02-02T10:00:00.000Z'),
      });
    });

    it('keeps the running timer of a group that already started', async () => {
      const startedAt = new Date('2026-02-02T07:00:00.000Z');
      const group = createGroupChain({
        id: 'group',
        timeLimitHours: 2,
        groupStartedAt: startedAt,
      });
      const unit = createUnitChain({ id: 'unit', parentId: 'group' });
      const { handleStartChain, storage, chain } = startGroup({
        chains: [group, unit],
      });

      await handleStartChain('group');

      expect(chain('group')?.groupStartedAt).toEqual(startedAt);
      expect(await storage.getActiveSession()).toMatchObject({
        chainId: 'unit',
      });
    });

    it('completes a cycle when every unit is done and starts the next cycle', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
      const group = createGroupChain({ id: 'group', totalCompletions: 2 });
      const unit = createUnitChain({
        id: 'unit',
        parentId: 'group',
        currentStreak: 1,
      });
      const onTaskLifecycleEvent = vi.fn();
      const { handleStartChain, storage, chain } = startGroup({
        chains: [group, unit],
        onTaskLifecycleEvent,
      });

      await handleStartChain('group');

      expect(chain('group')).toMatchObject({
        totalCompletions: 3,
        currentStreak: 1,
      });
      expect(chain('unit')?.currentStreak).toBe(0);
      expect(
        (await storage.getChains()).find((item) => item.id === 'group'),
      ).toMatchObject({ totalCompletions: 3 });
      expect(
        systemNotificationService.notifyTaskCompleted,
      ).toHaveBeenCalledWith(
        group.name,
        3,
        'Cycle 3 completed. Starting cycle 4.',
      );
      expect(onTaskLifecycleEvent).toHaveBeenCalledWith({
        type: 'group_cycle_completed',
        chainId: 'group',
        chainKind: 'group',
        occurredAt: NOW,
      });
      expect(await storage.getActiveSession()).toBeNull();

      await vi.runAllTimersAsync();

      expect(await storage.getActiveSession()).toMatchObject({
        chainId: 'unit',
      });
    });

    it('logs and starts nothing when the next cycle cannot read chains', async () => {
      vi.useFakeTimers();
      const storage = createTestStorage({
        getActiveChains: vi.fn(async () => {
          throw new Error('read failed');
        }),
      });
      const { handleStartChain } = startGroup({
        chains: [
          createGroupChain({ id: 'group' }),
          createUnitChain({ id: 'unit', parentId: 'group', currentStreak: 1 }),
        ],
        storage,
      });

      await handleStartChain('group');
      await vi.runAllTimersAsync();

      expect(logger.error).toHaveBeenCalledWith(
        'SESSIONS',
        'Failed to start next cycle first unit',
        { chainId: 'group' },
        expect.any(Error),
      );
      expect(await storage.getActiveSession()).toBeNull();
    });

    it('keeps the old cycle and starts nothing when saving the cycle fails', async () => {
      vi.useFakeTimers();
      const group = createGroupChain({ id: 'group', totalCompletions: 7 });
      const onTaskLifecycleEvent = vi.fn();
      const { handleStartChain, storage, chain } = startGroup({
        chains: [
          group,
          createUnitChain({ id: 'unit', parentId: 'group', currentStreak: 1 }),
        ],
        safelySaveChains: async () => {
          throw new Error('save group cycle failed');
        },
        onTaskLifecycleEvent,
      });

      await handleStartChain('group');
      await vi.runAllTimersAsync();

      expect(chain('group')?.totalCompletions).toBe(7);
      expect(onTaskLifecycleEvent).not.toHaveBeenCalled();
      expect(await storage.getActiveSession()).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'SESSIONS',
        expect.any(String),
        undefined,
        expect.any(Error),
      );
    });
  });

  it('should show toast when betting session creation returns error', async () => {
    const chain = createUnitChain({ id: 'unit-err' });
    const storage = createSupabaseStorageMock({
      isGamblingModeEnabled: vi.fn(async () => ({
        ok: true as const,
        value: true,
      })),
      createBettingSession: vi.fn(async () => ({
        ok: false as const,
        error: { code: 'STORAGE' as const, message: 'nope' },
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
      t,
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
      isGamblingModeEnabled: vi.fn(async () => ({
        ok: true as const,
        value: true,
      })),
      createBettingSession: vi.fn(async () => ({
        ok: false as const,
        error: { code: 'STORAGE' as const, message: 'nope' },
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
      t: zhTr,
    });

    await handleStartChain(chain.id);

    expect(logger.error).toHaveBeenCalledWith(
      'SESSIONS',
      'Failed to create betting session',
      {
        chainId: chain.id,
        code: 'STORAGE' as const,
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
      t,
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
      t,
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
      t,
    });

    await handleStartChain(chain.id);
    await flushPromises();

    expect(onNavigateToFocus).toHaveBeenCalledTimes(1);
    expect(
      stateRef.getState().chains.find((item) => item.id === chain.id)
        ?.auxiliaryStreak,
    ).toBe(3);
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
      t,
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
      t,
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
      t,
    });

    await handleStartChain('missing-local-chain');

    expect(storage.saveActiveSession).not.toHaveBeenCalled();
    expect(storage.removeScheduledSession).not.toHaveBeenCalled();
  });
});
