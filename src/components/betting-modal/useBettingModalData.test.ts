import { createTranslator } from '../../i18n/translate';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AppError } from '../../domain/errors';
import { err, ok } from '../../domain/result';
import type { GamblingSettings } from '../../domain/userSettings';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import { useBettingModalData } from './useBettingModalData';

type BettingDataStorage = Pick<
  MomentumStorage,
  'getUserAvailablePoints' | 'getGamblingSettings' | 'getTodayBetAmount'
>;
type GetUserAvailablePoints = BettingDataStorage['getUserAvailablePoints'];
type GetGamblingSettings = BettingDataStorage['getGamblingSettings'];
type GetTodayBetAmount = BettingDataStorage['getTodayBetAmount'];

const t = createTranslator('en');
const settings: GamblingSettings = {
  gambling_mode_enabled: true,
  daily_bet_limit: 80,
  max_single_bet: 25,
};
const storageError: AppError = {
  code: 'STORAGE',
  message: 'betting data unavailable',
};

function createStorage(
  overrides: Partial<BettingDataStorage> = {},
): BettingDataStorage {
  return {
    getUserAvailablePoints: vi
      .fn<GetUserAvailablePoints>()
      .mockResolvedValue(ok(120)),
    getGamblingSettings: vi
      .fn<GetGamblingSettings>()
      .mockResolvedValue(ok(settings)),
    getTodayBetAmount: vi.fn<GetTodayBetAmount>().mockResolvedValue(ok(15)),
    ...overrides,
  };
}

function renderDataHook(
  storage: BettingDataStorage,
  overrides: Partial<{ isOpen: boolean; canUseBetting: boolean }> = {},
) {
  return renderHook(() =>
    useBettingModalData({
      isOpen: overrides.isOpen ?? true,
      canUseBetting: overrides.canUseBetting ?? true,
      storage,
      language: 'en',
      t,
    }),
  );
}

describe('useBettingModalData', () => {
  it('does not read storage while the modal is closed', () => {
    const storage = createStorage();

    renderDataHook(storage, { isOpen: false });

    expect(storage.getUserAvailablePoints).not.toHaveBeenCalled();
    expect(storage.getGamblingSettings).not.toHaveBeenCalled();
    expect(storage.getTodayBetAmount).not.toHaveBeenCalled();
  });

  it('stops at the capability boundary without reading storage', async () => {
    const storage = createStorage();
    const { result } = renderDataHook(storage, { canUseBetting: false });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe(
      'Betting is not supported for the current storage',
    );
    expect(storage.getUserAvailablePoints).not.toHaveBeenCalled();
    expect(storage.getGamblingSettings).not.toHaveBeenCalled();
    expect(storage.getTodayBetAmount).not.toHaveBeenCalled();
  });

  it('loads all betting data through the storage port', async () => {
    const storage = createStorage();
    const { result } = renderDataHook(storage);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.availablePoints).toBe(120);
    expect(result.current.gamblingSettings).toEqual(settings);
    expect(result.current.todayBetAmount).toBe(15);
    expect(storage.getUserAvailablePoints).toHaveBeenCalledTimes(1);
    expect(storage.getGamblingSettings).toHaveBeenCalledTimes(1);
    expect(storage.getTodayBetAmount).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      source: 'available points',
      create: () =>
        createStorage({
          getUserAvailablePoints: vi
            .fn<GetUserAvailablePoints>()
            .mockResolvedValue(err(storageError)),
        }),
    },
    {
      source: 'gambling settings',
      create: () =>
        createStorage({
          getGamblingSettings: vi
            .fn<GetGamblingSettings>()
            .mockResolvedValue(err(storageError)),
        }),
    },
    {
      source: 'today bet amount',
      create: () =>
        createStorage({
          getTodayBetAmount: vi
            .fn<GetTodayBetAmount>()
            .mockResolvedValue(err(storageError)),
        }),
    },
  ])(
    'does not commit partial state when $source returns an error Result',
    async ({ create }) => {
      const storage = create();
      const { result } = renderDataHook(storage);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBe('betting data unavailable');
      expect(result.current.availablePoints).toBe(0);
      expect(result.current.gamblingSettings).toBeNull();
      expect(result.current.todayBetAmount).toBe(0);
    },
  );

  it('surfaces a safe error when the storage boundary throws', async () => {
    const storage = createStorage({
      getUserAvailablePoints: vi
        .fn<GetUserAvailablePoints>()
        .mockRejectedValue(new Error('request exploded')),
    });
    const { result } = renderDataHook(storage);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('request exploded');
    expect(result.current.availablePoints).toBe(0);
    expect(result.current.gamblingSettings).toBeNull();
    expect(result.current.todayBetAmount).toBe(0);
  });

  it('retries through loadData and replaces the failed state with fresh data', async () => {
    const getUserAvailablePoints = vi
      .fn<GetUserAvailablePoints>()
      .mockResolvedValueOnce(err(storageError))
      .mockResolvedValueOnce(ok(90));
    const storage = createStorage({ getUserAvailablePoints });
    const { result } = renderDataHook(storage);

    await waitFor(() =>
      expect(result.current.error).toBe('betting data unavailable'),
    );

    await act(async () => {
      await result.current.loadData();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.availablePoints).toBe(90);
    expect(result.current.gamblingSettings).toEqual(settings);
    expect(result.current.todayBetAmount).toBe(15);
    expect(getUserAvailablePoints).toHaveBeenCalledTimes(2);
    expect(storage.getGamblingSettings).toHaveBeenCalledTimes(2);
    expect(storage.getTodayBetAmount).toHaveBeenCalledTimes(2);
  });
});
