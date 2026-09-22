import { describe, expect, it, vi } from 'vitest';
import { createCompletionHandlers } from '../completion';
import {
  createAppState,
  createLocalStorageMock,
  createUnitChain,
} from '../../../../test/factories';
import type { SessionCompletionResult } from '../../../../storage/operations';
import { toast } from '../../../../utils/toast';

vi.mock('../../../../services/platform/SystemNotificationService', () => ({
  systemNotificationService: { notifyTaskCompleted: vi.fn() },
}));

function context() {
  const chain = createUnitChain({ currentStreak: 4 });
  let state = createAppState({
    chains: [chain],
    activeSession: {
      chainId: chain.id,
      startedAt: new Date(),
      duration: 5,
      isPaused: false,
      totalPausedTime: 0,
    },
  });
  const storage = createLocalStorageMock();
  const navigate = vi.fn();
  const pet = vi.fn();
  const lifecycle = vi.fn();
  const handlers = createCompletionHandlers({
    getState: () => state,
    setState: (update) => {
      state = typeof update === 'function' ? update(state) : update;
    },
    storage,
    safelySaveChains: vi.fn(),
    activeSessionId: null,
    setActiveSessionId: vi.fn(),
    onNavigateToDashboard: navigate,
    onPetTaskCompleted: pet,
    onTaskLifecycleEvent: lifecycle,
    tr: (_zh, en) => en,
  });
  return {
    handlers,
    storage,
    navigate,
    pet,
    lifecycle,
    getState: () => state,
    startNextSession: () => {
      state = {
        ...state,
        activeSession: {
          ...state.activeSession!,
          startedAt: new Date(Date.now() + 60_000),
        },
      };
      return state.activeSession;
    },
  };
}

describe('completion commit boundary', () => {
  it('preserves a newer active session when an older commit response arrives late', async () => {
    const test = context();
    let resolve!: (value: SessionCompletionResult) => void;
    vi.mocked(test.storage.commitSessionCompletion).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = test.handlers.handleCompleteSession();
    const nextSession = test.startNextSession();
    const submitted = vi.mocked(test.storage.commitSessionCompletion).mock
      .calls[0][0];
    resolve({ chains: submitted.chains, record: submitted.record });
    await expect(pending).resolves.toBe(true);
    expect(test.getState().activeSession).toEqual(nextSession);
    expect(test.getState().completionHistory).toHaveLength(1);
    expect(test.navigate).not.toHaveBeenCalled();
  });
  it('keeps a confirmed commit successful when a navigation observer throws', async () => {
    const test = context();
    test.navigate.mockImplementation(() => {
      throw new Error('observer failed');
    });
    await expect(test.handlers.handleCompleteSession()).resolves.toBe(true);
    expect(test.getState().activeSession).toBeNull();
    expect(test.getState().completionHistory).toHaveLength(1);
  });
  it('retains task and emits no success effects while pending; duplicate clicks share the commit', async () => {
    const test = context();
    let resolve!: (value: SessionCompletionResult) => void;
    vi.mocked(test.storage.commitSessionCompletion).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const first = test.handlers.handleCompleteSession('description');
    const duplicate = test.handlers.handleCompleteSession('description');
    expect(test.storage.commitSessionCompletion).toHaveBeenCalledTimes(1);
    expect(test.getState().activeSession).not.toBeNull();
    expect(test.getState().chains[0].currentStreak).toBe(4);
    expect(test.navigate).not.toHaveBeenCalled();
    expect(test.pet).not.toHaveBeenCalled();
    const submitted = vi.mocked(test.storage.commitSessionCompletion).mock
      .calls[0][0];
    resolve({ chains: submitted.chains, record: submitted.record });
    await expect(first).resolves.toBe(true);
    await expect(duplicate).resolves.toBe(true);
    expect(test.getState().chains[0].currentStreak).toBe(5);
    expect(test.getState().completionHistory).toHaveLength(1);
    expect(test.navigate).toHaveBeenCalledTimes(1);
    expect(test.pet).toHaveBeenCalledTimes(1);
  });

  it('shows a retryable failure and retains the operation identity for completion and interruption', async () => {
    for (const action of [
      'handleCompleteSession',
      'handleInterruptSession',
    ] as const) {
      const test = context();
      const messages: string[] = [];
      const unsubscribe = toast.subscribe((message) =>
        messages.push(message.message),
      );
      vi.mocked(test.storage.commitSessionCompletion).mockRejectedValueOnce(
        new Error('offline'),
      );
      await expect(test.handlers[action]()).resolves.toBe(false);
      expect(messages).toEqual([
        'Save is not confirmed. Your task is retained; retry completion.',
      ]);
      expect(test.getState().activeSession).not.toBeNull();
      expect(test.getState().completionHistory).toEqual([]);
      expect(test.navigate).not.toHaveBeenCalled();
      expect(test.lifecycle).not.toHaveBeenCalled();
      await test.handlers[action]();
      const calls = vi.mocked(test.storage.commitSessionCompletion).mock.calls;
      expect(calls[1][0].operationId).toBe(calls[0][0].operationId);
      expect(test.getState().activeSession).toBeNull();
      unsubscribe();
    }
  });
});
