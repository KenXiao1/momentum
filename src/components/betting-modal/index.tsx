import { type Translator } from '../../i18n';
/**
 * BettingModalView - 纯展示组件
 */

import React from 'react';

import { BettingForm } from './BettingForm';
import { BettingHeader } from './BettingHeader';
import { ErrorState, LoadingState, SuccessState } from './BettingStates';

interface BettingModalViewProps {
  isOpen: boolean;
  chainName: string;
  taskDuration: number;
  language: 'zh' | 'en';
  t: Translator;

  // 状态
  betAmount: string;
  availablePoints: number;
  todayBetAmount: number;
  isPlacingBet: boolean;
  isLoading: boolean;
  error: string | null;
  validationError: string | null;
  successMessage: string | null;
  quickBetOptions: number[];

  // 事件处理器
  onClose: () => void;
  onBetAmountChange: (value: string) => void;
  onQuickBetAmount: (amount: number) => void;
  onPlaceBet: () => void;
  onReload: () => void;

  // Refs
  focusTrapRef: React.RefObject<HTMLDivElement>;
}

const BettingModalViewComponent: React.FC<BettingModalViewProps> = ({
  isOpen,
  chainName,
  taskDuration,
  language,
  t,
  betAmount,
  availablePoints,
  todayBetAmount,
  isPlacingBet,
  isLoading,
  error,
  validationError,
  successMessage,
  quickBetOptions,
  onClose,
  onBetAmountChange,
  onQuickBetAmount,
  onPlaceBet,
  onReload,
  focusTrapRef,
}) => {
  if (!isOpen) return null;

  let content: React.ReactNode;
  if (isLoading) {
    content = <LoadingState t={t} />;
  } else if (error) {
    content = <ErrorState error={error} t={t} onReload={onReload} />;
  } else if (successMessage) {
    content = <SuccessState successMessage={successMessage} t={t} />;
  } else {
    content = (
      <BettingForm
        chainName={chainName}
        taskDuration={taskDuration}
        language={language}
        t={t}
        betAmount={betAmount}
        availablePoints={availablePoints}
        todayBetAmount={todayBetAmount}
        isPlacingBet={isPlacingBet}
        validationError={validationError}
        quickBetOptions={quickBetOptions}
        onBetAmountChange={onBetAmountChange}
        onQuickBetAmount={onQuickBetAmount}
        onPlaceBet={onPlaceBet}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="betting-modal-title"
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
      >
        <BettingHeader t={t} onClose={onClose} />

        <div className="p-6">{content}</div>
      </div>
    </div>
  );
};

export const BettingModalView = React.memo(BettingModalViewComponent);
