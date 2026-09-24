import { createTranslationMock } from '../../../../test/i18n';
import { createTranslator } from '../../../../i18n/translate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState } from '../../../../types';
import {
  createAppState,
  createLocalStorageMock,
  createUnitChain,
} from '../../../../test/factories';
import { createSchedulingHandlers } from '../scheduling';
import { systemNotificationService } from '../../../../services/platform/SystemNotificationService';
import { toast } from '../../../../utils/toast';
import { logger } from '../../../../utils/logger';

vi.mock('../../../../services/platform/SystemNotificationService', () => ({
  systemNotificationService: {
    notifyTaskCompleted: vi.fn(),
  },
}));

vi.mock('../../../../utils/toast', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('../../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

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

describe('createSchedulingHandlers', () => {
  const t = createTranslator('en');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T08:06:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules the requested non-first chain without disturbing existing state', async () => {
    const now = new Date('2026-07-14T08:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const otherChain = createUnitChain({
      id: 'other-chain',
      auxiliaryStreak: 9,
    });
    const targetChain = createUnitChain({
      id: 'target-chain',
      auxiliaryDuration: 20,
      auxiliarySignal: 'bell',
      auxiliaryStreak: 4,
    });
    const otherSchedule = {
      chainId: otherChain.id,
      scheduledAt: new Date('2026-07-14T07:00:00.000Z'),
      expiresAt: new Date('2026-07-14T07:15:00.000Z'),
      auxiliarySignal: 'other-signal',
    };
    const stateRef = createStateContainer(
      createAppState({
        chains: [otherChain, targetChain],
        scheduledSessions: [otherSchedule],
      }),
    );
    const storage = createLocalStorageMock({
      setScheduledSession: vi.fn(async () => undefined),
    });
    const safelySaveChains = vi.fn(async () => undefined);
    const setShowAuxiliaryJudgment = vi.fn();

    const { handleScheduleChain } = createSchedulingHandlers({
      getState: stateRef.getState,
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      setShowAuxiliaryJudgment,
      t,
    });

    handleScheduleChain(targetChain.id);
    await flushPromises();

    const nextState = stateRef.getState();
    const expectedSession = {
      chainId: targetChain.id,
      scheduledAt: now,
      expiresAt: new Date('2026-07-14T08:20:00.000Z'),
      auxiliarySignal: targetChain.auxiliarySignal,
    };
    expect(nextState.scheduledSessions).toEqual([
      otherSchedule,
      expectedSession,
    ]);
    expect(nextState.chains).toEqual([otherChain, targetChain]);
    expect(nextState.chains[0]).toBe(otherChain);
    expect(storage.setScheduledSession).toHaveBeenCalledWith(expectedSession);
    expect(safelySaveChains).not.toHaveBeenCalled();
  });

  it('ignores a duplicate schedule for the requested chain', async () => {
    const chain = createUnitChain({ id: 'chain-2' });
    const existingSession = {
      chainId: chain.id,
      scheduledAt: new Date(),
      expiresAt: new Date(Date.now() + 5000),
      auxiliarySignal: 's',
    };
    const stateRef = createStateContainer(
      createAppState({
        chains: [chain],
        scheduledSessions: [existingSession],
      }),
    );
    const storage = createLocalStorageMock({
      setScheduledSession: vi.fn(async () => undefined),
    });
    const safelySaveChains = vi.fn(async () => undefined);

    const { handleScheduleChain } = createSchedulingHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      setShowAuxiliaryJudgment: vi.fn(),
      t,
    });

    handleScheduleChain(chain.id);
    await flushPromises();

    expect(storage.setScheduledSession).not.toHaveBeenCalled();
    expect(safelySaveChains).not.toHaveBeenCalled();
    expect(stateRef.setState).not.toHaveBeenCalled();
  });

  it('does not schedule a missing chain even when another chain exists', async () => {
    const existingChain = createUnitChain({ id: 'existing-chain' });
    const stateRef = createStateContainer(
      createAppState({ chains: [existingChain], scheduledSessions: [] }),
    );
    const storage = createLocalStorageMock({
      setScheduledSession: vi.fn(async () => undefined),
    });
    const safelySaveChains = vi.fn(async () => undefined);

    const { handleScheduleChain } = createSchedulingHandlers({
      getState: stateRef.getState,
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      setShowAuxiliaryJudgment: vi.fn(),
      t,
    });

    handleScheduleChain('missing-chain');
    await flushPromises();

    expect(storage.setScheduledSession).not.toHaveBeenCalled();
    expect(safelySaveChains).not.toHaveBeenCalled();
    expect(stateRef.setState).not.toHaveBeenCalled();
  });

  it('should delegate cancel action to auxiliary judgment modal', () => {
    const setShowAuxiliaryJudgment = vi.fn();
    const { handleCancelScheduledSession } = createSchedulingHandlers({
      state: createAppState(),
      setState: vi.fn(),
      storage: createLocalStorageMock(),
      safelySaveChains: vi.fn(async () => undefined),
      setShowAuxiliaryJudgment,
      t,
    });

    handleCancelScheduledSession('chain-3');

    expect(setShowAuxiliaryJudgment).toHaveBeenCalledWith('chain-3');
  });

  it('completes only the requested non-first booking and preserves other schedules', async () => {
    const completionTr = createTranslationMock('en');
    const otherChain = createUnitChain({
      id: 'other-chain',
      auxiliaryStreak: 7,
      name: 'Other Chain',
    });
    const targetChain = createUnitChain({
      id: 'target-chain',
      auxiliaryStreak: 2,
      name: 'Booking Chain',
    });
    const otherSchedule = {
      chainId: otherChain.id,
      scheduledAt: new Date('2026-07-14T08:00:00.000Z'),
      expiresAt: new Date('2026-07-14T08:10:00.000Z'),
      auxiliarySignal: 'other-signal',
    };
    const targetSchedule = {
      chainId: targetChain.id,
      scheduledAt: new Date('2026-07-14T08:05:00.000Z'),
      expiresAt: new Date('2026-07-14T08:15:00.000Z'),
      auxiliarySignal: 'target-signal',
    };
    const stateRef = createStateContainer(
      createAppState({
        chains: [otherChain, targetChain],
        scheduledSessions: [otherSchedule, targetSchedule],
      }),
    );
    const storage = createLocalStorageMock({
      removeScheduledSession: vi.fn(async () => undefined),
    });
    const safelySaveChains = vi.fn(async () => undefined);

    const { handleCompleteBooking } = createSchedulingHandlers({
      getState: stateRef.getState,
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      setShowAuxiliaryJudgment: vi.fn(),
      t: completionTr,
    });

    await handleCompleteBooking(targetChain.id);
    await flushPromises();

    const nextState = stateRef.getState();
    expect(nextState.scheduledSessions).toEqual([otherSchedule]);
    expect(nextState.chains).toEqual([
      otherChain,
      { ...targetChain, auxiliaryStreak: 3 },
    ]);
    expect(nextState.chains[0]).toBe(otherChain);
    expect(systemNotificationService.notifyTaskCompleted).toHaveBeenCalledWith(
      targetChain.name,
      3,
      'Schedule completed',
    );
    expect(storage.removeScheduledSession).toHaveBeenCalledWith(targetChain.id);
    expect(safelySaveChains).toHaveBeenCalledWith(nextState.chains);
    expect(completionTr).toHaveBeenCalledWith(
      'sessions.scheduling.scheduleCompleted',
    );
  });

  it('does nothing when completing a missing chain', async () => {
    const existingChain = createUnitChain({ id: 'existing-chain' });
    const stateRef = createStateContainer(
      createAppState({ chains: [existingChain], scheduledSessions: [] }),
    );
    const storage = createLocalStorageMock({
      removeScheduledSession: vi.fn(async () => undefined),
    });
    const safelySaveChains = vi.fn(async () => undefined);

    const { handleCompleteBooking } = createSchedulingHandlers({
      getState: stateRef.getState,
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      setShowAuxiliaryJudgment: vi.fn(),
      t,
    });

    expect(() => handleCompleteBooking('missing-chain')).not.toThrow();
    await flushPromises();

    expect(storage.removeScheduledSession).not.toHaveBeenCalled();
    expect(safelySaveChains).not.toHaveBeenCalled();
    expect(stateRef.setState).not.toHaveBeenCalled();
    expect(
      systemNotificationService.notifyTaskCompleted,
    ).not.toHaveBeenCalled();
  });

  it('retains the pending booking and reports a failed completion save', async () => {
    const chain = createUnitChain({ id: 'chain-with-errors' });
    const stateRef = createStateContainer(
      createAppState({
        chains: [chain],
        scheduledSessions: [
          {
            chainId: chain.id,
            scheduledAt: new Date('2026-07-14T08:00:00.000Z'),
            expiresAt: new Date('2026-07-14T08:10:00.000Z'),
            auxiliarySignal: 'signal',
          },
        ],
      }),
    );
    const storage = createLocalStorageMock({
      removeScheduledSession: vi.fn(async () => {
        throw new Error('remove failed');
      }),
    });
    const safelySaveChains = vi.fn(async () => {
      throw new Error('save failed');
    });

    const { handleCompleteBooking } = createSchedulingHandlers({
      getState: stateRef.getState,
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      setShowAuxiliaryJudgment: vi.fn(),
      t,
    });

    await handleCompleteBooking(chain.id);
    await flushPromises();

    expect(stateRef.getState().scheduledSessions).toHaveLength(1);
    expect(stateRef.getState().chains[0].auxiliaryStreak).toBe(0);
    expect(logger.error).toHaveBeenCalledWith(
      'SESSIONS',
      'Failed to complete booking',
      { chainId: chain.id },
      expect.objectContaining({ message: 'save failed' }),
    );
    expect(toast.error).toHaveBeenCalled();
  });

  it('should show toast when schedule persistence fails', async () => {
    const failureTr = createTranslationMock('en');
    const chain = createUnitChain({ id: 'chain-5' });
    const stateRef = createStateContainer(createAppState({ chains: [chain] }));
    const storage = createLocalStorageMock({
      setScheduledSession: vi.fn(async () => {
        throw new Error('save failed');
      }),
    });
    const safelySaveChains = vi.fn(async () => {
      throw new Error('save failed');
    });

    const { handleScheduleChain } = createSchedulingHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
      safelySaveChains,
      setShowAuxiliaryJudgment: vi.fn(),
      t: failureTr,
    });

    handleScheduleChain(chain.id);
    await flushPromises();

    expect(toast.error).toHaveBeenCalledWith(
      'Failed to schedule. Please try again.',
    );
    expect(failureTr).toHaveBeenCalledWith(
      'sessions.scheduling.failedToSchedulePleaseTryAgain',
    );
    expect(logger.error).toHaveBeenCalledWith(
      'SESSIONS',
      'Failed to schedule chain',
      { chainId: chain.id },
      expect.objectContaining({ message: 'save failed' }),
    );
  });
  it('B02 counts a fulfilled booking once and ignores duplicate completions', async () => {
    const chain = createUnitChain({ id: 'once' });
    const stateRef = createStateContainer(createAppState({ chains: [chain] }));
    const handlers = createSchedulingHandlers({
      ...stateRef,
      storage: createLocalStorageMock(),
      safelySaveChains: vi.fn(async () => undefined),
      setShowAuxiliaryJudgment: vi.fn(),
      t,
    });
    await handlers.handleScheduleChain(chain.id);
    expect(stateRef.getState().chains[0].auxiliaryStreak).toBe(0);
    await Promise.all([
      handlers.handleCompleteBooking(chain.id),
      handlers.handleCompleteBooking(chain.id),
    ]);
    await handlers.handleCompleteBooking(chain.id);
    expect(stateRef.getState().chains[0].auxiliaryStreak).toBe(1);
    expect(stateRef.getState().scheduledSessions).toEqual([]);
  });

  it('B03 routes an expired booking to judgment instead of crediting it', async () => {
    const chain = createUnitChain({ id: 'expired' });
    const stateRef = createStateContainer(createAppState({ chains: [chain] }));
    const judgment = vi.fn();
    const handlers = createSchedulingHandlers({
      ...stateRef,
      storage: createLocalStorageMock(),
      safelySaveChains: vi.fn(async () => undefined),
      setShowAuxiliaryJudgment: judgment,
      t,
    });
    await handlers.handleScheduleChain(chain.id);
    vi.advanceTimersByTime((chain.auxiliaryDuration + 1) * 60000);
    await handlers.handleCompleteBooking(chain.id);
    expect(judgment).toHaveBeenCalledWith(chain.id);
    expect(stateRef.getState().chains[0].auxiliaryStreak).toBe(0);
    expect(stateRef.getState().scheduledSessions).toHaveLength(1);
  });
  it('ignores completion when only another chain has a booking', async () => {
    const chain = createUnitChain({ id: 'target' });
    const state = createAppState({
      chains: [chain],
      scheduledSessions: [
        {
          chainId: 'other',
          scheduledAt: new Date(),
          expiresAt: new Date(Date.now() + 60000),
          auxiliarySignal: 'bell',
        },
      ],
    });
    const storage = createLocalStorageMock();
    const safelySaveChains = vi.fn(async () => undefined);
    const setState = vi.fn();
    const handlers = createSchedulingHandlers({
      state,
      setState,
      storage,
      safelySaveChains,
      setShowAuxiliaryJudgment: vi.fn(),
      t,
    });
    await handlers.handleCompleteBooking(chain.id);
    expect(safelySaveChains).not.toHaveBeenCalled();
    expect(storage.removeScheduledSession).not.toHaveBeenCalled();
    expect(setState).not.toHaveBeenCalled();
  });

  it('releases the booking lock after a failed save so retry can commit', async () => {
    const chain = createUnitChain({ id: 'retry' });
    const stateRef = createStateContainer(createAppState({ chains: [chain] }));
    const storage = createLocalStorageMock();
    const save = vi
      .fn(async () => undefined)
      .mockRejectedValueOnce(new Error('offline'));
    const t = createTranslationMock('en');
    const handlers = createSchedulingHandlers({
      ...stateRef,
      storage,
      safelySaveChains: save,
      setShowAuxiliaryJudgment: vi.fn(),
      t: t,
    });
    await handlers.handleScheduleChain(chain.id);
    await handlers.handleCompleteBooking(chain.id);
    expect(t).toHaveBeenCalledWith(
      'sessions.scheduling.failedToCompleteBookingPleaseTryAgain',
    );
    expect(toast.error).toHaveBeenCalledWith(
      'Failed to complete booking. Please try again.',
    );
    expect(stateRef.getState().scheduledSessions).toHaveLength(1);
    await handlers.handleCompleteBooking(chain.id);
    expect(save).toHaveBeenCalledTimes(2);
    expect(stateRef.getState().chains[0].auxiliaryStreak).toBe(1);
    expect(stateRef.getState().scheduledSessions).toEqual([]);
  });
});
