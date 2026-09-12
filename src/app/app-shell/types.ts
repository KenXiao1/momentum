import type { BetPlacementResult } from '../../domain/betting';
import type { UsePetDomainReturn } from '../../hooks/domains/usePetDomain';
import type {
  ActiveSession,
  Chain,
  ChainDraft,
  ChainTreeNode,
  CompletionHistory,
  ExceptionRule,
  RSIPExecutionRecord,
  RSIPLibraryEntry,
  RSIPMeta,
  RSIPNode,
  RSIPNodeGroup,
  RSIPRunRecord,
  RSIPTaskLink,
  ScheduledSession,
  ViewState,
} from '../../types';
import type { PetState } from '../../types/pet';

export interface ImportChainsOptions {
  history?: CompletionHistory[];
  rsipNodes?: RSIPNode[];
  rsipMeta?: RSIPMeta;
  rsipGroups?: RSIPNodeGroup[];
  rsipPolicyLibrary?: RSIPLibraryEntry[];
  rsipRunHistory?: RSIPRunRecord[];
  rsipExecutionRecords?: RSIPExecutionRecord[];
  rsipTaskLinks?: RSIPTaskLink[];
  petState?: PetState;
  exceptionRules?: ExceptionRule[];
}

export interface RSIPExecutionActionOptions {
  reinforce?: boolean;
  reasonCode?: string;
  repairHint?: string;
  sourceChainId?: string;
  sourceEvent?: string;
}

export interface RSIPViolationActionOptions {
  reasonCode?: string;
  repairHint?: string;
  sourceChainId?: string;
  sourceEvent?: string;
  collapseReason?: string;
}

export interface AppShellAppViewModel {
  isInitialized: boolean;
  isLoadingData: boolean;
  currentView: ViewState;
  hasActiveSession: boolean;
  onNavigateToView: (view: ViewState) => void;
}

export interface AppShellDashboardViewModel {
  chains: Chain[];
  scheduledSessions: ScheduledSession[];
  editingChain: Chain | null;
  editorParentId: string | null;
  viewingChain: Chain | null;
  viewingGroupNode: ChainTreeNode | null;
  completionHistory: CompletionHistory[];
  handleCreateChain: (parentId?: string | null) => void;
  handleCreateTaskGroup: () => void;
  handleEditChain: (chainId: string) => void;
  handleSaveChain: (chainData: ChainDraft, isCopy?: boolean) => void;
  handleViewChainDetail: (chainId: string) => void;
  handleBackToDashboard: () => void;
  openRSIP: () => void;
  handleScheduleChain: (chainId: string) => void;
  handleStartChain: (chainId: string) => Promise<void>;
  handleCancelScheduledSession: (chainId: string) => void;
  handleCompleteBooking: (chainId: string) => void;
  handleDeleteChain: (chainId: string) => Promise<void>;
  handleRestoreChains: (chainIds: string[]) => Promise<void>;
  handlePermanentDeleteChains: (chainIds: string[]) => Promise<void>;
  handleImportChains: (
    importedChains: Chain[],
    options?: ImportChainsOptions,
  ) => Promise<void>;
  handleImportUnits: (
    unitIds: string[],
    groupId: string,
    mode?: 'move' | 'copy',
  ) => Promise<void>;
  handleUpdateTaskRepeatCount: (
    chainId: string,
    repeatCount: number,
  ) => Promise<void>;
  handleReorderUnit: (
    groupId: string,
    unitId: string,
    direction: 'up' | 'down',
  ) => Promise<void>;
}

export interface AppShellRsipViewModel {
  nodes: RSIPNode[];
  meta: RSIPMeta;
  groups: RSIPNodeGroup[];
  policyLibrary: RSIPLibraryEntry[];
  runHistory: RSIPRunRecord[];
  executionRecords: RSIPExecutionRecord[];
  taskLinks: RSIPTaskLink[];
  chains: Chain[];
  onBack: () => void;
  saveNodes: (nodes: RSIPNode[]) => Promise<void>;
  saveMeta: (meta: RSIPMeta) => Promise<void>;
  saveGroups: (groups: RSIPNodeGroup[]) => Promise<void>;
  saveTaskLinks: (links: RSIPTaskLink[]) => Promise<void>;
  markExecuted: (
    nodeId: string,
    nodes: RSIPNode[],
    notes?: string,
    options?: RSIPExecutionActionOptions,
  ) => Promise<RSIPNode[]>;
  markViolated: (
    nodeId: string,
    nodes: RSIPNode[],
    notes?: string,
    options?: RSIPViolationActionOptions,
  ) => Promise<RSIPNode[]>;
  reinforceNode: (
    nodeId: string,
    nodes: RSIPNode[],
    levelDelta?: number,
  ) => Promise<RSIPNode[]>;
  restoreFromLibrary: (
    entryId: string,
    parentId?: string,
  ) => Promise<RSIPNode | null>;
  createGroup: (
    title: string,
    faultTolerance: number,
    emoji?: string,
  ) => Promise<RSIPNodeGroup>;
  upsertTaskLinks: (links: RSIPTaskLink[]) => Promise<RSIPTaskLink[]>;
  getTaskActions: (rsipNodeId: string) => RSIPTaskLink[];
  handleStartChain: (chainId: string) => Promise<void>;
  handleScheduleChain: (chainId: string) => void;
}

interface AppShellBettingModalViewModel {
  isOpen: boolean;
  sessionId: string | null;
  chainName: string | null;
  taskDuration: number;
}

export interface AppShellSessionViewModel {
  activeSession: ActiveSession | null;
  activeChain: Chain | null;
  auxiliaryJudgmentChain: Chain | null;
  clearAuxiliaryJudgment: () => void;
  bettingModal: AppShellBettingModalViewModel;
  handleCompleteSession: (description?: string, notes?: string) => void;
  handleInterruptSession: (reason?: string) => void;
  handlePauseSession: () => void;
  handleResumeSession: () => void;
  handleBetPlaced: (betResult: BetPlacementResult) => Promise<void>;
  handleBetCancelled: () => Promise<void>;
  handleAuxiliaryJudgmentFailure: (chainId: string) => void;
  handleAuxiliaryJudgmentAllow: (
    chainId: string,
    exceptionRule: string,
  ) => void;
}

export type AppShellPetViewModel = UsePetDomainReturn;

export interface AppShellViewProps {
  app: AppShellAppViewModel;
  dashboard: AppShellDashboardViewModel;
  rsip: AppShellRsipViewModel;
  session: AppShellSessionViewModel;
  pet: AppShellPetViewModel;
}
