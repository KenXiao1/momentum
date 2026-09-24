import { translate } from '../../i18n/translate';
import React from 'react';
import {
  CheckCircle,
  Dices,
  Loader2,
  Star,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type {
  BetAmountInputProps,
  BetButtonsProps,
  PointsInfoProps,
  TaskInfoProps,
  TranslationFn,
} from './types';

export const TaskInfo: React.FC<TaskInfoProps> = ({
  chainName,
  taskDuration,
  t,
}) => (
  <div className="space-y-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-700">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Target className="h-5 w-5 text-primary-500" />
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {t('bettingModal.bettingFormSections.chain')}
        </span>
      </div>
      <span className="text-gray-700 dark:text-gray-300">{chainName}</span>
    </div>
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Zap className="h-5 w-5 text-yellow-500" />
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {t('bettingModal.bettingFormSections.duration')}
        </span>
      </div>
      <span className="text-gray-700 dark:text-gray-300">
        {t('bettingModal.bettingFormSections.taskDurationMin', {
          taskDuration: taskDuration,
        })}
      </span>
    </div>
  </div>
);

export const PointsInfo: React.FC<PointsInfoProps> = ({
  availablePoints,
  todayBetAmount,
  t,
}) => (
  <div className="grid grid-cols-2 gap-4">
    <div className="rounded-xl bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 dark:from-yellow-900/20 dark:to-yellow-800/20">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
            {t('bettingModal.bettingFormSections.available')}
          </p>
          <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
            {availablePoints}
          </p>
        </div>
        <Star className="h-6 w-6 text-yellow-500" />
      </div>
    </div>

    <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 p-4 dark:from-blue-900/20 dark:to-blue-800/20">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {t('bettingModal.bettingFormSections.betToday')}
          </p>
          <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
            {todayBetAmount}
          </p>
        </div>
        <TrendingUp className="h-6 w-6 text-blue-500" />
      </div>
    </div>
  </div>
);

export const BetAmountInput: React.FC<BetAmountInputProps> = ({
  betAmount,
  availablePoints,
  language,
  t,
  quickBetOptions,
  onBetAmountChange,
  onQuickBetAmount,
}) => (
  <div className="space-y-3">
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
      {t('bettingModal.bettingFormSections.betAmount')}
    </label>
    <div className="relative">
      <input
        type="number"
        name="betAmount"
        min="1"
        max={availablePoints}
        value={betAmount}
        onChange={(e) => onBetAmountChange(e.target.value)}
        placeholder={t('bettingModal.bettingFormSections.enterPointsToBet')}
        aria-label={t('bettingModal.bettingFormSections.betAmount')}
        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 transition-colors focus:border-transparent focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
      />
      {betAmount && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 transform text-sm text-gray-500 dark:text-gray-400">
          {translate(
            language === 'zh' ? 'zh' : 'en',
            'bettingModal.bettingFormSections.betAmountPts',
            { betAmount: betAmount },
          )}
        </div>
      )}
    </div>

    {quickBetOptions.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {quickBetOptions.map((amount) => (
          <button
            type="button"
            key={amount}
            onClick={() => onQuickBetAmount(amount)}
            aria-label={t(
              'bettingModal.bettingFormSections.quickBetAmountPoints',
              { amount: amount },
            )}
            className="focus-ring rounded-lg bg-gray-100 px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
          >
            {amount}
          </button>
        ))}
        {availablePoints > 0 && (
          <button
            type="button"
            onClick={() => onQuickBetAmount(availablePoints)}
            aria-label={t(
              'bettingModal.bettingFormSections.betAllAvailablePointsPoints',
              { availablePoints: availablePoints },
            )}
            className="focus-ring rounded-lg bg-primary-100 px-3 py-1 text-sm text-primary-700 transition-colors hover:bg-primary-200 dark:bg-primary-900/30 dark:text-primary-300 dark:hover:bg-primary-900/50"
          >
            {t('bettingModal.bettingFormSections.all')}
          </button>
        )}
      </div>
    )}
  </div>
);

export const ValidationError: React.FC<{ error: string }> = ({ error }) => (
  <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
  </div>
);

export const BettingRules: React.FC<{ t: TranslationFn }> = ({ t }) => (
  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
    <div className="flex items-start space-x-3">
      <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500">
        <CheckCircle className="h-3 w-3 text-white" />
      </div>
      <div className="space-y-1 text-sm">
        <p className="font-medium text-blue-700 dark:text-blue-300">
          {t('bettingModal.bettingFormSections.rules')}
        </p>
        <ul className="space-y-1 text-blue-600 dark:text-blue-400">
          <li>
            {t(
              'bettingModal.bettingFormSections.ifCompleted11PayoutDoubleReturn',
            )}
          </li>
          <li>{t('bettingModal.bettingFormSections.ifFailedLoseTheBet')}</li>
          <li>{t('bettingModal.bettingFormSections.onlyOneBetPerSession')}</li>
        </ul>
      </div>
    </div>
  </div>
);

export const BetButtons: React.FC<BetButtonsProps> = ({
  betAmount,
  availablePoints,
  isPlacingBet,
  validationError,
  t,
  onPlaceBet,
  onClose,
}) => {
  const isDisabled =
    isPlacingBet ||
    !betAmount ||
    validationError !== null ||
    availablePoints === 0;

  let primaryButtonContent: React.ReactNode;
  if (isPlacingBet) {
    primaryButtonContent = (
      <div className="flex items-center justify-center">
        <Loader2 className="mr-3 h-6 w-6 animate-spin" />
        {t('bettingModal.bettingFormSections.placingBet')}
      </div>
    );
  } else if (availablePoints === 0) {
    primaryButtonContent = t(
      'bettingModal.bettingFormSections.notEnoughPoints',
    );
  } else {
    primaryButtonContent = (
      <div className="flex items-center justify-center">
        <Dices className="mr-3 h-6 w-6" />
        {t('bettingModal.bettingFormSections.confirmBet')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onPlaceBet}
        disabled={isDisabled}
        aria-label={t('bettingModal.bettingFormSections.confirmBet')}
        className={`focus-ring w-full rounded-xl px-6 py-4 text-lg font-semibold transition duration-200 ${
          isDisabled
            ? 'cursor-not-allowed bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            : 'transform bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg hover:scale-[1.02] hover:from-red-600 hover:to-orange-600 hover:shadow-xl active:scale-[0.98]'
        } `}
      >
        {primaryButtonContent}
      </button>

      <button
        type="button"
        onClick={onClose}
        aria-label={t('bettingModal.bettingFormSections.cancelBet')}
        className="focus-ring w-full rounded-xl bg-gray-100 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
      >
        {t('bettingModal.bettingFormSections.cancel')}
      </button>
    </div>
  );
};
