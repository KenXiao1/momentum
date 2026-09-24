/**
 * RecycleBinModalContainer - Container 组件
 * 负责状态管理和业务逻辑，将展示委托给 RecycleBinModalView
 */

import React from 'react';
import { RecycleBinModalView } from './RecycleBinModalView';
import { useRecycleBinModal } from './useRecycleBinModal';
import type { AsyncOrSyncVoid } from './recycle-bin-modal/types';

interface RecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (chainIds: string[]) => AsyncOrSyncVoid;
  onPermanentDelete: (chainIds: string[]) => AsyncOrSyncVoid;
}

export const RecycleBinModalContainer: React.FC<RecycleBinModalProps> =
  React.memo(({ isOpen, onClose, onRestore, onPermanentDelete }) => {
    const {
      deletedChains,
      selectedChains,
      isLoading,
      showConfirmDialog,
      language,
      t,
      formatDeletedTime,
      handleSelectChain,
      handleSelectAll,
      handleSingleRestore,
      handleSinglePermanentDelete,
      handleBulkRestore,
      handleBulkPermanentDelete,
      handleConfirmAction,
      handleCancelConfirm,
    } = useRecycleBinModal({ isOpen, onClose, onRestore, onPermanentDelete });

    return (
      <RecycleBinModalView
        isOpen={isOpen}
        language={language}
        t={t}
        deletedChains={deletedChains}
        selectedChains={selectedChains}
        isLoading={isLoading}
        showConfirmDialog={showConfirmDialog}
        formatDeletedTime={formatDeletedTime}
        onClose={onClose}
        onSelectChain={handleSelectChain}
        onSelectAll={handleSelectAll}
        onSingleRestore={handleSingleRestore}
        onSinglePermanentDelete={handleSinglePermanentDelete}
        onBulkRestore={handleBulkRestore}
        onBulkPermanentDelete={handleBulkPermanentDelete}
        onConfirmAction={handleConfirmAction}
        onCancelConfirm={handleCancelConfirm}
      />
    );
  });

RecycleBinModalContainer.displayName = 'RecycleBinModalContainer';
