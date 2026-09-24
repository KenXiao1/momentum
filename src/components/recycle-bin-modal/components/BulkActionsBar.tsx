import { translate } from '../../../i18n/translate';
import { type Translator } from '../../../i18n';
import React from 'react';
import { CheckSquare, RotateCcw, Square, Trash2 } from 'lucide-react';

interface BulkActionsBarProps {
  deletedChainsCount: number;
  selectedChainsCount: number;
  language: 'zh' | 'en';
  t: Translator;
  onSelectAll: () => void;
  onBulkRestore: () => void;
  onBulkPermanentDelete: () => void;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  deletedChainsCount,
  selectedChainsCount,
  language,
  t,
  onSelectAll,
  onBulkRestore,
  onBulkPermanentDelete,
}) => {
  if (deletedChainsCount === 0) return null;

  return (
    <div className="border-b border-gray-200 bg-gray-50 p-6 dark:border-slate-600 dark:bg-slate-700/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={onSelectAll}
            aria-label={
              selectedChainsCount === deletedChainsCount
                ? t('recycleBinModal.bulkActionsBar.clearSelection')
                : t('recycleBinModal.bulkActionsBar.selectAll')
            }
            className="flex items-center space-x-2 text-sm text-gray-600 transition-colors hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {selectedChainsCount === deletedChainsCount ? (
              <CheckSquare size={16} />
            ) : (
              <Square size={16} />
            )}
            <span>
              {selectedChainsCount === deletedChainsCount
                ? t('recycleBinModal.bulkActionsBar.clearSelection')
                : t('recycleBinModal.bulkActionsBar.selectAll')}
            </span>
          </button>
          {selectedChainsCount > 0 && (
            <span className="text-sm text-gray-500 dark:text-slate-400">
              {translate(
                language === 'zh' ? 'zh' : 'en',
                'recycleBinModal.bulkActionsBar.selectedChainsCountSelected',
                { selectedChainsCount: selectedChainsCount },
              )}
            </span>
          )}
        </div>

        {selectedChainsCount > 0 && (
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onBulkRestore}
              aria-label={t('recycleBinModal.bulkActionsBar.restoreSelected')}
              className="flex items-center space-x-2 rounded-xl bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600"
            >
              <RotateCcw size={16} />
              <span>{t('recycleBinModal.bulkActionsBar.restoreSelected')}</span>
            </button>
            <button
              type="button"
              onClick={onBulkPermanentDelete}
              aria-label={t('recycleBinModal.bulkActionsBar.deletePermanently')}
              className="flex items-center space-x-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
            >
              <Trash2 size={16} />
              <span>
                {t('recycleBinModal.bulkActionsBar.deletePermanently')}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
