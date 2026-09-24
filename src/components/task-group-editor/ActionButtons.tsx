import { type Translator } from '../../i18n';
import React from 'react';
import { Save } from 'lucide-react';

interface ActionButtonsProps {
  isEditing: boolean;
  onCancel: () => void;
  t: Translator;
}

export const ActionButtons: React.FC<ActionButtonsProps> = React.memo(
  ({ isEditing, onCancel, t }) => (
    <div className="action-buttons flex animate-scale-in flex-col gap-4 pt-4 sm:flex-row sm:gap-6">
      <button
        type="button"
        onClick={onCancel}
        className="focus-ring flex min-h-12 flex-1 items-center justify-center space-x-3 rounded-2xl bg-gray-100 px-8 py-4 font-chinese text-base font-medium text-gray-900 transition duration-300 hover:scale-105 hover:bg-gray-200 active:scale-[0.98] dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
      >
        <span>{t('bettingModal.bettingFormSections.cancel')}</span>
      </button>
      <button
        type="submit"
        className="gradient-primary focus-ring flex min-h-12 flex-1 items-center justify-center space-x-3 rounded-2xl px-8 py-4 font-chinese text-base font-medium text-white shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl active:scale-[0.98]"
      >
        <Save size={20} />
        <span>
          {isEditing
            ? t('chainEditor.chainEditorActions.saveChanges')
            : t('taskGroupEditor.actionButtons.createGroup')}
        </span>
      </button>
    </div>
  ),
);

ActionButtons.displayName = 'ActionButtons';
