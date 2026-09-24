import { type Translator } from '../../../i18n';
import React from 'react';
import { Trash2 } from 'lucide-react';

export const EmptyState: React.FC<{
  t: Translator;
}> = ({ t }) => (
  <div className="flex flex-1 items-center justify-center py-16">
    <div className="max-w-md px-8 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gray-100 dark:bg-slate-700">
        <Trash2 size={32} className="text-gray-400 dark:text-slate-500" />
      </div>
      <h3 className="mb-2 font-chinese text-xl font-bold text-gray-900 dark:text-slate-100">
        {t('recycleBinModal.emptyState.recycleBinIsEmpty')}
      </h3>
      <p className="mb-4 leading-relaxed text-gray-600 dark:text-slate-400">
        {t(
          'recycleBinModal.emptyState.deletedChainsAppearHereYouCanRestoreThemOr',
        )}
      </p>
    </div>
  </div>
);
