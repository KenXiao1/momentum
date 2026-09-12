import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { AppState } from '../../types';
import {
  appShellStore,
  createInitialAppState,
  useAppShellStore,
} from '../../stores/appShellStore';
import {
  navigationStore,
  useNavigationStore,
} from '../../stores/navigationStore';

export function useAppShellState() {
  const taskState = useAppShellStore(
    useShallow((state) => ({
      chains: state.chains,
      scheduledSessions: state.scheduledSessions,
      activeSession: state.activeSession,
      completionHistory: state.completionHistory,
    })),
  );
  const rsipState = useAppShellStore(
    useShallow((state) => ({
      rsipNodes: state.rsipNodes,
      rsipMeta: state.rsipMeta,
      rsipGroups: state.rsipGroups,
      rsipPolicyLibrary: state.rsipPolicyLibrary,
      rsipRunHistory: state.rsipRunHistory,
      rsipTaskLinks: state.rsipTaskLinks,
      rsipExecutionRecords: state.rsipExecutionRecords,
    })),
  );
  const navigationState = useNavigationStore(
    useShallow((state) => ({
      currentView: state.currentView,
      editingChainId: state.editingChainId,
      viewingChainId: state.viewingChainId,
      showAuxiliaryJudgment: state.showAuxiliaryJudgment,
      showBettingModal: state.showBettingModal,
      pendingChainId: state.pendingChainId,
      currentSessionId: state.currentSessionId,
      activeSessionId: state.activeSessionId,
    })),
  );

  const resetAppState = useCallback(() => createInitialAppState(), []);
  const resetUIState = useCallback(() => {
    navigationStore.getState().resetNavigationState();
  }, []);
  const setState = useCallback(
    (update: AppState | ((previous: AppState) => AppState)) => {
      appShellStore.getState().updateAppState(update);
    },
    [],
  );

  return {
    ...taskState,
    ...rsipState,
    ...navigationState,
    resetAppState,
    resetUIState,
    setState,
  };
}

export type AppShellStateController = ReturnType<typeof useAppShellState>;
