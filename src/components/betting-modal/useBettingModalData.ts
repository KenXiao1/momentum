import { type Translator } from '../../i18n';
import { useCallback, useEffect, useState } from 'react';
import type { GamblingSettings } from '../../domain/userSettings';
import type { Language } from '../../i18n';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import {
  getSafeErrorDetail,
  getSafeErrorDetailFromUnknown,
} from '../../utils/errorMessage';
import { normalizeUnknownError } from '../../utils/errors/normalizeError';
import { logger } from '../../utils/logger';

export function useBettingModalData(params: {
  isOpen: boolean;
  storage: Pick<
    MomentumStorage,
    'getUserAvailablePoints' | 'getGamblingSettings' | 'getTodayBetAmount'
  >;
  canUseBetting: boolean;
  language: Language;
  t: Translator;
}) {
  const { isOpen, storage, canUseBetting, language, t } = params;
  const [availablePoints, setAvailablePoints] = useState(0);
  const [todayBetAmount, setTodayBetAmount] = useState(0);
  const [gamblingSettings, setGamblingSettings] =
    useState<GamblingSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!isOpen) return;
    if (!canUseBetting) {
      setIsLoading(false);
      setError(
        t(
          'bettingModal.useBetPlacementForm.bettingIsNotSupportedForTheCurrentStorage',
        ),
      );
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const [pointsResult, settingsResult, todayBetsResult] = await Promise.all(
        [
          storage.getUserAvailablePoints(),
          storage.getGamblingSettings(),
          storage.getTodayBetAmount(),
        ],
      );
      const failedResult = [pointsResult, settingsResult, todayBetsResult].find(
        (result) => !result.ok,
      );
      if (failedResult && !failedResult.ok) {
        setError(
          getSafeErrorDetail(failedResult.error.message || '', language) ??
            t(
              'bettingModal.useBettingModalData.failedToLoadDataCheckTheConsoleForDetails',
            ),
        );
        return;
      }
      if (pointsResult.ok && settingsResult.ok && todayBetsResult.ok) {
        setAvailablePoints(pointsResult.value);
        setGamblingSettings(settingsResult.value);
        setTodayBetAmount(todayBetsResult.value);
      }
    } catch (error) {
      logger.error(
        'BETTING',
        'Failed to load betting data',
        undefined,
        normalizeUnknownError(error),
      );
      setError(
        getSafeErrorDetailFromUnknown(error, language) ??
          t(
            'bettingModal.useBettingModalData.failedToLoadDataCheckTheConsoleForDetails',
          ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [canUseBetting, isOpen, language, storage, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return {
    availablePoints,
    setAvailablePoints,
    todayBetAmount,
    setTodayBetAmount,
    gamblingSettings,
    isLoading,
    error,
    setError,
    loadData,
  };
}
