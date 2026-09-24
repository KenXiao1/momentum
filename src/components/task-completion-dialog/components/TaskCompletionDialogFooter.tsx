import { type Translator } from '../../../i18n';
import React from 'react';

export const TaskCompletionDialogFooter: React.FC<{
  t: Translator;
  disableComplete: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}> = ({ t, disableComplete, onCancel, onSubmit }) => {
  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-700/50">
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          aria-label={t('bettingModal.bettingFormSections.cancel')}
          className="px-4 py-2 text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {t('bettingModal.bettingFormSections.cancel')}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disableComplete}
          aria-label={t(
            'taskCompletionDialog.taskCompletionDialogFooter.completeTask',
          )}
          className="rounded-xl bg-green-600 px-6 py-2 text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {t('focusMode.focusModeControls.complete')}
        </button>
      </div>
    </div>
  );
};
