import React from 'react';
import {
  ChainDetailHeader,
  ChainDetailStats,
  ChainDetailExceptions,
  ChainDetailDescription,
  ChainDetailHistory,
  DeleteConfirmModal,
} from './chain-detail';
import type { ChainDetailViewProps } from './chain-detail';

const ChainDetailViewComponent: React.FC<ChainDetailViewProps> = ({
  chain,
  recentHistory,
  chainHistoryCount,
  successRate,
  showDeleteConfirm,
  language,
  locale,
  t,
  formatFailureReason,
  onBack,
  onEdit,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
}) => {
  return (
    <div className="bg-background min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <ChainDetailHeader
          chainName={chain.name}
          t={t}
          onBack={onBack}
          onEdit={onEdit}
          onDeleteClick={onDeleteClick}
        />

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-1">
            <ChainDetailStats
              chain={chain}
              successRate={successRate}
              language={language}
              t={t}
            />

            <ChainDetailExceptions chain={chain} t={t} />
          </div>

          <div className="space-y-6 xl:col-span-2">
            <ChainDetailDescription description={chain.description} t={t} />

            <ChainDetailHistory
              recentHistory={recentHistory}
              locale={locale}
              language={language}
              t={t}
              formatFailureReason={formatFailureReason}
            />
          </div>
        </div>

        {showDeleteConfirm && (
          <DeleteConfirmModal
            chain={chain}
            chainHistoryCount={chainHistoryCount}
            successRate={successRate}
            language={language}
            t={t}
            onConfirm={onDeleteConfirm}
            onCancel={onDeleteCancel}
          />
        )}
      </div>
    </div>
  );
};

export const ChainDetailView = React.memo(ChainDetailViewComponent);
