import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState } from '../../../types';
import {
  createAppState,
  createLocalStorageMock,
  createUnitChain,
} from '../../../test/factories';
import { logger } from '../../../utils/logger';
import { useRulesDomain } from '../useRulesDomain';

vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

function createStateContainer(initial: AppState) {
  let state = initial;
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

describe('useRulesDomain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle auxiliary failure by resetting streak and incrementing failures', async () => {
    const chain = createUnitChain({
      id: 'chain-1',
      auxiliaryStreak: 4,
      auxiliaryFailures: 1,
    });
    const unaffected = createUnitChain({
      id: 'chain-9',
      auxiliaryStreak: 7,
      auxiliaryFailures: 3,
    });
    const stateRef = createStateContainer(
      createAppState({
        chains: [chain, unaffected],
        scheduledSessions: [
          {
            chainId: chain.id,
            scheduledAt: new Date(),
            expiresAt: new Date(Date.now() + 10000),
            auxiliarySignal: 'signal',
          },
          {
            chainId: unaffected.id,
            scheduledAt: new Date(),
            expiresAt: new Date(Date.now() + 10000),
            auxiliarySignal: 'keep-me',
          },
        ],
      }),
    );
    const storage = createLocalStorageMock({
      removeScheduledSession: vi.fn(async () => undefined),
    });
    const safelySaveChains = vi.fn(async () => undefined);
    const setShowAuxiliaryJudgment = vi.fn();

    const { result } = renderHook(() =>
      useRulesDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        storage,
        safelySaveChains,
        setShowAuxiliaryJudgment,
      }),
    );

    act(() => {
      result.current.handleAuxiliaryJudgmentFailure(chain.id);
    });

    expect(safelySaveChains).toHaveBeenCalledTimes(1);
    const updatedChains = safelySaveChains.mock.calls[0]?.[0];
    expect(
      updatedChains?.find((item) => item.id === chain.id)?.auxiliaryStreak,
    ).toBe(0);
    expect(
      updatedChains?.find((item) => item.id === chain.id)?.auxiliaryFailures,
    ).toBe(2);
    expect(updatedChains?.find((item) => item.id === unaffected.id)).toEqual(
      unaffected,
    );
    expect(storage.removeScheduledSession).toHaveBeenCalledWith(chain.id);
    expect(stateRef.getState().scheduledSessions).toEqual([
      expect.objectContaining({ chainId: unaffected.id }),
    ]);
    expect(setShowAuxiliaryJudgment).toHaveBeenCalledWith(null);
  });

  it('should allow auxiliary exception rule and persist updates', () => {
    const chain = { ...createUnitChain({ id: 'chain-2' }) } as ReturnType<
      typeof createUnitChain
    >;
    delete (chain as { auxiliaryExceptions?: string[] }).auxiliaryExceptions;
    const untouched = createUnitChain({
      id: 'chain-8',
      auxiliaryExceptions: ['untouched'],
    });
    const stateRef = createStateContainer(
      createAppState({
        chains: [chain, untouched],
        scheduledSessions: [
          {
            chainId: chain.id,
            scheduledAt: new Date(),
            expiresAt: new Date(Date.now() + 10000),
            auxiliarySignal: 'signal',
          },
          {
            chainId: untouched.id,
            scheduledAt: new Date(),
            expiresAt: new Date(Date.now() + 10000),
            auxiliarySignal: 'keep',
          },
        ],
      }),
    );
    const storage = createLocalStorageMock({
      removeScheduledSession: vi.fn(async () => undefined),
    });
    const safelySaveChains = vi.fn(async () => undefined);
    const setShowAuxiliaryJudgment = vi.fn();

    const { result } = renderHook(() =>
      useRulesDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        storage,
        safelySaveChains,
        setShowAuxiliaryJudgment,
      }),
    );

    act(() => {
      result.current.handleAuxiliaryJudgmentAllow(
        chain.id,
        'new-exception-rule',
      );
    });

    const updatedChains = safelySaveChains.mock.calls[0]?.[0];
    expect(() =>
      result.current.handleAuxiliaryJudgmentAllow(
        chain.id,
        'new-exception-rule-2',
      ),
    ).not.toThrow();
    expect(
      updatedChains?.find((item) => item.id === chain.id)?.auxiliaryExceptions,
    ).toEqual(['new-exception-rule']);
    expect(updatedChains?.find((item) => item.id === untouched.id)).toEqual(
      untouched,
    );
    expect(storage.removeScheduledSession).toHaveBeenCalledWith(chain.id);
    expect(setShowAuxiliaryJudgment).toHaveBeenCalledWith(null);
  });

  it('should invalidate chain query cache when chain persistence fails', async () => {
    const chain = createUnitChain({ id: 'chain-3' });
    const stateRef = createStateContainer(createAppState({ chains: [chain] }));
    const storage = createLocalStorageMock({
      removeScheduledSession: vi.fn(async () => undefined),
    });
    const safelySaveChains = vi.fn(async () => {
      throw new Error('save failed');
    });

    const { result } = renderHook(() =>
      useRulesDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        storage,
        safelySaveChains,
        setShowAuxiliaryJudgment: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleAuxiliaryJudgmentFailure(chain.id);
    });
    await Promise.resolve();
  });

  it('logs failure context when persistence promises reject in failure-judgment flow', async () => {
    const chain = createUnitChain({ id: 'chain-3' });
    const stateRef = createStateContainer(createAppState({ chains: [chain] }));
    const storage = createLocalStorageMock({
      removeScheduledSession: vi.fn(async () => {
        throw new Error('session save failed');
      }),
    });
    const safelySaveChains = vi.fn(async () => {
      throw new Error('chain save failed');
    });

    const { result } = renderHook(() =>
      useRulesDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        storage,
        safelySaveChains,
        setShowAuxiliaryJudgment: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleAuxiliaryJudgmentFailure(chain.id);
    });
    await flushPromises();

    expect(logger.error).toHaveBeenCalledWith(
      'RULES_DOMAIN',
      'Failed to persist chains after failure judgment',
      { chainId: chain.id },
      expect.any(Error),
    );
    expect(logger.error).toHaveBeenCalledWith(
      'RULES_DOMAIN',
      'Failed to persist scheduled sessions after failure judgment',
      { chainId: chain.id },
      expect.any(Error),
    );
  });

  it('logs failure context when persistence promises reject in allow-judgment flow', async () => {
    const chain = createUnitChain({ id: 'chain-4' });
    const stateRef = createStateContainer(createAppState({ chains: [chain] }));
    const storage = createLocalStorageMock({
      removeScheduledSession: vi.fn(async () => {
        throw new Error('session save failed');
      }),
    });
    const safelySaveChains = vi.fn(async () => {
      throw new Error('chain save failed');
    });

    const { result } = renderHook(() =>
      useRulesDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        storage,
        safelySaveChains,
        setShowAuxiliaryJudgment: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleAuxiliaryJudgmentAllow(chain.id, 'r1');
    });
    await flushPromises();

    expect(logger.error).toHaveBeenCalledWith(
      'RULES_DOMAIN',
      'Failed to persist chains after allow judgment',
      { chainId: chain.id },
      expect.any(Error),
    );
    expect(logger.error).toHaveBeenCalledWith(
      'RULES_DOMAIN',
      'Failed to persist scheduled sessions after allow judgment',
      { chainId: chain.id },
      expect.any(Error),
    );
  });
});
