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

type BettingDataStorage = Pick<
  MomentumStorage,
  'getUserAvailablePoints' | 'getGamblingSettings' | 'getTodayBetAmount'
>;

type BettingDataOutcome =
  | {
      ok: true;
      availablePoints: number;
      gamblingSettings: GamblingSettings;
      todayBetAmount: number;
    }
  | { ok: false; error: string };

/** Reads all betting data; any failure yields an error and no partial data. */
async function readBettingData(
  storage: BettingDataStorage,
  language: Language,
  t: Translator,
): Promise<BettingDataOutcome> {
  try {
    const [pointsResult, settingsResult, todayBetsResult] = await Promise.all([
      storage.getUserAvailablePoints(),
      storage.getGamblingSettings(),
      storage.getTodayBetAmount(),
    ]);
    if (pointsResult.ok && settingsResult.ok && todayBetsResult.ok) {
      return {
        ok: true,
        availablePoints: pointsResult.value,
        gamblingSettings: settingsResult.value,
        todayBetAmount: todayBetsResult.value,
      };
    }
    const failedResult = [pointsResult, settingsResult, todayBetsResult].find(
      (result) => !result.ok,
    );
    const message =
      failedResult && !failedResult.ok ? failedResult.error.message : '';
    return {
      ok: false,
      error:
        getSafeErrorDetail(message || '', language) ??
        t(
          'bettingModal.useBettingModalData.failedToLoadDataCheckTheConsoleForDetails',
        ),
    };
  } catch (error) {
    logger.error(
      'BETTING',
      'Failed to load betting data',
      undefined,
      normalizeUnknownError(error),
    );
    return {
      ok: false,
      error:
        getSafeErrorDetailFromUnknown(error, language) ??
        t(
          'bettingModal.useBettingModalData.failedToLoadDataCheckTheConsoleForDetails',
        ),
    };
  }
}

export function useBettingModalData(params: {
  isOpen: boolean;
  storage: BettingDataStorage;
  canUseBetting: boolean;
  language: Language;
  t: Translator;
}) {
  const { isOpen, storage, canUseBetting, language, t } = params;
  const [availablePoints, setAvailablePoints] = useState(0);
  const [todayBetAmount, setTodayBetAmount] = useState(0);
  const [gamblingSettings, setGamblingSettings] =
    useState<GamblingSettings | null>(null);
  const [loadingState, setIsLoading] = useState(true);
  const [errorState, setError] = useState<string | null>(null);

  // Opening the modal (or switching storage while open) starts a fresh load.
  const loadRequest = isOpen && canUseBetting ? storage : null;
  const [previousLoadRequest, setPreviousLoadRequest] = useState(loadRequest);
  if (loadRequest !== previousLoadRequest) {
    setPreviousLoadRequest(loadRequest);
    if (loadRequest) {
      setIsLoading(true);
      setError(null);
    }
  }

  // An open modal on storage without betting has nothing to load.
  const isUnsupported = isOpen && !canUseBetting;
  const isLoading = isUnsupported ? false : loadingState;
  const error = isUnsupported
    ? (errorState ??
      t(
        'bettingModal.useBetPlacementForm.bettingIsNotSupportedForTheCurrentStorage',
      ))
    : errorState;

  const applyBettingData = useCallback((outcome: BettingDataOutcome) => {
    if (outcome.ok) {
      setAvailablePoints(outcome.availablePoints);
      setGamblingSettings(outcome.gamblingSettings);
      setTodayBetAmount(outcome.todayBetAmount);
      setError(null);
    } else {
      setError(outcome.error);
    }
    setIsLoading(false);
  }, []);

  const loadData = useCallback(async () => {
    if (!isOpen || !canUseBetting) return;
    setIsLoading(true);
    setError(null);
    applyBettingData(await readBettingData(storage, language, t));
  }, [applyBettingData, canUseBetting, isOpen, language, storage, t]);

  useEffect(() => {
    if (!isOpen || !canUseBetting) return;
    let cancelled = false;
    void readBettingData(storage, language, t).then((outcome) => {
      if (!cancelled) applyBettingData(outcome);
    });
    return () => {
      cancelled = true;
    };
  }, [applyBettingData, canUseBetting, isOpen, language, storage, t]);

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
