import { useCallback, useMemo, useState } from 'react';
import type { Chain, ChainTreeNode, ScheduledSession } from '../../types';
import {
  getChainTypeConfig,
  getGroupProgress,
  getGroupUnitProgress,
  getNextUnitInGroup,
} from '../../utils/chainTree';
import { getGroupTimeStatus } from '../../utils/timeLimit';
import { useI18n } from '../../i18n';
import { GroupViewView } from './GroupViewView';

interface GroupViewProps {
  group: ChainTreeNode;
  scheduledSessions: ScheduledSession[];
  availableUnits: Chain[];
  onBack: () => void;
  onStartChain: (chainId: string) => void;
  onScheduleChain: (chainId: string) => void;
  onEditChain: (chainId: string) => void;
  onDeleteChain: (chainId: string) => void;
  onAddUnit: () => void;
  onImportUnits: (
    unitIds: string[],
    groupId: string,
    mode?: 'move' | 'copy',
  ) => void;
  onUpdateTaskRepeatCount?: (chainId: string, repeatCount: number) => void;
  onReorderUnit?: (
    groupId: string,
    unitId: string,
    direction: 'up' | 'down',
  ) => void;
  onViewDetail: (chainId: string) => void;
}

export function GroupView({
  group,
  scheduledSessions,
  availableUnits,
  onBack,
  onStartChain,
  onScheduleChain,
  onEditChain,
  onDeleteChain,
  onAddUnit,
  onImportUnits,
  onUpdateTaskRepeatCount,
  onReorderUnit,
  onViewDetail,
}: GroupViewProps) {
  const { language, t } = useI18n();
  const progress = getGroupProgress(group);
  const unitProgress = getGroupUnitProgress(group);
  const nextUnit = getNextUnitInGroup(group);
  const typeConfig = getChainTypeConfig(group.type, language);
  const timeStatus = getGroupTimeStatus(group, language);

  const [showImportModal, setShowImportModal] = useState(false);
  const [showRepeatModal, setShowRepeatModal] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [repeatCount, setRepeatCount] = useState(1);

  const scheduledSessionByChainId = useMemo(() => {
    const map = new Map<string, ScheduledSession>();
    for (const session of scheduledSessions) {
      map.set(session.chainId, session);
    }
    return map;
  }, [scheduledSessions]);

  const getScheduledSession = useCallback(
    (chainId: string) => {
      return scheduledSessionByChainId.get(chainId);
    },
    [scheduledSessionByChainId],
  );

  const handleOpenRepeatModal = useCallback((unit: ChainTreeNode) => {
    setSelectedUnitId(unit.id);
    setRepeatCount(unit.taskRepeatCount || 1);
    setShowRepeatModal(true);
  }, []);

  const handleUpdateRepeatCount = useCallback(() => {
    if (onUpdateTaskRepeatCount && selectedUnitId) {
      onUpdateTaskRepeatCount(selectedUnitId, repeatCount);
    }
    setShowRepeatModal(false);
    setSelectedUnitId('');
  }, [onUpdateTaskRepeatCount, repeatCount, selectedUnitId]);

  return (
    <GroupViewView
      group={group}
      availableUnits={availableUnits}
      onBack={onBack}
      onStartChain={onStartChain}
      onScheduleChain={onScheduleChain}
      onEditChain={onEditChain}
      onDeleteChain={onDeleteChain}
      onAddUnit={onAddUnit}
      onImportUnits={onImportUnits}
      onReorderUnit={onReorderUnit}
      onViewDetail={onViewDetail}
      getScheduledSession={getScheduledSession}
      language={language}
      t={t}
      progress={progress}
      unitProgress={unitProgress}
      nextUnit={nextUnit}
      typeConfig={typeConfig}
      timeStatus={timeStatus}
      showImportModal={showImportModal}
      setShowImportModal={setShowImportModal}
      showRepeatModal={showRepeatModal}
      setShowRepeatModal={setShowRepeatModal}
      repeatCount={repeatCount}
      setRepeatCount={setRepeatCount}
      handleOpenRepeatModal={handleOpenRepeatModal}
      handleUpdateRepeatCount={handleUpdateRepeatCount}
    />
  );
}
