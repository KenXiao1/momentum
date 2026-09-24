import React from 'react';
import type { BettingFormProps } from './types';
import {
  BetAmountInput,
  BetButtons,
  BettingRules,
  PointsInfo,
  TaskInfo,
  ValidationError,
} from './BettingFormSections';

export const BettingForm: React.FC<BettingFormProps> = ({
  chainName,
  taskDuration,
  language,
  t,
  betAmount,
  availablePoints,
  todayBetAmount,
  isPlacingBet,
  validationError,
  quickBetOptions,
  onBetAmountChange,
  onQuickBetAmount,
  onPlaceBet,
  onClose,
}) => (
  <div className="space-y-6">
    <TaskInfo chainName={chainName} taskDuration={taskDuration} t={t} />

    <PointsInfo
      availablePoints={availablePoints}
      todayBetAmount={todayBetAmount}
      t={t}
    />

    <BetAmountInput
      betAmount={betAmount}
      availablePoints={availablePoints}
      language={language}
      t={t}
      quickBetOptions={quickBetOptions}
      onBetAmountChange={onBetAmountChange}
      onQuickBetAmount={onQuickBetAmount}
    />

    {validationError && <ValidationError error={validationError} />}

    <BettingRules t={t} />

    <BetButtons
      betAmount={betAmount}
      availablePoints={availablePoints}
      isPlacingBet={isPlacingBet}
      validationError={validationError}
      t={t}
      onPlaceBet={onPlaceBet}
      onClose={onClose}
    />
  </div>
);
