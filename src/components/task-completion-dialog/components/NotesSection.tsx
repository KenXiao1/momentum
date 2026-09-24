import { type Translator } from '../../../i18n';
import React from 'react';
import { MessageSquare } from 'lucide-react';

export const NotesSection: React.FC<{
  t: Translator;
  isVisible: boolean;
  notes: string;
  onNotesChange: (value: string) => void;
  onNotesKeyDown: (event: React.KeyboardEvent) => void;
  notesTextareaRef: React.RefObject<HTMLTextAreaElement>;
  onShowNotes: () => void;
}> = ({
  t,
  isVisible,
  notes,
  onNotesChange,
  onNotesKeyDown,
  notesTextareaRef,
  onShowNotes,
}) => {
  if (isVisible) {
    return (
      <div className="animate-slide-down">
        <div className="mb-3 flex items-center space-x-2">
          <MessageSquare
            className="text-gray-500 dark:text-gray-400"
            size={16}
          />
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('taskCompletionDialog.notesSection.notesOptional')}
          </label>
        </div>
        <textarea
          ref={notesTextareaRef}
          name="notes"
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          onKeyDown={onNotesKeyDown}
          placeholder={t(
            'taskCompletionDialog.notesSection.addMoreDetailsOrThoughts',
          )}
          rows={3}
          aria-label={t('chainDetail.chainDetailHistory.notes')}
          className="w-full resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {t(
            'taskCompletionDialog.notesSection.ctrlEnterToCompleteEscToCancel',
          )}
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onShowNotes}
      aria-label={t('taskCompletionDialog.notesSection.addNotes')}
      className="text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
    >
      {t('taskCompletionDialog.notesSection.addNotesVariant2')}
    </button>
  );
};
