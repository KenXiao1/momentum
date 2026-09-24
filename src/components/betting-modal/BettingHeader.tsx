import { type Translator } from '../../i18n';
import React from 'react';
import { Dices, X } from 'lucide-react';

interface BettingHeaderProps {
  t: Translator;
  onClose: () => void;
}

export const BettingHeader: React.FC<BettingHeaderProps> = ({ t, onClose }) => (
  <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
    <div className="flex items-center space-x-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg">
        <Dices className="text-white" size={20} />
      </div>
      <h2
        id="betting-modal-title"
        className="text-xl font-bold text-gray-900 dark:text-gray-100"
      >
        {t('bettingModal.bettingHeader.taskBet')}
      </h2>
    </div>
    <button
      type="button"
      onClick={onClose}
      aria-label={t('accountModal.close')}
      className="focus-ring rounded text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
    >
      <X size={24} />
    </button>
  </div>
);
