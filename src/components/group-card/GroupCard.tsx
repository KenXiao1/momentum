import React, { useMemo, useState } from 'react';
import type { ChainTreeNode, ScheduledSession } from '../../types';
import {
  getChainTypeConfig,
  getGroupProgress,
  getNextUnitInGroup,
} from '../../utils/chainTree';
import { useI18n } from '../../i18n';
import { GroupDeleteConfirmDialog } from './components/GroupDeleteConfirmDialog';
import { useGroupCardScheduleCountdown } from './hooks/useGroupCardScheduleCountdown';
import { GroupCardActions } from './components/GroupCardActions';
import { GroupCardSummary } from './components/GroupCardSummary';
import { CardOverflowMenu } from '../shared/CardOverflowMenu';

interface GroupCardProps {
  group: ChainTreeNode;
  scheduledSession?: ScheduledSession;
  onStartChain: (chainId: string) => void;
  onScheduleChain: (chainId: string) => void;
  onViewDetail: (chainId: string) => void;
  onCancelScheduledSession?: (chainId: string) => void;
  onCompleteBooking?: (chainId: string) => void;
  onDelete: (chainId: string) => void;
}

export const GroupCard: React.FC<GroupCardProps> = React.memo(
  ({
    group,
    scheduledSession,
    onStartChain,
    onScheduleChain,
    onViewDetail,
    onCancelScheduledSession,
    onCompleteBooking,
    onDelete,
  }) => {
    const { language, t } = useI18n();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const progress = useMemo(() => getGroupProgress(group), [group]);
    const nextUnit = useMemo(() => getNextUnitInGroup(group), [group]);
    const typeConfig = useMemo(
      () => getChainTypeConfig(group.type, language),
      [group.type, language],
    );

    const { timeRemaining } = useGroupCardScheduleCountdown({
      scheduledSession,
      group,
      nextUnit,
      t,
    });
    const activeScheduledSession = useMemo(
      () => (scheduledSession && timeRemaining > 0 ? scheduledSession : null),
      [scheduledSession, timeRemaining],
    );
    const handleDeleteClick = () => {
      setShowDeleteConfirm(true);
      setShowMenu(false);
    };

    const handleConfirmDelete = () => {
      onDelete(group.id);
      setShowDeleteConfirm(false);
    };

    const handleCancelDelete = () => {
      setShowDeleteConfirm(false);
    };

    return (
      <div className="relative">
        <div
          className="bento-card group animate-scale-in cursor-pointer border-l-4 border-l-blue-500"
          onClick={() => onViewDetail(group.id)}
          role="button"
          tabIndex={0}
          aria-label={t('groupCard.groupCard.viewDetailsGroupName', {
            groupName: group.name,
          })}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onViewDetail(group.id);
            }
          }}
        >
          <CardOverflowMenu
            isOpen={showMenu}
            moreLabel={t('chainCard.chainCardView.moreOptions')}
            deleteLabel={t('groupCard.groupCard.deleteGroup')}
            onToggle={() => setShowMenu((previous) => !previous)}
            onDelete={handleDeleteClick}
          />

          <GroupCardSummary
            group={group}
            progress={progress}
            typeConfig={typeConfig}
            language={language}
            t={t}
          />
          <GroupCardActions
            group={group}
            nextUnit={nextUnit}
            scheduledSession={activeScheduledSession}
            timeRemaining={timeRemaining}
            onStartChain={onStartChain}
            onScheduleChain={onScheduleChain}
            onCancelScheduledSession={onCancelScheduledSession}
            onCompleteBooking={onCompleteBooking}
            t={t}
          />
        </div>

        <GroupDeleteConfirmDialog
          isOpen={showDeleteConfirm}
          group={group}
          t={t}
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
        />
      </div>
    );
  },
);

GroupCard.displayName = 'GroupCard';
