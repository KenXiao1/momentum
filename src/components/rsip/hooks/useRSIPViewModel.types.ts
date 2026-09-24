import { type Translator } from '../../../i18n';
import type { Dispatch, SetStateAction } from 'react';
import type {
  Chain,
  RSIPMeta,
  RSIPMode,
  RSIPNode,
  RSIPNodeGroup,
  RSIPTaskLink,
  RSIPTreeNode,
} from '../../../types';
import type { RSIPViewProps } from '../../RSIPView.types';
import type { SplitDraftItem } from '../rsipViewHelpers';
import type { RSIPInsightsResult } from '../../../services/rsip-insights/rsipInsightsTypes';

export interface RSIPViewStateSlice {
  language: string;
  t: Translator;
  nodes: RSIPNode[];
  meta: RSIPMeta;
  groups: RSIPNodeGroup[];
  taskLinks: RSIPTaskLink[];
  chains: Chain[];
  tree: RSIPTreeNode[];
  currentMode: RSIPMode;
  isStrictMode: boolean;
  hasOpenedToday: boolean;
  canAddToday: boolean;
  insights: RSIPInsightsResult;
  selectedParentId?: string;
  setSelectedParentId: (id: string | undefined) => void;
  selectedGroupId?: string;
  setSelectedGroupId: (groupId: string | undefined) => void;
  title: string;
  setTitle: (value: string) => void;
  rule: string;
  setRule: (value: string) => void;
  createUseTimer: boolean;
  setCreateUseTimer: (enabled: boolean) => void;
  createTimerMinutes: number;
  setCreateTimerMinutes: (minutes: number) => void;
  createType: string;
  setCreateType: (type: string) => void;
  createEmoji: string;
  setCreateEmoji: (emoji: string) => void;
  createIsPassive: boolean;
  setCreateIsPassive: (value: boolean) => void;
  splitMode: boolean;
  setSplitMode: (value: boolean) => void;
  splitGoal: string;
  setSplitGoal: (value: string) => void;
  splitItems: SplitDraftItem[];
  setSplitItems: Dispatch<SetStateAction<SplitDraftItem[]>>;
  splitTemplateKeys: string[];
  splitTemplates: Record<string, { goal: string; items: SplitDraftItem[] }>;
}

export interface RSIPViewActionSlice {
  handleModeChange: (mode: RSIPMode) => Promise<void>;
  handleRecordTreeOpened: () => Promise<void>;
  handleCreateGroup: () => Promise<void>;
  handleAddSingle: () => Promise<void>;
  handleApplySplitTemplate: (templateKey: string) => void;
  handleAddSplitRow: () => void;
  handleSubmitSplit: () => Promise<void>;
  handleMarkExecuted: (
    nodeId: string,
    reinforce?: boolean,
  ) => Promise<RSIPNode[]>;
  handleTaskLinkUpsert: (nextLinks: RSIPTaskLink[]) => Promise<void>;
  handleRestoreFromLibrary: (
    entryId: string,
    parentId?: string,
  ) => Promise<void>;
  calculateConstraintPower: (nodeId: string) => {
    descendantCount: number;
    failureCost: number;
  };
  openViolationDialog: (node: RSIPNode) => void;
  violationDialogNode: RSIPNode | null;
  violationDescendants: RSIPNode[];
  violationGroupMessage?: string;
  handleConfirmViolation: (payload: {
    reasonCode?: string;
    repairHint?: string;
  }) => Promise<void>;
  closeViolationDialog: () => void;
  onSaveNodes: RSIPViewProps['onSaveNodes'];
  onReinforceNode: RSIPViewProps['onReinforceNode'];
}

export interface UseRSIPViewInteractionActionsParams {
  state: RSIPViewStateSlice;
  props: Pick<
    RSIPViewProps,
    | 'policyLibrary'
    | 'onSaveNodes'
    | 'onSaveTaskLinks'
    | 'onMarkExecuted'
    | 'onMarkViolated'
    | 'onReinforceNode'
    | 'onRestoreFromLibrary'
    | 'onUpsertTaskLinks'
    | 'onGetTaskActions'
    | 'onStartChain'
    | 'onScheduleChain'
  >;
}

export interface RSIPViewModel
  extends RSIPViewStateSlice, RSIPViewActionSlice {}
