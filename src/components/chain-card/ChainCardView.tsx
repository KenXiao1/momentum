import React from 'react';
import {
  getAuxiliarySignalLabel,
  getTriggerLabel,
} from '../chain-editor/constants';
import { CardOverflowMenu } from '../shared/CardOverflowMenu';
import { ChainExecutionActions } from '../shared/ChainExecutionActions';
import { ChainDeleteConfirmModal } from './components/ChainDeleteConfirmModal';
import { ChainCardMetrics } from './components/ChainCardMetrics';
import { ChainCardSummary } from './components/ChainCardSummary';
import type { ChainCardViewProps } from './types';

export const ChainCardView: React.FC<ChainCardViewProps> = React.memo(
  ({
    chain,
    typeConfig,
    language,
    t,
    timeRemaining,
    isScheduled,
    showMenu,
    showDeleteConfirm,
    lastCompletionTime,
    scheduledSession,
    onViewDetail,
    onStartChain,
    onScheduleChain,
    onCompleteBooking,
    onCancelScheduledSession,
    onToggleMenu,
    onShowDeleteConfirm,
    onConfirmDelete,
    onCancelDelete,
  }) => {
    const scheduled =
      isScheduled && scheduledSession
        ? {
            signal: getAuxiliarySignalLabel(
              scheduledSession.auxiliarySignal,
              language,
            ),
            timeRemaining,
            completionTrigger: getTriggerLabel(
              chain.auxiliaryCompletionTrigger,
              language,
            ),
          }
        : undefined;

    return (
      <div className="relative">
        <div
          className="bento-card group animate-scale-in cursor-pointer"
          onClick={onViewDetail}
          role="button"
          tabIndex={0}
          aria-label={t('chainCard.chainCardView.viewDetailsChainName', {
            chainName: chain.name,
          })}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onViewDetail();
            }
          }}
        >
          <CardOverflowMenu
            isOpen={showMenu}
            moreLabel={t('chainCard.chainCardView.moreOptions')}
            deleteLabel={t('chainCard.chainCardView.deleteChain')}
            onToggle={onToggleMenu}
            onDelete={onShowDeleteConfirm}
          />
          <ChainCardSummary
            chain={chain}
            typeConfig={typeConfig}
            language={language}
          />
          <ChainCardMetrics
            chain={chain}
            language={language}
            t={t}
            lastCompletionTime={lastCompletionTime}
          />
          <ChainExecutionActions
            scheduled={scheduled}
            signalPrefix={t('chainCard.chainCardView.signal')}
            completionPrefix={t(
              'chainCard.chainCardView.completeBeforeTimeRunsOut',
            )}
            completeLabel={t('chainCard.chainCardView.completeBooking')}
            interruptLabel={t('chainCard.chainCardView.interruptAdjudicate')}
            startLabel={t('chainCard.chainCardView.start')}
            scheduleLabel={t('chainCard.chainCardView.schedule')}
            onComplete={onCompleteBooking}
            onInterrupt={onCancelScheduledSession}
            onStart={onStartChain}
            onSchedule={onScheduleChain}
          />
        </div>

        <ChainDeleteConfirmModal
          isOpen={showDeleteConfirm}
          chain={chain}
          language={language}
          t={t}
          onCancel={onCancelDelete}
          onConfirm={onConfirmDelete}
        />
      </div>
    );
  },
);

ChainCardView.displayName = 'ChainCardView';
