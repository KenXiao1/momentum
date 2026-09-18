import { useCallback, useMemo } from 'react';
import { buildChainTree } from '../../utils/chainTree';
import type { Chain, ViewState } from '../../types';
import { navigationStore } from '../../stores/navigationStore';
import type { AppShellViewProps } from './types';
import type { AppShellBootstrap } from './useAppShellBootstrap';
import type { AppShellDomains } from './useAppShellDomains';
import type { AppShellStateController } from './useAppShellState';

export function useAppShellViewModels(
  state: AppShellStateController,
  bootstrap: AppShellBootstrap,
  domains: AppShellDomains,
): AppShellViewProps {
  const handleViewChainDetail = (chainId: string) => {
    const chain = state.chains.find((candidate) => candidate.id === chainId);
    if (!chain) return;
    navigationStore.setState({
      currentView: chain.type === 'group' ? 'group' : 'detail',
      viewingChainId: chainId,
      editingChainId: null,
    });
  };
  const handleBackToDashboard = () => {
    navigationStore.getState().navigateToDashboard();
  };
  const onNavigateToView = useCallback((view: ViewState) => {
    if (view === 'dashboard') {
      navigationStore.getState().navigateToDashboard();
      return;
    }
    navigationStore.getState().navigateToView(view);
  }, []);

  const app: AppShellViewProps['app'] = {
    isInitialized: bootstrap.isInitialized,
    isLoadingData: bootstrap.isLoadingData,
    currentView: state.currentView,
    hasActiveSession: !!state.activeSession,
    onNavigateToView,
  };
  const { chains, currentView, viewingChainId } = state;
  const viewingGroupNode = useMemo(
    () =>
      currentView === 'group' && viewingChainId
        ? (buildChainTree(chains).find((node) => node.id === viewingChainId) ??
          null)
        : null,
    [chains, currentView, viewingChainId],
  );
  const dashboard: AppShellViewProps['dashboard'] = {
    viewingGroupNode,
    chains: state.chains,
    scheduledSessions: state.scheduledSessions,
    editingChain: findChainById(chains, state.editingChainId),
    editorParentId: viewingChainId,
    viewingChain: findChainById(chains, viewingChainId),
    completionHistory: state.completionHistory,
    handleCreateChain: domains.handleCreateChain,
    handleCreateTaskGroup: domains.handleCreateTaskGroup,
    handleEditChain: domains.handleEditChain,
    handleSaveChain: domains.handleSaveChain,
    handleViewChainDetail,
    handleBackToDashboard,
    openRSIP: domains.openRSIP,
    handleScheduleChain: domains.handleScheduleChain,
    handleStartChain: domains.handleStartChain,
    handleCancelScheduledSession: domains.handleCancelScheduledSession,
    handleCompleteBooking: domains.handleCompleteBooking,
    handleDeleteChain: domains.handleDeleteChain,
    handleRestoreChains: domains.handleRestoreChains,
    handlePermanentDeleteChains: domains.handlePermanentDeleteChains,
    handleImportChains: domains.handleImportChains,
    handleImportUnits: domains.handleImportUnits,
    handleUpdateTaskRepeatCount: domains.handleUpdateTaskRepeatCount,
    handleReorderUnit: domains.handleReorderUnit,
  };
  const rsip: AppShellViewProps['rsip'] = {
    nodes: state.rsipNodes,
    meta: state.rsipMeta,
    groups: state.rsipGroups,
    policyLibrary: state.rsipPolicyLibrary,
    runHistory: state.rsipRunHistory,
    executionRecords: state.rsipExecutionRecords,
    taskLinks: state.rsipTaskLinks,
    chains: state.chains,
    onBack: handleBackToDashboard,
    saveNodes: domains.saveNodes,
    saveMeta: domains.saveMeta,
    saveGroups: domains.saveGroups,
    saveTaskLinks: domains.saveTaskLinks,
    markExecuted: domains.markExecuted,
    markViolated: domains.markViolated,
    reinforceNode: domains.reinforceNode,
    restoreFromLibrary: domains.restoreFromLibrary,
    createGroup: domains.createGroup,
    upsertTaskLinks: domains.upsertTaskLinks,
    getTaskActions: domains.getRsipTaskActions,
    handleStartChain: domains.handleStartChain,
    handleScheduleChain: domains.handleScheduleChain,
  };
  const bettingChain = findChainById(chains, state.pendingChainId);
  const session: AppShellViewProps['session'] = {
    activeChain: findChainById(chains, state.activeSession?.chainId),
    activeSession: state.activeSession,
    auxiliaryJudgmentChain: findChainById(chains, state.showAuxiliaryJudgment),
    clearAuxiliaryJudgment: () =>
      navigationStore.getState().setShowAuxiliaryJudgment(null),
    bettingModal: {
      isOpen:
        state.showBettingModal &&
        state.pendingChainId !== null &&
        state.currentSessionId !== null,
      sessionId: state.currentSessionId,
      chainName: bettingChain?.name ?? null,
      taskDuration: bettingChain?.duration ?? 0,
    },
    handleCompleteSession: domains.handleCompleteSession,
    handleInterruptSession: domains.handleInterruptSession,
    handlePauseSession: domains.handlePauseSession,
    handleResumeSession: domains.handleResumeSession,
    handleBetPlaced: domains.handleBetPlaced,
    handleBetCancelled: domains.handleBetCancelled,
    handleAuxiliaryJudgmentFailure: domains.handleAuxiliaryJudgmentFailure,
    handleAuxiliaryJudgmentAllow: domains.handleAuxiliaryJudgmentAllow,
  };

  return {
    app,
    dashboard,
    rsip,
    session,
    pet: domains.petDomain,
  };
}

function findChainById(
  chains: Chain[],
  chainId: string | null | undefined,
): Chain | null {
  if (!chainId) return null;
  return chains.find((chain) => chain.id === chainId) ?? null;
}
