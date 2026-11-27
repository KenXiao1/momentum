import React from 'react';
import {
  ChainDetailActivity,
  ChainDetailHeader,
  ChainDetailHours,
  ChainDetailReminder,
  ChainDetailStats,
  ChainDetailStreak,
  ChainDetailExceptions,
  ChainDetailDescription,
  ChainDetailHistory,
  DeleteConfirmModal,
} from './chain-detail';
import type { ChainDetailViewProps } from './chain-detail';

const ChainDetailViewComponent: React.FC<ChainDetailViewProps> = ({
  chain,
  recentHistory,
  activity,
  hours,
  streak,
  reminder,
  tags,
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
          tags={tags}
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

            <ChainDetailReminder reminder={reminder} t={t} />

            <ChainDetailExceptions chain={chain} t={t} />
          </div>

          <div className="space-y-6 xl:col-span-2">
            <ChainDetailDescription description={chain.description} t={t} />

            <ChainDetailActivity calendar={activity} locale={locale} t={t} />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <ChainDetailHours hours={hours} t={t} />
              <ChainDetailStreak points={streak} locale={locale} t={t} />
            </div>

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
