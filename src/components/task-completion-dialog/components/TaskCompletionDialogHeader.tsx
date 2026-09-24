import { type Translator } from '../../../i18n';
import React from 'react';
import { CheckCircle, X } from 'lucide-react';

export const TaskCompletionDialogHeader: React.FC<{
  chainName: string;
  t: Translator;
  onCancel: () => void;
}> = ({ chainName, t, onCancel }) => {
  return (
    <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
      <div className="flex items-center space-x-3">
        <div className="flex h-10 w-10 animate-completion-pop items-center justify-center rounded-2xl border border-green-200 bg-green-50 dark:border-green-500/30 dark:bg-green-500/10">
          <CheckCircle
            className="text-green-600 dark:text-green-400"
            size={20}
          />
        </div>
        <div>
          <h2
            id="task-completion-dialog-title"
            className="text-xl font-bold text-gray-900 dark:text-white"
          >
            {t('taskCompletionDialog.taskCompletionDialogFooter.completeTask')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {chainName}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onCancel}
        aria-label={t('accountModal.close')}
        className="rounded-xl bg-gray-100 p-2 text-gray-500 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
      >
        <X size={20} />
      </button>
    </div>
  );
};
