import { useBettingDomain } from '../../hooks/domains/useBettingDomain';
import { useGroupDomain } from '../../hooks/domains/useGroupDomain';
import { useImportExportDomain } from '../../hooks/domains/useImportExportDomain';
import { useRecycleBinDomain } from '../../hooks/domains/useRecycleBinDomain';
import { useRulesDomain } from '../../hooks/domains/useRulesDomain';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import { getAppStateSnapshot } from '../../stores/appShellStore';
import { navigationStore } from '../../stores/navigationStore';
import type { AppShellPrimaryDomains } from './useAppShellPrimaryDomains';
import type { AppShellStateController } from './useAppShellState';

export function useAppShellSecondaryDomains(
  storage: MomentumStorage,
  state: AppShellStateController,
  primary: AppShellPrimaryDomains,
) {
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
    handleStartChain: primary.handleStartChain,
  });
  const rulesDomain = useRulesDomain({
    getState: getAppStateSnapshot,
    setState: state.setState,
    storage,
    safelySaveChains: primary.safelySaveChains,
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
    safelySaveChains: primary.safelySaveChains,
    setState: state.setState,
    onPetImported: primary.petDomain.reloadPet,
  });
  const groupDomain = useGroupDomain({
    getState: getAppStateSnapshot,
    setState: state.setState,
    storage,
    safelySaveChains: primary.safelySaveChains,
  });

  return {
    ...bettingDomain,
    ...rulesDomain,
    ...recycleBinDomain,
    ...importExportDomain,
    ...groupDomain,
  };
}
