import { Copy, Save } from 'lucide-react';
import type { ChainEditorFormModel } from './hooks/useChainEditorForm';
import { useI18n } from '../../i18n';

interface ChainEditorActionsProps {
  isEditing: boolean;
  onCancel: () => void;
  form: ChainEditorFormModel;
}

export function ChainEditorActions({
  isEditing,
  onCancel,
  form,
}: ChainEditorActionsProps) {
  const { t } = useI18n();

  let saveButtonLabel: string;
  if (form.isCopyMode) {
    saveButtonLabel = t('chainEditor.chainEditorActions.createCopy');
  } else if (isEditing) {
    saveButtonLabel = t('chainEditor.chainEditorActions.saveChanges');
  } else {
    saveButtonLabel = t('chainEditor.chainEditorActions.createChain');
  }

  const containerClassName =
    'action-buttons flex animate-scale-in flex-col gap-4 pt-4 sm:flex-row sm:gap-6';
  const cancelButtonClassName =
    'focus-ring flex min-h-12 flex-1 items-center justify-center space-x-3 rounded-2xl bg-gray-100 px-8 py-4 font-chinese text-base font-medium text-gray-900 transition duration-300 hover:scale-105 hover:bg-gray-200 active:scale-[0.98] dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';
  const copyButtonClassName =
    'focus-ring flex min-h-12 flex-1 items-center justify-center space-x-3 rounded-2xl bg-indigo-50 px-8 py-4 font-chinese text-base font-medium text-indigo-600 transition duration-300 hover:scale-105 hover:bg-indigo-100 active:scale-[0.98] dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/30';
  const saveButtonClassName =
    'gradient-primary focus-ring flex min-h-12 flex-1 items-center justify-center space-x-3 rounded-2xl px-8 py-4 font-chinese text-base font-medium text-white shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl active:scale-[0.98]';

  return (
    <div className={containerClassName}>
      <button
        type="button"
        onClick={onCancel}
        className={cancelButtonClassName}
      >
        <span>{t('bettingModal.bettingFormSections.cancel')}</span>
      </button>

      {isEditing && (
        <button
          type="submit"
          onClick={() => form.setIsCopyMode(true)}
          className={copyButtonClassName}
        >
          <Copy size={20} />
          <span>{t('chainEditor.chainEditorActions.saveAsCopy')}</span>
        </button>
      )}

      <button type="submit" className={saveButtonClassName}>
        <Save size={20} />
        <span>{saveButtonLabel}</span>
      </button>
    </div>
  );
}
