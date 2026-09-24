import { type Translator } from '../../i18n';
import React from 'react';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export const LoadingState: React.FC<{
  t: Translator;
}> = ({ t }) => (
  <div className="py-8 text-center">
    <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary-500" />
    <p className="text-gray-600 dark:text-gray-300">
      {t('bettingModal.bettingStates.loadingBettingData')}
    </p>
  </div>
);

interface ErrorStateProps {
  error: string;
  t: Translator;
  onReload: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  t,
  onReload,
}) => (
  <div className="py-8 text-center">
    <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-500" />
    <p className="mb-4 text-red-600 dark:text-red-400">{error}</p>
    <button
      type="button"
      onClick={onReload}
      aria-label={t('bettingModal.bettingStates.reloadData')}
      className="focus-ring rounded font-medium text-primary-500 transition-colors hover:text-primary-600"
    >
      {t('bettingModal.bettingStates.reload')}
    </button>
  </div>
);

interface SuccessStateProps {
  successMessage: string;
  t: Translator;
}

export const SuccessState: React.FC<SuccessStateProps> = ({
  successMessage,
  t,
}) => (
  <div className="py-8 text-center">
    <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
    <p className="mb-2 text-lg font-medium text-green-700 dark:text-green-300">
      {t('bettingModal.bettingStates.betPlaced')}
    </p>
    <p className="text-sm text-gray-600 dark:text-gray-400">{successMessage}</p>
  </div>
);
