import { type Translator } from '../../../i18n';
import React from 'react';
import { Trash2, X } from 'lucide-react';

interface HeaderProps {
  deletedChainsCount: number;
  language: 'zh' | 'en';
  t: Translator;
  onClose: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  deletedChainsCount,
  t,
  onClose,
}) => {
  const subtitle =
    deletedChainsCount === 1
      ? t('counts.recycleItem', { count: deletedChainsCount })
      : t('counts.recycleItems', { count: deletedChainsCount });

  return (
    <div className="flex items-center justify-between border-b border-gray-200 p-8 dark:border-slate-600">
      <div className="flex items-center space-x-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100 dark:bg-slate-700">
          <Trash2 size={20} className="text-gray-600 dark:text-slate-300" />
        </div>
        <div>
          <h2
            id="recycle-bin-modal-title"
            className="font-chinese text-2xl font-bold text-gray-900 dark:text-slate-100"
          >
            {t('dashboard.dashboardChainsSection.recycleBin')}
          </h2>
          <p className="font-mono text-sm text-gray-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('accountModal.close')}
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 transition-colors hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600"
      >
        <X size={24} className="text-gray-600 dark:text-slate-300" />
      </button>
    </div>
  );
};
