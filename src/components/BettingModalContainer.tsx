/**
 * BettingModalContainer - Container 组件
 * 负责状态管理和业务逻辑，将展示委托给 BettingModalView
 */

import React from 'react';
import { BettingModalView } from './BettingModalView';
import { useBettingModal } from './useBettingModal';
import { useFocusTrap } from '../hooks/useFocusTrap';
import type { BetPlacementResult } from '../domain/betting';

interface BettingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBetPlaced?: (betResult: BetPlacementResult) => void;
  sessionId: string;
  chainName: string;
  taskDuration: number;
}

export const BettingModalContainer: React.FC<BettingModalProps> = React.memo(
  ({ isOpen, onClose, onBetPlaced, sessionId, chainName, taskDuration }) => {
    const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

    const {
      betAmount,
      availablePoints,
      todayBetAmount,
      isPlacingBet,
      isLoading,
      error,
      validationError,
      successMessage,
      quickBetOptions,
      language,
      t,
      handleBetAmountChange,
      setQuickBetAmount,
      handlePlaceBet,
      loadData,
    } = useBettingModal({ isOpen, sessionId, onBetPlaced });

    return (
      <BettingModalView
        isOpen={isOpen}
        chainName={chainName}
        taskDuration={taskDuration}
        language={language}
        t={t}
        betAmount={betAmount}
        availablePoints={availablePoints}
        todayBetAmount={todayBetAmount}
        isPlacingBet={isPlacingBet}
        isLoading={isLoading}
        error={error}
        validationError={validationError}
        successMessage={successMessage}
        quickBetOptions={quickBetOptions}
        onClose={onClose}
        onBetAmountChange={handleBetAmountChange}
        onQuickBetAmount={setQuickBetAmount}
        onPlaceBet={handlePlaceBet}
        onReload={loadData}
        focusTrapRef={focusTrapRef}
      />
    );
  },
);

BettingModalContainer.displayName = 'BettingModalContainer';
