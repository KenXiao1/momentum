import { useCallback, useMemo } from 'react';
import { buildChainTree } from '../../utils/chainTree';
import type { ViewState } from '../../types';
import { navigationStore } from '../../stores/navigationStore';
import {
  buildAppViewModel,
  buildDashboardViewModel,
  buildPetViewModel,
  buildRsipViewModel,
  buildSessionViewModel,
} from './viewModelBuilders';
import type { AppShellBootstrap } from './useAppShellBootstrap';
import type { AppShellDomains } from './useAppShellDomains';
import type { AppShellStateController } from './useAppShellState';

export function useAppShellViewModels(
  state: AppShellStateController,
  bootstrap: AppShellBootstrap,
  domains: AppShellDomains,
) {
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

  const app = buildAppViewModel({
    isInitialized: bootstrap.isInitialized,
    isLoadingData: bootstrap.isLoadingData,
    currentView: state.currentView,
    hasActiveSession: !!state.activeSession,
    onNavigateToView,
  });
  const { chains, currentView, viewingChainId } = state;
  const viewingGroupNode = useMemo(
    () =>
      currentView === 'group' && viewingChainId
        ? (buildChainTree(chains).find((node) => node.id === viewingChainId) ??
          null)
        : null,
    [chains, currentView, viewingChainId],
  );
  const dashboard = buildDashboardViewModel({
    viewingGroupNode,
    chains: state.chains,
    scheduledSessions: state.scheduledSessions,
    editingChainId: state.editingChainId,
    viewingChainId: state.viewingChainId,
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
  });
  const rsip = buildRsipViewModel({
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
  });
  const session = buildSessionViewModel({
    chains: state.chains,
    activeSession: state.activeSession,
    showAuxiliaryJudgment: state.showAuxiliaryJudgment,
    clearAuxiliaryJudgment: () =>
      navigationStore.getState().setShowAuxiliaryJudgment(null),
    showBettingModal: state.showBettingModal,
    pendingChainId: state.pendingChainId,
    currentSessionId: state.currentSessionId,
    handleCompleteSession: domains.handleCompleteSession,
    handleInterruptSession: domains.handleInterruptSession,
    handlePauseSession: domains.handlePauseSession,
    handleResumeSession: domains.handleResumeSession,
    handleBetPlaced: domains.handleBetPlaced,
    handleBetCancelled: domains.handleBetCancelled,
    handleAuxiliaryJudgmentFailure: domains.handleAuxiliaryJudgmentFailure,
    handleAuxiliaryJudgmentAllow: domains.handleAuxiliaryJudgmentAllow,
  });

  return {
    app,
    dashboard,
    rsip,
    session,
    pet: buildPetViewModel(domains.petDomain),
  };
}
