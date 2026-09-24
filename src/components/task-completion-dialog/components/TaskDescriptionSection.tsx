import { type Translator } from '../../../i18n';
import React from 'react';
import { FileText, History, RotateCcw } from 'lucide-react';

export const TaskDescriptionSection: React.FC<{
  t: Translator;
  isDurationless: boolean;
  description: string;
  onDescriptionChange: (value: string) => void;
  onDescriptionKeyDown: (event: React.KeyboardEvent) => void;
  descriptionInputRef: React.RefObject<HTMLInputElement>;
  recentDescriptions: string[];
  showQuickFill: boolean;
  onToggleQuickFill: () => void;
  onQuickFill: (description: string) => void;
}> = ({
  t,
  isDurationless,
  description,
  onDescriptionChange,
  onDescriptionKeyDown,
  descriptionInputRef,
  recentDescriptions,
  showQuickFill,
  onToggleQuickFill,
  onQuickFill,
}) => {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileText className="text-gray-500 dark:text-gray-400" size={16} />
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('chainEditor.description.title')}
            {isDurationless
              ? ' *'
              : t('taskCompletionDialog.taskDescriptionSection.optional')}
          </label>
        </div>

        {recentDescriptions.length > 0 && (
          <button
            type="button"
            onClick={onToggleQuickFill}
            aria-label={t(
              'taskCompletionDialog.taskDescriptionSection.showHistory',
            )}
            aria-expanded={showQuickFill}
            className="flex items-center space-x-1 text-xs text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <History size={14} />
            <span>
              {t('taskCompletionDialog.taskDescriptionSection.history')}
            </span>
          </button>
        )}
      </div>

      <input
        ref={descriptionInputRef}
        type="text"
        name="description"
        value={description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        onKeyDown={onDescriptionKeyDown}
        placeholder={
          isDurationless
            ? t(
                'taskCompletionDialog.taskDescriptionSection.eGFinishCs61aPart1TabToAddNotes',
              )
            : t(
                'taskCompletionDialog.taskDescriptionSection.eGFinishCs61aPart1OptionalTabToAdd',
              )
        }
        aria-label={t('chainEditor.description.title')}
        aria-required={isDurationless}
        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
        required={isDurationless}
      />

      {showQuickFill && recentDescriptions.length > 0 && (
        <div className="animate-slide-down mt-2 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-700/50 dark:bg-blue-900/20">
          <div className="mb-2 flex items-center space-x-2">
            <RotateCcw className="text-blue-600 dark:text-blue-400" size={14} />
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
              {t(
                'taskCompletionDialog.taskDescriptionSection.recentDescriptions',
              )}
            </span>
          </div>
          <div className="space-y-1">
            {recentDescriptions.map((desc, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onQuickFill(desc)}
                className="w-full truncate rounded-lg px-3 py-2 text-left text-sm text-blue-800 transition-colors hover:bg-blue-100 dark:text-blue-200 dark:hover:bg-blue-800/30"
                title={desc}
              >
                {desc}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {isDurationless
          ? t(
              'taskCompletionDialog.taskDescriptionSection.tabToAddNotesOrAutoFillShiftTabForHistory',
            )
          : t(
              'taskCompletionDialog.taskDescriptionSection.descriptionOptionalTabToAddNotesEnterToComplete',
            )}
      </p>
    </div>
  );
};
