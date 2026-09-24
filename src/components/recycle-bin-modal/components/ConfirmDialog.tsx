import { type Translator } from '../../../i18n';
import React from 'react';
import { ConfirmationDialog } from '../../ConfirmationDialog';
import type { ConfirmDialogState } from '../types';

interface ConfirmDialogProps {
  showConfirmDialog: ConfirmDialogState;
  t: Translator;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  showConfirmDialog,
  t,
  onConfirm,
  onCancel,
}) => (
  <ConfirmationDialog
    isOpen={true}
    title={
      showConfirmDialog.type === 'restore'
        ? t('recycleBinModal.confirmDialog.confirmRestore')
        : t('recycleBinModal.confirmDialog.confirmPermanentDeletion')
    }
    message={
      showConfirmDialog.type === 'restore'
        ? t(
            'recycleBinModal.confirmDialog.restoreTheFollowingShowConfirmDialogChainIdsCountChainSShowConfirmDialogChainNames',
            {
              showConfirmDialogChainIdsCount: showConfirmDialog.chainIds.length,
              showConfirmDialogChainNames:
                showConfirmDialog.chainNames.join(', '),
            },
          )
        : t(
            'recycleBinModal.confirmDialog.permanentlyDeleteTheFollowingShowConfirmDialogChainIdsCountChainSShowConfirmDialogChainNamesThis',
            {
              showConfirmDialogChainIdsCount: showConfirmDialog.chainIds.length,
              showConfirmDialogChainNames:
                showConfirmDialog.chainNames.join(', '),
            },
          )
    }
    confirmText={
      showConfirmDialog.type === 'restore'
        ? t('deletedChainCard.restore')
        : t('recycleBinModal.bulkActionsBar.deletePermanently')
    }
    cancelText={t('bettingModal.bettingFormSections.cancel')}
    confirmButtonClass={
      showConfirmDialog.type === 'restore'
        ? 'bg-green-500 hover:bg-green-600'
        : 'bg-red-500 hover:bg-red-600'
    }
    onConfirm={onConfirm}
    onCancel={onCancel}
  />
);
