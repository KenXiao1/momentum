/**
 * ChainCardContainer - Container 组件
 * 负责状态管理和业务逻辑，将展示委托给 ChainCardView
 */

import React from 'react';
import { ChainCardView } from './ChainCardView';
import { useChainCard } from './useChainCard';
import type { ChainCardProps } from './types';

export const ChainCard: React.FC<ChainCardProps> = React.memo(
  ({
    chain,
    scheduledSession,
    onStartChain,
    onScheduleChain,
    onViewDetail,
    onCancelScheduledSession,
    onCompleteBooking,
    onDelete,
  }) => {
    const {
      timeRemaining,
      showDeleteConfirm,
      showMenu,
      lastCompletionTime,
      isScheduled,
      typeConfig,
      language,
      t,
      handleToggleMenu,
      handleShowDeleteConfirm,
      handleConfirmDelete,
      handleCancelDelete,
    } = useChainCard({ chain, scheduledSession, onDelete });

    return (
      <ChainCardView
        chain={chain}
        typeConfig={typeConfig}
        language={language}
        t={t}
        timeRemaining={timeRemaining}
        isScheduled={!!isScheduled}
        showMenu={showMenu}
        showDeleteConfirm={showDeleteConfirm}
        lastCompletionTime={lastCompletionTime}
        scheduledSession={scheduledSession}
        onViewDetail={() => onViewDetail(chain.id)}
        onStartChain={() => onStartChain(chain.id)}
        onScheduleChain={() => onScheduleChain(chain.id)}
        onCompleteBooking={() => onCompleteBooking?.(chain.id)}
        onCancelScheduledSession={() => onCancelScheduledSession?.(chain.id)}
        onToggleMenu={handleToggleMenu}
        onShowDeleteConfirm={handleShowDeleteConfirm}
        onConfirmDelete={handleConfirmDelete}
        onCancelDelete={handleCancelDelete}
      />
    );
  },
);

ChainCard.displayName = 'ChainCard';
