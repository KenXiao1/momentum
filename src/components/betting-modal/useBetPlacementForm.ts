import { translate } from '../../i18n/translate';
import { type Translator } from '../../i18n';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  BetPlacementRequest,
  BetPlacementResult,
} from '../../domain/betting';
import type { GamblingSettings } from '../../domain/userSettings';
import type { Language } from '../../i18n';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import {
  getSafeErrorDetail,
  getSafeErrorDetailFromUnknown,
} from '../../utils/errorMessage';
import { normalizeUnknownError } from '../../utils/errors/normalizeError';
import { logger } from '../../utils/logger';
import { getBetPlacementValidationError } from './betPlacementRules';

export function useBetPlacementForm(params: {
  isOpen: boolean;
  sessionId: string;
  onBetPlaced?: (result: BetPlacementResult) => void;
  storage: Pick<MomentumStorage, 'placeBet'>;
  canUseBetting: boolean;
  language: Language;
  t: Translator;
  availablePoints: number;
  setAvailablePoints: React.Dispatch<React.SetStateAction<number>>;
  todayBetAmount: number;
  setTodayBetAmount: React.Dispatch<React.SetStateAction<number>>;
  gamblingSettings: GamblingSettings | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const {
    availablePoints,
    canUseBetting,
    gamblingSettings,
    isOpen,
    language,
    onBetPlaced,
    sessionId,
    setAvailablePoints,
    setError,
    setTodayBetAmount,
    storage,
    todayBetAmount,
    t,
  } = params;
  const [betAmount, setBetAmount] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPlacingBet, setIsPlacingBet] = useState(false);

  const handleBetAmountChange = useCallback((value: string) => {
    setBetAmount(value);
    setValidationError(null);
  }, []);
  const setQuickBetAmount = useCallback((amount: number) => {
    setBetAmount(String(amount));
    setValidationError(null);
  }, []);

  const handlePlaceBet = useCallback(async () => {
    const validationMessage = getBetPlacementValidationError({
      amount: betAmount,
      availablePoints,
      todayBetAmount,
      settings: gamblingSettings,
      t,
    });
    setValidationError(validationMessage);
    if (validationMessage) return;
    if (!canUseBetting) {
      setError(
        t(
          'bettingModal.useBetPlacementForm.bettingIsNotSupportedForTheCurrentStorage',
        ),
      );
      return;
    }

    const numAmount = Number(betAmount);
    setIsPlacingBet(true);
    setError(null);
    try {
      const request: BetPlacementRequest = {
        session_id: sessionId,
        bet_amount: numAmount,
      };
      const result = await storage.placeBet(request);
      if (!result.ok || !result.value.success) {
        const message = result.ok ? result.value.message : result.error.message;
        setError(
          getSafeErrorDetail(message || '', language) ??
            t('bettingModal.useBetPlacementForm.betFailed'),
        );
        return;
      }
      setSuccessMessage(
        translate(
          language === 'zh' ? 'zh' : 'en',
          'bettingModal.useBetPlacementForm.betPlacedBetNumAmountPointsPotentialPayoutResultValuePotentialPayoutPoints',
          {
            numAmount: numAmount,
            resultValuePotentialPayout: result.value.potential_payout,
          },
        ),
      );
      setAvailablePoints(
        result.value.points_after ?? availablePoints - numAmount,
      );
      setTodayBetAmount((previous) => previous + numAmount);
      onBetPlaced?.(result.value);
    } catch (error) {
      logger.error(
        'BETTING',
        'Failed to place bet',
        { sessionId },
        normalizeUnknownError(error),
      );
      setError(
        getSafeErrorDetailFromUnknown(error, language) ??
          t(
            'bettingModal.useBetPlacementForm.betFailedCheckTheConsoleForDetailsThenTry',
          ),
      );
    } finally {
      setIsPlacingBet(false);
    }
  }, [
    availablePoints,
    betAmount,
    canUseBetting,
    gamblingSettings,
    language,
    onBetPlaced,
    sessionId,
    setAvailablePoints,
    setError,
    setTodayBetAmount,
    storage,
    todayBetAmount,
    t,
  ]);

  useEffect(() => {
    if (!isOpen) {
      setBetAmount('');
      setError(null);
      setValidationError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, setError]);

  const quickBetOptions = useMemo(
    () => [10, 25, 50, 100].filter((amount) => amount <= availablePoints),
    [availablePoints],
  );

  return {
    betAmount,
    isPlacingBet,
    validationError,
    successMessage,
    quickBetOptions,
    handleBetAmountChange,
    setQuickBetAmount,
    handlePlaceBet,
  };
}
