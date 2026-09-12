import type {
  ActiveSession,
  Chain,
  ChainDraft,
  ChainTreeNode,
  CompletionHistory,
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
import type {
  AppShellAppViewModel,
  AppShellDashboardViewModel,
  AppShellPetViewModel,
  AppShellRsipViewModel,
  AppShellSessionViewModel,
  ImportChainsOptions,
  RSIPExecutionActionOptions,
  RSIPViolationActionOptions,
} from './types';

interface BuildAppViewModelInputs {
  isInitialized: boolean;
  isLoadingData: boolean;
  currentView: ViewState;
  hasActiveSession: boolean;
  onNavigateToView: (view: ViewState) => void;
}

interface BuildDashboardViewModelInputs {
  viewingGroupNode: ChainTreeNode | null;
  chains: Chain[];
  scheduledSessions: ScheduledSession[];
  editingChainId: string | null;
  viewingChainId: string | null;
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

interface BuildRsipViewModelInputs {
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

interface BuildSessionViewModelInputs {
  chains: Chain[];
  activeSession: ActiveSession | null;
  showAuxiliaryJudgment: string | null;
  clearAuxiliaryJudgment: () => void;
  showBettingModal: boolean;
  pendingChainId: string | null;
  currentSessionId: string | null;
  handleCompleteSession: (description?: string, notes?: string) => void;
  handleInterruptSession: (reason?: string) => void;
  handlePauseSession: () => void;
  handleResumeSession: () => void;
  handleBetPlaced: AppShellSessionViewModel['handleBetPlaced'];
  handleBetCancelled: AppShellSessionViewModel['handleBetCancelled'];
  handleAuxiliaryJudgmentFailure: (chainId: string) => void;
  handleAuxiliaryJudgmentAllow: (
    chainId: string,
    exceptionRule: string,
  ) => void;
}

function findChainById(
  chains: Chain[],
  chainId: string | null | undefined,
): Chain | null {
  if (!chainId) return null;
  return chains.find((chain) => chain.id === chainId) ?? null;
}

export function buildAppViewModel(
  inputs: BuildAppViewModelInputs,
): AppShellAppViewModel {
  return {
    isInitialized: inputs.isInitialized,
    isLoadingData: inputs.isLoadingData,
    currentView: inputs.currentView,
    hasActiveSession: inputs.hasActiveSession,
    onNavigateToView: inputs.onNavigateToView,
  };
}

export function buildDashboardViewModel(
  inputs: BuildDashboardViewModelInputs,
): AppShellDashboardViewModel {
  const editingChain = findChainById(inputs.chains, inputs.editingChainId);
  const viewingChain = findChainById(inputs.chains, inputs.viewingChainId);

  return {
    chains: inputs.chains,
    scheduledSessions: inputs.scheduledSessions,
    editingChain: editingChain,
    editorParentId: inputs.viewingChainId,
    viewingChain,
    viewingGroupNode: inputs.viewingGroupNode,
    completionHistory: inputs.completionHistory,
    handleCreateChain: inputs.handleCreateChain,
    handleCreateTaskGroup: inputs.handleCreateTaskGroup,
    handleEditChain: inputs.handleEditChain,
    handleSaveChain: inputs.handleSaveChain,
    handleViewChainDetail: inputs.handleViewChainDetail,
    handleBackToDashboard: inputs.handleBackToDashboard,
    openRSIP: inputs.openRSIP,
    handleScheduleChain: inputs.handleScheduleChain,
    handleStartChain: inputs.handleStartChain,
    handleCancelScheduledSession: inputs.handleCancelScheduledSession,
    handleCompleteBooking: inputs.handleCompleteBooking,
    handleDeleteChain: inputs.handleDeleteChain,
    handleRestoreChains: inputs.handleRestoreChains,
    handlePermanentDeleteChains: inputs.handlePermanentDeleteChains,
    handleImportChains: inputs.handleImportChains,
    handleImportUnits: inputs.handleImportUnits,
    handleUpdateTaskRepeatCount: inputs.handleUpdateTaskRepeatCount,
    handleReorderUnit: inputs.handleReorderUnit,
  };
}

export function buildRsipViewModel(
  inputs: BuildRsipViewModelInputs,
): AppShellRsipViewModel {
  return {
    nodes: inputs.nodes,
    meta: inputs.meta,
    groups: inputs.groups,
    policyLibrary: inputs.policyLibrary,
    runHistory: inputs.runHistory,
    executionRecords: inputs.executionRecords,
    taskLinks: inputs.taskLinks,
    chains: inputs.chains,
    onBack: inputs.onBack,
    saveNodes: inputs.saveNodes,
    saveMeta: inputs.saveMeta,
    saveGroups: inputs.saveGroups,
    saveTaskLinks: inputs.saveTaskLinks,
    markExecuted: inputs.markExecuted,
    markViolated: inputs.markViolated,
    reinforceNode: inputs.reinforceNode,
    restoreFromLibrary: inputs.restoreFromLibrary,
    createGroup: inputs.createGroup,
    upsertTaskLinks: inputs.upsertTaskLinks,
    getTaskActions: inputs.getTaskActions,
    handleStartChain: inputs.handleStartChain,
    handleScheduleChain: inputs.handleScheduleChain,
  };
}

export function buildSessionViewModel(
  inputs: BuildSessionViewModelInputs,
): AppShellSessionViewModel {
  const activeChain = findChainById(
    inputs.chains,
    inputs.activeSession?.chainId,
  );
  const auxiliaryJudgmentChain = findChainById(
    inputs.chains,
    inputs.showAuxiliaryJudgment,
  );
  const bettingChain = findChainById(inputs.chains, inputs.pendingChainId);
  const bettingModal = {
    isOpen:
      inputs.showBettingModal &&
      inputs.pendingChainId !== null &&
      inputs.currentSessionId !== null,
    sessionId: inputs.currentSessionId,
    chainName: bettingChain?.name ?? null,
    taskDuration: bettingChain?.duration ?? 0,
  };

  return {
    activeSession: inputs.activeSession,
    activeChain,
    auxiliaryJudgmentChain,
    clearAuxiliaryJudgment: inputs.clearAuxiliaryJudgment,
    bettingModal,
    handleCompleteSession: inputs.handleCompleteSession,
    handleInterruptSession: inputs.handleInterruptSession,
    handlePauseSession: inputs.handlePauseSession,
    handleResumeSession: inputs.handleResumeSession,
    handleBetPlaced: inputs.handleBetPlaced,
    handleBetCancelled: inputs.handleBetCancelled,
    handleAuxiliaryJudgmentFailure: inputs.handleAuxiliaryJudgmentFailure,
    handleAuxiliaryJudgmentAllow: inputs.handleAuxiliaryJudgmentAllow,
  };
}

export function buildPetViewModel(
  petDomain: AppShellPetViewModel,
): AppShellPetViewModel {
  return petDomain;
}
