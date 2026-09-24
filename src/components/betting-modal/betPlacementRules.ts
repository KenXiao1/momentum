import { type Translator } from '../../i18n';
import type { GamblingSettings } from '../../domain/userSettings';

interface BetPlacementValidationParams {
  amount: string;
  availablePoints: number;
  todayBetAmount: number;
  settings: GamblingSettings | null;
  t: Translator;
}

export function getBetPlacementValidationError({
  amount,
  availablePoints,
  todayBetAmount,
  settings,
  t,
}: BetPlacementValidationParams): string | null {
  if (!amount.trim())
    return t('bettingModal.betPlacementRules.enterABetAmount');

  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return t('bettingModal.betPlacementRules.enterAValidBetAmount');
  }
  if (!Number.isInteger(value)) {
    return t('bettingModal.betPlacementRules.betAmountMustBeAnInteger');
  }
  if (value <= 0) {
    return t('bettingModal.betPlacementRules.betAmountMustBeGreaterThan0');
  }
  if (value > availablePoints) {
    return t(
      'bettingModal.betPlacementRules.notEnoughPointsAvailableAvailablePoints',
      { availablePoints: availablePoints },
    );
  }
  if (settings?.max_single_bet && value > settings.max_single_bet) {
    return t(
      'bettingModal.betPlacementRules.exceedsMaxSingleBetSettingsMaxSingleBet',
      { settingsMaxSingleBet: settings.max_single_bet },
    );
  }
  if (
    settings?.daily_bet_limit &&
    todayBetAmount + value > settings.daily_bet_limit
  ) {
    return t(
      'bettingModal.betPlacementRules.exceedsDailyLimitSettingsDailyBetLimitUsedTodayTodayBetAmount',
      {
        settingsDailyBetLimit: settings.daily_bet_limit,
        todayBetAmount: todayBetAmount,
      },
    );
  }
  return null;
}
