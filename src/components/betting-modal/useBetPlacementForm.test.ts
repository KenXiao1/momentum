import { createTranslator } from '../../i18n/translate';
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BetPlacementResult } from '../../domain/betting';
import { err, ok } from '../../domain/result';
import type { GamblingSettings } from '../../domain/userSettings';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import { useBetPlacementForm } from './useBetPlacementForm';

type PlaceBet = Pick<MomentumStorage, 'placeBet'>['placeBet'];

interface HarnessProps {
  isOpen?: boolean;
  canUseBetting?: boolean;
  availablePoints?: number;
  todayBetAmount?: number;
  gamblingSettings?: GamblingSettings | null;
  placeBet: PlaceBet;
  onBetPlaced?: (result: BetPlacementResult) => void;
}

const t = createTranslator('en');

function useBetPlacementHarness({
  isOpen = true,
  canUseBetting = true,
  availablePoints: initialAvailablePoints = 100,
  todayBetAmount: initialTodayBetAmount = 0,
  gamblingSettings = null,
  placeBet,
  onBetPlaced,
}: HarnessProps) {
  const [availablePoints, setAvailablePoints] = useState(
    initialAvailablePoints,
  );
  const [todayBetAmount, setTodayBetAmount] = useState(initialTodayBetAmount);
  const [error, setError] = useState<string | null>('stale error');
  const form = useBetPlacementForm({
    isOpen,
    sessionId: 'session-1',
    onBetPlaced,
    storage: { placeBet },
    canUseBetting,
    language: 'en',
    t,
    availablePoints,
    setAvailablePoints,
    todayBetAmount,
    setTodayBetAmount,
    gamblingSettings,
    setError,
  });

  return { ...form, availablePoints, todayBetAmount, error };
}

describe('useBetPlacementForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid input without calling the storage port', async () => {
    const placeBet = vi.fn<PlaceBet>();
    const { result } = renderHook(() => useBetPlacementHarness({ placeBet }));

    act(() => result.current.handleBetAmountChange('1.5'));
    await act(async () => result.current.handlePlaceBet());

    expect(result.current.validationError).toBe(
      'Bet amount must be an integer',
    );
    expect(placeBet).not.toHaveBeenCalled();
    expect(result.current.isPlacingBet).toBe(false);
  });

  it('stops at the capability boundary when betting is unsupported', async () => {
    const placeBet = vi.fn<PlaceBet>();
    const { result } = renderHook(() =>
      useBetPlacementHarness({ placeBet, canUseBetting: false }),
    );

    act(() => result.current.handleBetAmountChange('10'));
    await act(async () => result.current.handlePlaceBet());

    expect(result.current.error).toBe(
      'Betting is not supported for the current storage',
    );
    expect(placeBet).not.toHaveBeenCalled();
  });

  it('applies a successful storage result to all observable form state', async () => {
    const placedResult: BetPlacementResult = {
      success: true,
      message: 'placed',
      bet_id: 'bet-1',
      bet_amount: 10,
      potential_payout: 30,
      points_after: 0,
    };
    const placeBet = vi.fn<PlaceBet>().mockResolvedValue(ok(placedResult));
    const onBetPlaced = vi.fn();
    const { result } = renderHook(() =>
      useBetPlacementHarness({
        placeBet,
        onBetPlaced,
        availablePoints: 100,
        todayBetAmount: 5,
      }),
    );

    act(() => result.current.handleBetAmountChange('10'));
    await act(async () => result.current.handlePlaceBet());

    expect(placeBet).toHaveBeenCalledTimes(1);
    expect(placeBet).toHaveBeenCalledWith({
      session_id: 'session-1',
      bet_amount: 10,
    });
    expect(result.current.availablePoints).toBe(0);
    expect(result.current.todayBetAmount).toBe(15);
    expect(result.current.successMessage).toBe(
      'Bet placed! Bet 10 points, potential payout 30 points',
    );
    expect(result.current.error).toBeNull();
    expect(result.current.isPlacingBet).toBe(false);
    expect(onBetPlaced).toHaveBeenCalledWith(placedResult);
  });

  it('uses the local balance fallback when storage omits points_after', async () => {
    const placeBet = vi.fn<PlaceBet>().mockResolvedValue(
      ok({
        success: true,
        message: 'placed',
        potential_payout: 20,
      }),
    );
    const { result } = renderHook(() =>
      useBetPlacementHarness({ placeBet, availablePoints: 40 }),
    );

    act(() => result.current.handleBetAmountChange('10'));
    await act(async () => result.current.handlePlaceBet());

    expect(result.current.availablePoints).toBe(30);
  });

  it('surfaces both domain failures and thrown boundary errors', async () => {
    const placeBet = vi
      .fn<PlaceBet>()
      .mockResolvedValueOnce(
        err({ code: 'NETWORK', message: 'network unavailable' }),
      )
      .mockRejectedValueOnce(new Error('request exploded'));
    const { result } = renderHook(() => useBetPlacementHarness({ placeBet }));

    act(() => result.current.handleBetAmountChange('10'));
    await act(async () => result.current.handlePlaceBet());
    expect(result.current.error).toBe('network unavailable');
    expect(result.current.successMessage).toBeNull();
    expect(result.current.isPlacingBet).toBe(false);

    await act(async () => result.current.handlePlaceBet());
    expect(result.current.error).toBe('request exploded');
    expect(result.current.isPlacingBet).toBe(false);
  });

  it('clears transient state when the modal closes', () => {
    const placeBet = vi.fn<PlaceBet>();
    const { result, rerender } = renderHook(
      ({ isOpen }) => useBetPlacementHarness({ isOpen, placeBet }),
      { initialProps: { isOpen: true } },
    );

    act(() => result.current.handleBetAmountChange('25'));
    expect(result.current.betAmount).toBe('25');

    rerender({ isOpen: false });

    expect(result.current.betAmount).toBe('');
    expect(result.current.validationError).toBeNull();
    expect(result.current.successMessage).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
