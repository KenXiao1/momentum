import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../../i18n';

interface InterruptConfirmDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function InterruptConfirmDialog({
  isOpen,
  onCancel,
  onConfirm,
}: InterruptConfirmDialogProps) {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-3xl border border-red-200 bg-white p-8 shadow-2xl dark:border-red-800 dark:bg-slate-800">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>

          <h3 className="mb-4 font-chinese text-2xl font-bold text-gray-900 dark:text-white">
            {t('focusMode.interruptConfirmDialog.interruptTask')}
          </h3>

          <p className="mb-8 font-chinese leading-relaxed text-gray-600 dark:text-gray-300">
            {t(
              'focusMode.interruptConfirmDialog.interruptingWillFailTheTaskAndResetYourMain',
            )}
          </p>

          <div className="flex space-x-4">
            <button
              onClick={onCancel}
              className="flex-1 rounded-2xl bg-gray-100 px-6 py-3 font-chinese text-gray-900 transition duration-300 hover:bg-gray-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
            >
              {t('bettingModal.bettingFormSections.cancel')}
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 rounded-2xl bg-red-500 px-6 py-3 font-chinese text-white shadow-lg transition duration-300 hover:bg-red-600"
            >
              {t('focusMode.interruptConfirmDialog.interrupt')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
