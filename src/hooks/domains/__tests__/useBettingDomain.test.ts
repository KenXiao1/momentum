import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BetPlacementResult } from '../../../domain/betting';
import {
  createLocalStorageMock,
  createSupabaseStorageMock,
} from '../../../test/factories';
import { emitPointsChanged } from '../../../utils/pointsEvents';
import { useStorage } from '../../../storage/useStorage';
import { logger } from '../../../utils/logger';
import { useBettingDomain } from '../useBettingDomain';

vi.mock('../../../utils/env', () => ({
  isDev: true,
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../storage/useStorage', () => ({
  useStorage: vi.fn(),
}));

vi.mock('../../../utils/pointsEvents', () => ({
  emitPointsChanged: vi.fn(),
}));

describe('useBettingDomain', () => {
  const betResult: BetPlacementResult = {
    success: true,
    message: 'ok',
    session_id: 'session-1',
    chain_id: 'chain-1',
    bet_amount: 10,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should continue pending chain startup after bet placement', async () => {
    vi.mocked(useStorage).mockReturnValue(createSupabaseStorageMock());
    const setPendingChainId = vi.fn();
    const setCurrentSessionId = vi.fn();
    const setActiveSessionId = vi.fn();
    const setShowBettingModal = vi.fn();
    const handleStartChain = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useBettingDomain({
        pendingChainId: 'chain-1',
        setPendingChainId,
        currentSessionId: 'session-1',
        setCurrentSessionId,
        setActiveSessionId,
        setShowBettingModal,
        handleStartChain,
      }),
    );

    await act(async () => {
      await result.current.handleBetPlaced(betResult);
    });

    expect(emitPointsChanged).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(
      'BETTING',
      'Bet placed successfully',
      { betResult },
    );
    expect(setActiveSessionId).toHaveBeenCalledWith('session-1');
    expect(handleStartChain).toHaveBeenCalledWith('chain-1');
    expect(setPendingChainId).toHaveBeenCalledWith(null);
    expect(setCurrentSessionId).toHaveBeenCalledWith(null);
    expect(setShowBettingModal).toHaveBeenCalledWith(false);
  });

  it('should skip startup flow when no pending chain after bet placement', async () => {
    vi.mocked(useStorage).mockReturnValue(createSupabaseStorageMock());
    const setPendingChainId = vi.fn();
    const setCurrentSessionId = vi.fn();
    const setActiveSessionId = vi.fn();
    const setShowBettingModal = vi.fn();
    const handleStartChain = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useBettingDomain({
        pendingChainId: null,
        setPendingChainId,
        currentSessionId: 'session-1',
        setCurrentSessionId,
        setActiveSessionId,
        setShowBettingModal,
        handleStartChain,
      }),
    );

    await act(async () => {
      await result.current.handleBetPlaced(betResult);
    });

    expect(emitPointsChanged).toHaveBeenCalledTimes(1);
    expect(setActiveSessionId).not.toHaveBeenCalled();
    expect(handleStartChain).not.toHaveBeenCalled();
    expect(setPendingChainId).toHaveBeenCalledWith(null);
    expect(setCurrentSessionId).toHaveBeenCalledWith(null);
    expect(setShowBettingModal).toHaveBeenCalledWith(false);
  });

  it('should cancel supabase session and emit points refresh', async () => {
    const storage = createSupabaseStorageMock({
      deleteBettingSession: vi.fn(async () => ({
        ok: true as const,
        value: undefined,
      })),
    });
    vi.mocked(useStorage).mockReturnValue(storage);

    const { result } = renderHook(() =>
      useBettingDomain({
        pendingChainId: 'chain-2',
        setPendingChainId: vi.fn(),
        currentSessionId: 'session-2',
        setCurrentSessionId: vi.fn(),
        setActiveSessionId: vi.fn(),
        setShowBettingModal: vi.fn(),
        handleStartChain: vi.fn(async () => undefined),
      }),
    );

    await act(async () => {
      await result.current.handleBetCancelled();
    });

    expect(storage.deleteBettingSession).toHaveBeenCalledWith('session-2');
    expect(emitPointsChanged).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      'BETTING',
      'Cancelled session deleted (refund handled by trigger)',
      { sessionId: 'session-2' },
    );
  });

  it('should reset local pending state without supabase delete call', async () => {
    const storage = createLocalStorageMock();
    vi.mocked(useStorage).mockReturnValue(storage);
    const setPendingChainId = vi.fn();
    const setCurrentSessionId = vi.fn();
    const setActiveSessionId = vi.fn();
    const setShowBettingModal = vi.fn();

    const { result } = renderHook(() =>
      useBettingDomain({
        pendingChainId: 'chain-3',
        setPendingChainId,
        currentSessionId: 'session-3',
        setCurrentSessionId,
        setActiveSessionId,
        setShowBettingModal,
        handleStartChain: vi.fn(async () => undefined),
      }),
    );

    await act(async () => {
      await result.current.handleBetCancelled();
    });

    expect(storage.deleteBettingSession).not.toHaveBeenCalled();
    expect(emitPointsChanged).not.toHaveBeenCalled();
    expect(setPendingChainId).toHaveBeenCalledWith(null);
    expect(setCurrentSessionId).toHaveBeenCalledWith(null);
    expect(setActiveSessionId).toHaveBeenCalledWith(null);
    expect(setShowBettingModal).toHaveBeenCalledWith(false);
  });

  it('should keep cleanup flow even when delete session returns domain error', async () => {
    const storage = createSupabaseStorageMock({
      deleteBettingSession: vi.fn(async () => ({
        ok: false as const,
        error: {
          code: 'STORAGE' as const,
          message: 'delete failed',
        },
      })),
    });
    vi.mocked(useStorage).mockReturnValue(storage);
    const setPendingChainId = vi.fn();
    const setCurrentSessionId = vi.fn();
    const setActiveSessionId = vi.fn();
    const setShowBettingModal = vi.fn();

    const { result } = renderHook(() =>
      useBettingDomain({
        pendingChainId: 'chain-4',
        setPendingChainId,
        currentSessionId: 'session-4',
        setCurrentSessionId,
        setActiveSessionId,
        setShowBettingModal,
        handleStartChain: vi.fn(async () => undefined),
      }),
    );

    await act(async () => {
      await result.current.handleBetCancelled();
    });

    expect(storage.deleteBettingSession).toHaveBeenCalledWith('session-4');
    expect(logger.error).toHaveBeenCalledWith(
      'BETTING',
      'Failed to delete cancelled session',
      {
        sessionId: 'session-4',
        error: {
          code: 'STORAGE' as const,
          message: 'delete failed',
        },
      },
    );
    expect(setPendingChainId).toHaveBeenCalledWith(null);
    expect(setCurrentSessionId).toHaveBeenCalledWith(null);
    expect(setActiveSessionId).toHaveBeenCalledWith(null);
    expect(setShowBettingModal).toHaveBeenCalledWith(false);
  });

  it('should log and continue cleanup when deleteBettingSession throws', async () => {
    const storage = createSupabaseStorageMock({
      deleteBettingSession: vi.fn(async () => {
        throw new Error('network down');
      }),
    });
    vi.mocked(useStorage).mockReturnValue(storage);
    const setPendingChainId = vi.fn();
    const setCurrentSessionId = vi.fn();
    const setActiveSessionId = vi.fn();
    const setShowBettingModal = vi.fn();

    const { result } = renderHook(() =>
      useBettingDomain({
        pendingChainId: 'chain-5',
        setPendingChainId,
        currentSessionId: 'session-5',
        setCurrentSessionId,
        setActiveSessionId,
        setShowBettingModal,
        handleStartChain: vi.fn(async () => undefined),
      }),
    );

    await act(async () => {
      await result.current.handleBetCancelled();
    });

    expect(logger.error).toHaveBeenCalledWith(
      'BETTING',
      expect.any(String),
      expect.objectContaining({ sessionId: 'session-5' }),
      expect.any(Error),
    );
    expect(emitPointsChanged).toHaveBeenCalledTimes(1);
    expect(setPendingChainId).toHaveBeenCalledWith(null);
    expect(setCurrentSessionId).toHaveBeenCalledWith(null);
    expect(setActiveSessionId).toHaveBeenCalledWith(null);
    expect(setShowBettingModal).toHaveBeenCalledWith(false);
  });
});
