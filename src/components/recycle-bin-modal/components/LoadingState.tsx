import { type Translator } from '../../../i18n';
import React from 'react';

export const LoadingState: React.FC<{
  t: Translator;
}> = ({ t }) => (
  <div className="flex flex-1 items-center justify-center">
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 dark:bg-slate-700">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-gray-600"></div>
      </div>
      <p className="font-chinese text-gray-600 dark:text-slate-400">
        {t('recycleBinModal.loadingState.loading')}
      </p>
    </div>
  </div>
);
