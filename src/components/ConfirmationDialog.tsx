import { useI18n } from '../i18n';
import React, { useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { DialogShell } from './shared/DialogShell';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  confirmButtonClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  confirmButtonClass = 'bg-red-500 hover:bg-red-600',
  onConfirm,
  onCancel,
}) => {
  const { t } = useI18n();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  if (!isOpen) return null;

  return (
    <DialogShell
      titleId="confirmation-dialog-title"
      onClose={onCancel}
      initialFocusRef={cancelButtonRef}
      role="dialog"
      overlayClassName="z-[60]"
      className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-slate-600">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 dark:bg-orange-900/20">
            <AlertTriangle
              size={20}
              className="text-orange-600 dark:text-orange-400"
            />
          </div>
          <h3
            id="confirmation-dialog-title"
            className="font-chinese text-xl font-bold text-gray-900 dark:text-slate-100"
          >
            {title}
          </h3>
        </div>
        <button
          ref={cancelButtonRef}
          type="button"
          onClick={onCancel}
          aria-label={t('accountModal.close')}
          className="focus-ring flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 transition-colors hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          <X size={22} className="text-gray-600 dark:text-slate-300" />
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        <p className="whitespace-pre-line leading-relaxed text-gray-700 dark:text-slate-300">
          {message}
        </p>
      </div>

      {/* Actions */}
      <div className="flex space-x-3 p-6 pt-0">
        <button
          type="button"
          onClick={onCancel}
          className="focus-ring flex-1 rounded-xl bg-gray-100 px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`focus-ring flex-1 rounded-xl px-4 py-3 font-medium text-white transition-colors ${confirmButtonClass}`}
        >
          {confirmText}
        </button>
      </div>
    </DialogShell>
  );
};
