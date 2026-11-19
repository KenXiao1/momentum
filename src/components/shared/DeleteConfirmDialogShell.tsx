import type React from 'react';
import { Trash2 } from 'lucide-react';
import { DialogShell } from './DialogShell';

interface DeleteConfirmDialogShellProps {
  isOpen: boolean;
  titleId: string;
  descriptionId: string;
  title: React.ReactNode;
  description: React.ReactNode;
  warningContent: React.ReactNode;
  headerIcon: React.ReactNode;
  cancelLabel: React.ReactNode;
  confirmLabel: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  confirmIcon?: React.ReactNode;
}

export function DeleteConfirmDialogShell({
  isOpen,
  titleId,
  descriptionId,
  title,
  description,
  warningContent,
  headerIcon,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  confirmIcon,
}: DeleteConfirmDialogShellProps) {
  if (!isOpen) return null;

  return (
    <DialogShell
      titleId={titleId}
      descriptionId={descriptionId}
      role="alertdialog"
      onClose={onCancel}
      className="w-full max-w-lg animate-scale-in overflow-y-auto rounded-3xl border border-gray-200/60 bg-white/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8 dark:border-slate-600/60 dark:bg-slate-800/95"
    >
      <div className="mb-8 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 dark:bg-red-500/20">
          {headerIcon}
        </div>
        <h3
          id={titleId}
          className="mb-3 font-chinese text-2xl font-bold text-[#161615] dark:text-slate-100"
        >
          {title}
        </h3>
        <p
          id={descriptionId}
          className="mb-6 text-gray-600 dark:text-slate-300"
        >
          {description}
        </p>
      </div>

      {warningContent}

      <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4">
        <button
          type="button"
          data-cancel-button
          onClick={(event) => {
            event.stopPropagation();
            onCancel();
          }}
          className="focus-ring flex-1 rounded-2xl bg-gray-100 px-6 py-4 font-chinese font-medium text-gray-700 transition duration-300 hover:scale-105 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onConfirm();
          }}
          className="focus-ring flex flex-1 items-center justify-center space-x-2 rounded-2xl bg-red-500 px-6 py-4 font-chinese font-medium text-white shadow-lg transition duration-300 hover:scale-105 hover:bg-red-600 hover:shadow-xl"
        >
          {confirmIcon ?? <Trash2 size={16} aria-hidden="true" />}
          <span>{confirmLabel}</span>
        </button>
      </div>
    </DialogShell>
  );
}
