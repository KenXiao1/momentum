import { useBettingDomain } from '../../hooks/domains/useBettingDomain';
import { useChainsDomain } from '../../hooks/domains/useChainsDomain';
import { useGroupDomain } from '../../hooks/domains/useGroupDomain';
import { useImportExportDomain } from '../../hooks/domains/useImportExportDomain';
import { usePetDomain } from '../../hooks/domains/usePetDomain';
import { useRecycleBinDomain } from '../../hooks/domains/useRecycleBinDomain';
import { useRsipDomain } from '../../hooks/domains/useRsipDomain';
import { useRulesDomain } from '../../hooks/domains/useRulesDomain';
import { useSafeSaveChains } from '../../hooks/domains/useSafeSaveChains';
import { useSessionsDomain } from '../../hooks/domains/useSessionsDomain';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import { getAppStateSnapshot } from '../../stores/appShellStore';
import { navigationStore } from '../../stores/navigationStore';
import { useTaskLifecycleIntegration } from '../hooks/useTaskLifecycleIntegration';
import { useTaskLinkConfirmation } from '../hooks/useTaskLinkConfirmation';
import type { AppShellStateController } from './useAppShellState';

export function useAppShellDomains(
  storage: MomentumStorage,
  state: AppShellStateController,
) {
  const safelySaveChains = useSafeSaveChains(storage);
  const taskLinkConfirmation = useTaskLinkConfirmation();
  const chainsDomain = useChainsDomain({
    getState: getAppStateSnapshot,
    setState: state.setState,
    editingChainId: state.editingChainId,
    storage,
    safelySaveChains,
    onNavigateToEditor: (parentId) => {
      navigationStore.setState({
        currentView: 'editor',
        editingChainId: null,
        viewingChainId: parentId,
      });
    },
    onNavigateToTaskGroupEditor: () => {
      navigationStore.setState({
        currentView: 'taskgroup-editor',
        editingChainId: null,
      });
    },
    onEditChain: (chain, isTaskGroup) => {
      navigationStore.setState({
        currentView: isTaskGroup ? 'taskgroup-editor' : 'editor',
        editingChainId: chain.id,
      });
    },
    onNavigateToDashboard: () => {
      navigationStore.getState().navigateToDashboard();
    },
  });
  const rsipDomain = useRsipDomain({
    setState: state.setState,
    storage,
    getState: getAppStateSnapshot,
    confirmTaskLink: taskLinkConfirmation.confirmTaskLink,
    onNavigateToRSIP: () => navigationStore.getState().navigateToView('rsip'),
  });
  const onTaskLifecycleEvent = useTaskLifecycleIntegration(
    rsipDomain.handleTaskEventIntegration,
  );

  const petDomain = usePetDomain();
  const sessionsDomain = useSessionsDomain({
    getState: getAppStateSnapshot,
    setState: state.setState,
    storage,
    safelySaveChains,
    activeSessionId: state.activeSessionId,
    setActiveSessionId: (sessionId) =>
      navigationStore.getState().setActiveSessionId(sessionId),
    pendingChainId: state.pendingChainId,
    setPendingChainId: (chainId) =>
      navigationStore.getState().setPendingChainId(chainId),
    currentSessionId: state.currentSessionId,
    setCurrentSessionId: (sessionId) =>
      navigationStore.getState().setCurrentSessionId(sessionId),
    setShowBettingModal: (isOpen) =>
      navigationStore.getState().setShowBettingModal(isOpen),
    setShowAuxiliaryJudgment: (chainId) =>
      navigationStore.getState().setShowAuxiliaryJudgment(chainId),
    onNavigateToFocus: () => navigationStore.getState().navigateToView('focus'),
    onNavigateToDashboard: () =>
      navigationStore.getState().navigateToDashboard(),
    onPetTaskCompleted: petDomain.onTaskCompleted,
    onTaskLifecycleEvent,
  });

  const bettingDomain = useBettingDomain({
    pendingChainId: state.pendingChainId,
    setPendingChainId: (chainId) =>
      navigationStore.getState().setPendingChainId(chainId),
    currentSessionId: state.currentSessionId,
    setCurrentSessionId: (sessionId) =>
      navigationStore.getState().setCurrentSessionId(sessionId),
    setActiveSessionId: (sessionId) =>
      navigationStore.getState().setActiveSessionId(sessionId),
    setShowBettingModal: (isOpen) =>
      navigationStore.getState().setShowBettingModal(isOpen),
    handleStartChain: sessionsDomain.handleStartChain,
  });
  const rulesDomain = useRulesDomain({
    getState: getAppStateSnapshot,
    setState: state.setState,
    storage,
    safelySaveChains,
    setShowAuxiliaryJudgment: (chainId) =>
      navigationStore.getState().setShowAuxiliaryJudgment(chainId),
  });
  const recycleBinDomain = useRecycleBinDomain({
    getState: getAppStateSnapshot,
    setState: state.setState,
    storage,
    onChainDeleted: (chainId, hasActiveSession) => {
      const navigation = navigationStore.getState();
      if (!hasActiveSession) {
        navigation.navigateToDashboard();
        return;
      }
      if (navigation.viewingChainId === chainId) {
        navigation.setViewingChainId(null);
      }
      if (navigation.editingChainId === chainId) {
        navigation.setEditingChainId(null);
      }
    },
  });
  const importExportDomain = useImportExportDomain({
    storage,
    safelySaveChains,
    setState: state.setState,
    onPetImported: petDomain.reloadPet,
  });
  const groupDomain = useGroupDomain({
    getState: getAppStateSnapshot,
    setState: state.setState,
    storage,
    safelySaveChains,
  });

  return {
    ...chainsDomain,
    ...rsipDomain,
    ...sessionsDomain,
    petDomain,
    safelySaveChains,
    taskLinkConfirmation,
    ...bettingDomain,
    ...rulesDomain,
    ...recycleBinDomain,
    ...importExportDomain,
    ...groupDomain,
  };
}

export type AppShellDomains = ReturnType<typeof useAppShellDomains>;
