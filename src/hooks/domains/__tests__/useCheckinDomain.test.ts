import type { MomentumStorage } from '../../../storage/MomentumStorage';
import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckinStats } from '../../../domain/checkin';
import { err, ok } from '../../../domain/result';
import {
  createLocalStorageMock,
  createSupabaseStorageMock,
} from '../../../test/factories';
import { renderHookWithProviders } from '../../../test/helpers/renderHookWithProviders';
import { POINTS_CHANGED_EVENT } from '../../../utils/pointsEvents';
import { logger } from '../../../utils/logger';
import {
  getSafeErrorDetail,
  getSafeErrorDetailFromUnknown,
} from '../../../utils/errorMessage';
import { useCheckinDomain } from '../useCheckinDomain';

vi.mock('../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../utils/errorMessage', () => ({
  getSafeErrorDetail: vi.fn(() => null),
  getSafeErrorDetailFromUnknown: vi.fn(() => null),
  toError: vi.fn((value: unknown) =>
    value instanceof Error ? value : new Error(String(value)),
  ),
}));

const baseStats: CheckinStats = {
  user_id: 'user-1',
  total_points: 24,
  total_checkins: 3,
  current_streak: 3,
  longest_streak: 5,
  last_checkin_date: '2026-02-05',
  has_checked_in_today: false,
};

