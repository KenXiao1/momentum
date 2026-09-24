/**
 * ChainDetailContainer - Container 组件
 * 负责状态管理和业务逻辑，将展示委托给 ChainDetailView
 */

import React from 'react';
import { ChainDetailView } from './ChainDetailView';
import { useChainDetail } from './useChainDetail';
import type { Chain, CompletionHistory } from '../types';

interface ChainDetailProps {
  chain: Chain;
  history: CompletionHistory[];
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const ChainDetailContainer: React.FC<ChainDetailProps> = React.memo(
  ({ chain, history, onBack, onEdit, onDelete }) => {
    const {
      showDeleteConfirm,
      recentHistory,
      successRate,
      chainHistoryCount,
      language,
      locale,
      t,
      formatFailureReason,
      handleDeleteClick,
      handleDeleteConfirm,
      handleDeleteCancel,
    } = useChainDetail({ chain, history, onDelete });

    return (
      <ChainDetailView
        chain={chain}
        recentHistory={recentHistory}
        chainHistoryCount={chainHistoryCount}
        successRate={successRate}
        showDeleteConfirm={showDeleteConfirm}
        language={language}
        locale={locale}
        t={t}
        formatFailureReason={formatFailureReason}
        onBack={onBack}
        onEdit={onEdit}
        onDeleteClick={handleDeleteClick}
        onDeleteConfirm={handleDeleteConfirm}
        onDeleteCancel={handleDeleteCancel}
      />
    );
  },
);

ChainDetailContainer.displayName = 'ChainDetailContainer';
