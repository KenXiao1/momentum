import { type Translator } from '../../i18n';
import type React from 'react';
import type { Chain, ChainTreeNode, ScheduledSession } from '../../types';
import type { IconName } from '../../utils/iconMap';

interface ProgressInfo {
  completed: number;
  total: number;
}

interface TimeStatus {
  isExpired: boolean;
  remainingTime: number;
  formattedTime: string;
  progress: number;
}

interface ChainTypeConfig {
  icon: IconName;
  color: string;
  bgColor: string;
  name: string;
}

export interface GroupViewViewProps {
  group: ChainTreeNode;
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
  onReorderUnit?: (
    groupId: string,
    unitId: string,
    direction: 'up' | 'down',
  ) => void;
  onViewDetail: (chainId: string) => void;
  getScheduledSession: (chainId: string) => ScheduledSession | undefined;

  language: 'en' | 'zh';
  t: Translator;
  progress: ProgressInfo;
  unitProgress: ProgressInfo;
  nextUnit: ChainTreeNode | null;
  typeConfig: ChainTypeConfig;
  timeStatus: TimeStatus;

  showImportModal: boolean;
  setShowImportModal: React.Dispatch<React.SetStateAction<boolean>>;

  showRepeatModal: boolean;
  setShowRepeatModal: React.Dispatch<React.SetStateAction<boolean>>;
  repeatCount: number;
  setRepeatCount: React.Dispatch<React.SetStateAction<number>>;
  handleOpenRepeatModal: (unit: ChainTreeNode) => void;
  handleUpdateRepeatCount: () => void;
}
