import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AppState } from '../../../../types';
import {
  createAppState,
  createLocalStorageMock,
  createUnitChain,
} from '../../../../test/factories';
import { createPauseResumeHandlers } from '../pauseResume';
import { toast } from '../../../../utils/toast';

vi.mock('../../../../utils/toast', () => ({ toast: { error: vi.fn() } }));

vi.mock('../../../../utils/logger', () => ({
  logger: {
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

describe('createPauseResumeHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('should pause active session and persist updated state', async () => {
    const chain = createUnitChain({ id: 'chain-1' });
    const initialState = createAppState({
      chains: [chain],
      activeSession: {
        chainId: chain.id,
        startedAt: new Date('2026-02-02T10:00:00.000Z'),
        duration: 30,
        isPaused: false,
        totalPausedTime: 0,
      },
    });
    const stateRef = createStateContainer(initialState);
    const storage = createLocalStorageMock({
      saveActiveSession: vi.fn(async () => undefined),
    });

    const { handlePauseSession } = createPauseResumeHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
    });

    await expect(handlePauseSession()).resolves.toBe(true);

    expect(storage.saveActiveSession).toHaveBeenCalledTimes(1);
    const persisted = vi.mocked(storage.saveActiveSession).mock.calls[0]?.[0];
    expect(persisted).toMatchObject({ isPaused: true });
    expect(persisted?.pausedAt).toBeInstanceOf(Date);
    expect(stateRef.getState().activeSession?.isPaused).toBe(true);
  });

  it('should resume paused session and accumulate paused time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-02T11:00:00.000Z'));
    const pausedAt = new Date('2026-02-02T10:59:40.000Z');

    const chain = createUnitChain({ id: 'chain-2' });
    const initialState = createAppState({
      chains: [chain],
      activeSession: {
        chainId: chain.id,
        startedAt: new Date('2026-02-02T10:00:00.000Z'),
        duration: 30,
        isPaused: true,
        pausedAt,
        totalPausedTime: 2000,
      },
    });
    const stateRef = createStateContainer(initialState);
    const storage = createLocalStorageMock({
      saveActiveSession: vi.fn(async () => undefined),
    });

    const { handleResumeSession } = createPauseResumeHandlers({
      state: stateRef.getState(),
      setState: stateRef.setState,
      storage,
    });

    await expect(handleResumeSession()).resolves.toBe(true);

    const resumed = stateRef.getState().activeSession;
    expect(resumed?.isPaused).toBe(false);
    expect(resumed?.pausedAt).toBeUndefined();
    expect(resumed?.totalPausedTime).toBe(22000);
    expect(storage.saveActiveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        isPaused: false,
        totalPausedTime: 22000,
      }),
    );
  });

  it('rejects transitions without an active session or the pause timestamp', async () => {
    const storage = createLocalStorageMock({
      saveActiveSession: vi.fn(async () => undefined),
    });
    const noSession = createStateContainer(
      createAppState({ activeSession: null }),
    );
    const noPausedAt = createStateContainer(
      createAppState({
        activeSession: {
          chainId: 'chain-id',
          startedAt: new Date(),
          duration: 10,
          isPaused: true,
          totalPausedTime: 0,
        },
      }),
    );

    const missingSession = createPauseResumeHandlers({
      state: noSession.getState(),
      setState: noSession.setState,
      storage,
    });
    const missingPause = createPauseResumeHandlers({
      state: noPausedAt.getState(),
      setState: noPausedAt.setState,
      storage,
    });

    await expect(missingSession.handlePauseSession()).resolves.toBe(false);
    await expect(missingSession.handleResumeSession()).resolves.toBe(false);
    await expect(missingPause.handleResumeSession()).resolves.toBe(false);

    expect(storage.saveActiveSession).not.toHaveBeenCalled();
    expect(noSession.setState).not.toHaveBeenCalled();
    expect(noPausedAt.setState).not.toHaveBeenCalled();
  });

  function sessionState(paused = false) {
    return createStateContainer(
      createAppState({
        activeSession: {
          chainId: 'pending-session',
          startedAt: new Date('2026-09-20T10:00:00Z'),
          duration: 30,
          isPaused: paused,
          totalPausedTime: 0,
          pausedAt: paused ? new Date('2026-09-20T10:01:00Z') : undefined,
        },
      }),
    );
  }

  it.each([false, true])(
    'accepts the already confirmed paused=%s state without another write or timestamp change',
    async (paused) => {
      const stateRef = sessionState(paused);
      const original = stateRef.getState().activeSession;
      const storage = createLocalStorageMock();
      const handlers = createPauseResumeHandlers({ ...stateRef, storage });
      const action = paused
        ? handlers.handlePauseSession
        : handlers.handleResumeSession;

      await expect(action()).resolves.toBe(true);
      expect(storage.saveActiveSession).not.toHaveBeenCalled();
      expect(stateRef.setState).not.toHaveBeenCalled();
      expect(stateRef.getState().activeSession).toBe(original);
    },
  );

  it('keeps pending transitions for different sessions of the same chain independent', async () => {
    const stateRef = sessionState();
    const firstSession = stateRef.getState().activeSession!;
    let finishFirst!: () => void;
    const storage = createLocalStorageMock({
      saveActiveSession: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              finishFirst = resolve;
            }),
        )
        .mockResolvedValue(undefined),
    });
    const handlers = createPauseResumeHandlers({ ...stateRef, storage });
    const first = handlers.handlePauseSession();
    const nextSession = {
      ...firstSession,
      startedAt: new Date('2026-09-20T11:00:00Z'),
    };
    stateRef.setState((state) => ({ ...state, activeSession: nextSession }));
    const second = handlers.handlePauseSession();

    expect(second).not.toBe(first);
    expect(storage.saveActiveSession).toHaveBeenCalledTimes(2);
    await expect(second).resolves.toBe(true);
    const confirmed = stateRef.getState().activeSession;
    expect(confirmed).toMatchObject({
      startedAt: nextSession.startedAt,
      isPaused: true,
    });
    finishFirst();
    await first;
    expect(stateRef.getState().activeSession).toBe(confirmed);
  });

  it('gives a retry instruction when persistence fails without a custom message', async () => {
    const stateRef = sessionState();
    const storage = createLocalStorageMock({
      saveActiveSession: vi.fn().mockRejectedValue(new Error('offline')),
    });
    const handlers = createPauseResumeHandlers({ ...stateRef, storage });

    await expect(handlers.handlePauseSession()).resolves.toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      'Pause or resume was not saved. Please try again.',
    );
  });

  it.each([false, true])(
    'publishes the %s transition only after persistence, and coalesces double clicks',
    async (paused) => {
      const stateRef = sessionState(paused);
      const original = stateRef.getState().activeSession;
      let finish!: () => void;
      const storage = createLocalStorageMock({
        saveActiveSession: vi.fn(
          () =>
            new Promise<void>((resolve) => {
              finish = resolve;
            }),
        ),
      });
      const handlers = createPauseResumeHandlers({ ...stateRef, storage });
      const action = paused
        ? handlers.handleResumeSession
        : handlers.handlePauseSession;
      const first = action();
      expect(action()).toBe(first);
      expect(storage.saveActiveSession).toHaveBeenCalledTimes(1);
      expect(stateRef.getState().activeSession).toBe(original);
      expect(stateRef.setState).not.toHaveBeenCalled();
      finish();
      await expect(first).resolves.toBe(true);
      expect(stateRef.getState().activeSession?.isPaused).toBe(!paused);
    },
  );

  it.each([false, true])(
    'retains the %s state on write failure and permits retry',
    async (paused) => {
      const stateRef = sessionState(paused);
      const original = stateRef.getState().activeSession;
      const storage = createLocalStorageMock({
        saveActiveSession: vi
          .fn()
          .mockRejectedValueOnce(new Error('disk unavailable'))
          .mockResolvedValue(undefined),
      });
      const handlers = createPauseResumeHandlers({
        ...stateRef,
        storage,
        saveErrorMessage: 'Save failed; retry.',
      });
      const action = paused
        ? handlers.handleResumeSession
        : handlers.handlePauseSession;
      await expect(action()).resolves.toBe(false);
      expect(stateRef.getState().activeSession).toBe(original);
      expect(stateRef.setState).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Save failed; retry.');
      await expect(action()).resolves.toBe(true);
      expect(stateRef.getState().activeSession?.isPaused).toBe(!paused);
      expect(storage.saveActiveSession).toHaveBeenCalledTimes(2);
    },
  );

  it('does not restore the visible session when completion finishes before the pause save', async () => {
    const stateRef = sessionState();
    let finish!: () => void;
    const storage = createLocalStorageMock({
      saveActiveSession: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    });
    const handlers = createPauseResumeHandlers({ ...stateRef, storage });
    const pending = handlers.handlePauseSession();
    stateRef.setState((state) => ({ ...state, activeSession: null }));
    finish();
    await pending;
    expect(stateRef.getState().activeSession).toBeNull();
  });

  it('serializes opposite transitions against the last confirmed session', async () => {
    const stateRef = sessionState();
    let finish!: () => void;
    const storage = createLocalStorageMock({
      saveActiveSession: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              finish = resolve;
            }),
        )
        .mockResolvedValue(undefined),
    });
    const handlers = createPauseResumeHandlers({ ...stateRef, storage });
    const pause = handlers.handlePauseSession();
    const resume = handlers.handleResumeSession();
    expect(storage.saveActiveSession).toHaveBeenCalledTimes(1);
    finish();
    await expect(pause).resolves.toBe(true);
    await expect(resume).resolves.toBe(true);
    expect(storage.saveActiveSession).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ isPaused: false, pausedAt: undefined }),
    );
    expect(stateRef.getState().activeSession?.isPaused).toBe(false);
  });
});