describe('useCheckinDomain', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
    vi.mocked(getSafeErrorDetail).mockReturnValue(null);
    vi.mocked(getSafeErrorDetailFromUnknown).mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should load checkin stats when storage kind is supabase', async () => {
    const getUserCheckinStats = vi.fn(async () => ok(baseStats));
    const storage = createSupabaseStorageMock({ getUserCheckinStats });

    const { result } = renderHookWithProviders(() => useCheckinDomain(), {
      storage,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getUserCheckinStats).toHaveBeenCalledTimes(1);
    expect(result.current.stats).toEqual(baseStats);
    expect(result.current.error).toBeNull();
  });

  it('should set login-required error when storage kind is local', async () => {
    const storage = createLocalStorageMock();

    const { result } = renderHookWithProviders(() => useCheckinDomain(), {
      storage,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stats).toBeNull();
    expect(result.current.error).toContain('Daily check-in requires login');
  });

  it('should toggle collapsed state and clear error', async () => {
    const storage = createLocalStorageMock();
    const { result } = renderHookWithProviders(() => useCheckinDomain(), {
      storage,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isCollapsed).toBe(false);
    expect(result.current.error).toContain('Daily check-in requires login');

    await act(async () => {
      result.current.toggleCollapsed();
      result.current.toggleCollapsed();
      result.current.toggleCollapsed();
    });
    expect(result.current.isCollapsed).toBe(true);

    await act(async () => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });

  it('should set safe-detail loading error when stats query returns domain error', async () => {
    const getUserCheckinStats = vi.fn(async () =>
      err({ code: 'STORAGE' as const, message: 'db down' }),
    );
    const storage = createSupabaseStorageMock({ getUserCheckinStats });
    vi.mocked(getSafeErrorDetail).mockReturnValue('safe: db down');

    const { result } = renderHookWithProviders(() => useCheckinDomain(), {
      storage,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stats).toBeNull();
    expect(result.current.error).toBe('safe: db down');
  });

  it('should set fallback loading error when stats query throws', async () => {
    const getUserCheckinStats = vi.fn(async () => {
      throw new Error('network unreachable');
    });
    const storage = createSupabaseStorageMock({ getUserCheckinStats });
    vi.mocked(getSafeErrorDetailFromUnknown).mockReturnValue(null);

    const { result } = renderHookWithProviders(() => useCheckinDomain(), {
      storage,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toContain('Failed to load check-in data');
    expect(logger.error).toHaveBeenCalledWith(
      'CHECKIN',
      expect.any(String),
      undefined,
      expect.any(Error),
    );
  });

  it('should update stats and clear success message when checkin succeeds', async () => {
    const performDailyCheckin = vi.fn(async () =>
      ok({
        success: true,
        message: 'ok',
        already_checked_in: false,
        checkin_date: '2026-02-06',
        points_earned: 7,
        consecutive_days: 4,
        total_points: 31,
      }),
    );

    const storage = createSupabaseStorageMock({
      getUserCheckinStats: vi.fn(async () => ok(baseStats)),
      performDailyCheckin,
    });

    const { result } = renderHookWithProviders(() => useCheckinDomain(), {
      storage,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    vi.useFakeTimers();

    await act(async () => {
      await result.current.handleCheckin();
    });

    expect(performDailyCheckin).toHaveBeenCalledTimes(1);
    expect(result.current.stats).toMatchObject({
      has_checked_in_today: true,
      total_checkins: 4,
      current_streak: 4,
      total_points: 31,
      last_checkin_date: '2026-02-06',
    });
    expect(result.current.successMessage).toContain('Checked in!');

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.successMessage).toBeNull();
  });

  it('should use server total points when total_points is provided', async () => {
    const performDailyCheckin = vi.fn(async () =>
      ok({
        success: true,
        message: 'ok',
        already_checked_in: false,
        checkin_date: '2026-02-06',
        points_earned: 7,
        consecutive_days: 4,
        total_points: 999,
      }),
    );
    const storage = createSupabaseStorageMock({
      getUserCheckinStats: vi.fn(async () => ok(baseStats)),
      performDailyCheckin,
    });
    const { result } = renderHookWithProviders(() => useCheckinDomain(), {
      storage,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.handleCheckin();
    });

    expect(result.current.stats?.total_points).toBe(999);
  });

  it('should block duplicate check-in while request is in flight and use fallback total point math', async () => {
    let resolveCheckin:
      | ((
          value: Awaited<ReturnType<MomentumStorage['performDailyCheckin']>>,
        ) => void)
      | null = null;
    const performDailyCheckin = vi.fn(
      () =>
        new Promise<
          Awaited<ReturnType<MomentumStorage['performDailyCheckin']>>
        >((resolve) => {
          resolveCheckin = resolve as (
            value: Awaited<ReturnType<MomentumStorage['performDailyCheckin']>>,
          ) => void;
        }),
    );
    const storage = createSupabaseStorageMock({
      getUserCheckinStats: vi.fn(async () => ok(baseStats)),
      performDailyCheckin,
    });
    const { result } = renderHookWithProviders(() => useCheckinDomain(), {
      storage,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      void result.current.handleCheckin();
    });

    await waitFor(() => {
      expect(result.current.isCheckingIn).toBe(true);
    });

    await act(async () => {
      await result.current.handleCheckin();
    });
    expect(performDailyCheckin).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCheckin?.(
        ok({
          success: true,
          message: 'ok',
          already_checked_in: false,
          checkin_date: '2026-02-06',
          points_earned: 7,
          consecutive_days: 4,
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.isCheckingIn).toBe(false);
    });
    expect(result.current.stats?.total_points).toBe(31);
    expect(result.current.stats?.total_checkins).toBe(4);
  });

  it('should surface operation error when performDailyCheckin returns domain error', async () => {
    const performDailyCheckin = vi.fn(async () =>
      err({ code: 'STORAGE' as const, message: 'quota hit' }),
    );
    const storage = createSupabaseStorageMock({
      getUserCheckinStats: vi.fn(async () => ok(baseStats)),
      performDailyCheckin,
    });
    vi.mocked(getSafeErrorDetail).mockReturnValue('safe: quota hit');

    const { result } = renderHookWithProviders(() => useCheckinDomain(), {
      storage,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.handleCheckin();
    });

    expect(result.current.error).toBe('safe: quota hit');
    expect(result.current.isCheckingIn).toBe(false);
    expect(result.current.stats?.has_checked_in_today).toBe(false);
  });

  it('should set checkin-failed fallback when operation returns unsuccessful result without detail', async () => {
    const performDailyCheckin = vi.fn(async () =>
      ok({
        success: false,
        message: '',
        already_checked_in: false,
        checkin_date: '2026-02-06',
        points_earned: 0,
        consecutive_days: 0,
      }),
    );
    const storage = createSupabaseStorageMock({
      getUserCheckinStats: vi.fn(async () => ok(baseStats)),
      performDailyCheckin,
    });

    const { result } = renderHookWithProviders(() => useCheckinDomain(), {
      storage,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.handleCheckin();
    });

    expect(result.current.error).toBe('Check-in failed');
  });

  it('should set safe-detail error when operation throws', async () => {
    const performDailyCheckin = vi.fn(async () => {
      throw new Error('unhandled failure');
    });
    const storage = createSupabaseStorageMock({
      getUserCheckinStats: vi.fn(async () => ok(baseStats)),
      performDailyCheckin,
    });
    vi.mocked(getSafeErrorDetailFromUnknown).mockReturnValue(
      'safe: unhandled failure',
    );

    const { result } = renderHookWithProviders(() => useCheckinDomain(), {
      storage,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.handleCheckin();
    });

    expect(result.current.error).toBe('safe: unhandled failure');
    expect(result.current.isCheckingIn).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'CHECKIN',
      expect.any(String),
      undefined,
      expect.any(Error),
    );
  });

  it('should refresh stats when points changed event is dispatched', async () => {
    const refreshedStats: CheckinStats = {
      ...baseStats,
      total_points: 100,
      total_checkins: 10,
      current_streak: 10,
      longest_streak: 10,
      has_checked_in_today: true,
      last_checkin_date: '2026-02-06',
    };

    const getUserCheckinStats = vi
      .fn(async () => ok(baseStats))
      .mockResolvedValueOnce(ok(baseStats))
      .mockResolvedValueOnce(ok(refreshedStats));

    const storage = createSupabaseStorageMock({ getUserCheckinStats });
    const { result } = renderHookWithProviders(() => useCheckinDomain(), {
      storage,
    });

    await waitFor(() => {
      expect(getUserCheckinStats).toHaveBeenCalledTimes(1);
      expect(result.current.stats?.total_points).toBe(24);
    });

    await act(async () => {
      window.dispatchEvent(new Event(POINTS_CHANGED_EVENT));
    });

    await waitFor(() => {
      expect(getUserCheckinStats).toHaveBeenCalledTimes(2);
      expect(result.current.stats?.total_points).toBe(100);
    });
  });

  it('should attach and clean up points changed listener in supabase mode', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const storage = createSupabaseStorageMock({
      getUserCheckinStats: vi.fn(async () => ok(baseStats)),
    });

    const { unmount } = renderHookWithProviders(() => useCheckinDomain(), {
      storage,
    });

    await waitFor(() => {
      expect(storage.getUserCheckinStats).toHaveBeenCalledTimes(1);
    });

    const addCall = addSpy.mock.calls.find(
      ([eventName]) => eventName === POINTS_CHANGED_EVENT,
    );
    expect(addCall).toBeDefined();

    unmount();

    const removeCall = removeSpy.mock.calls.find(
      ([eventName]) => eventName === POINTS_CHANGED_EVENT,
    );
    expect(removeCall).toBeDefined();
    expect(removeCall?.[1]).toBe(addCall?.[1]);
  });

  it('should not attach points changed listener in local mode', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const storage = createLocalStorageMock();

    const { result } = renderHookWithProviders(() => useCheckinDomain(), {
      storage,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const eventCalls = addSpy.mock.calls.filter(
      ([eventName]) => eventName === POINTS_CHANGED_EVENT,
    );
    expect(eventCalls).toHaveLength(0);
  });
});
