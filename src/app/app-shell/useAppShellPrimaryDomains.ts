import { useChainsDomain } from '../../hooks/domains/useChainsDomain';
import { usePetDomain } from '../../hooks/domains/usePetDomain';
import { useRsipDomain } from '../../hooks/domains/useRsipDomain';
import { useSafeSaveChains } from '../../hooks/domains/useSafeSaveChains';
import { useSessionsDomain } from '../../hooks/domains/useSessionsDomain';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import { getAppStateSnapshot } from '../../stores/appShellStore';
import { navigationStore } from '../../stores/navigationStore';
import { useTaskLifecycleIntegration } from '../hooks/useTaskLifecycleIntegration';
import { useTaskLinkConfirmation } from '../hooks/useTaskLinkConfirmation';
import type { AppShellStateController } from './useAppShellState';

export function useAppShellPrimaryDomains(
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
  useTaskLifecycleIntegration(rsipDomain.handleTaskEventIntegration);

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
  });

  return {
    ...chainsDomain,
    ...rsipDomain,
    ...sessionsDomain,
    petDomain,
    safelySaveChains,
    taskLinkConfirmation,
  };
}

export type AppShellPrimaryDomains = ReturnType<
  typeof useAppShellPrimaryDomains
>;
