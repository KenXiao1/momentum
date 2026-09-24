import { type Translator } from '../../../i18n';
import { Layers, Minus } from 'lucide-react';
import type { ChainTreeNode } from '../../../types';
import { DeleteConfirmDialogShell } from '../../shared/DeleteConfirmDialogShell';

export function GroupDeleteConfirmDialog({
  isOpen,
  group,
  t,
  onCancel,
  onConfirm,
}: {
  isOpen: boolean;
  group: ChainTreeNode;
  t: Translator;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <DeleteConfirmDialogShell
      isOpen={isOpen}
      titleId="group-delete-dialog-title"
      descriptionId="group-delete-dialog-description"
      headerIcon={
        <Layers className="text-red-500" size={24} aria-hidden="true" />
      }
      title={t('groupCard.groupDeleteConfirmDialog.deleteGroup')}
      description={
        <>
          {t(
            'groupCard.groupDeleteConfirmDialog.areYouSureYouWantToDeleteTheGroup',
          )}
          <span className="font-semibold text-primary-500">{group.name}</span>
          {t('chainCard.chainDeleteConfirmModal.label')}
        </>
      }
      warningContent={
        <div className="mb-8 rounded-2xl border border-red-200/60 bg-red-50/80 p-6 dark:border-red-800/40 dark:bg-red-900/20">
          <div className="mb-6 text-center">
            <p className="font-chinese text-sm font-medium text-red-600 dark:text-red-400">
              {t(
                'groupCard.groupDeleteConfirmDialog.thisWillDeleteTheEntireGroupAndAllChild',
              )}
            </p>
          </div>
          <div className="max-h-32 space-y-2 overflow-y-auto">
            {group.children.map((child) => (
              <div
                key={child.id}
                className="flex items-center space-x-2 text-sm text-red-600 dark:text-red-400"
              >
                <Minus size={12} aria-hidden="true" />
                <span className="font-chinese">{child.name}</span>
              </div>
            ))}
          </div>
        </div>
      }
      cancelLabel={t('chainCard.chainDeleteConfirmModal.cancel')}
      confirmLabel={t('chainCard.chainDeleteConfirmModal.delete')}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
