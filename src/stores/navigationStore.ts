import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { ViewState } from '../types';

interface NavigationState {
  showAuxiliaryJudgment: string | null;
  showBettingModal: boolean;
  pendingChainId: string | null;
  currentSessionId: string | null;
  activeSessionId: string | null;
  currentView: ViewState;
  editingChainId: string | null;
  viewingChainId: string | null;
}

interface NavigationActions {
  setShowAuxiliaryJudgment: (chainId: string | null) => void;
  setShowBettingModal: (isOpen: boolean) => void;
  setPendingChainId: (chainId: string | null) => void;
  setCurrentSessionId: (sessionId: string | null) => void;
  setActiveSessionId: (sessionId: string | null) => void;
  setEditingChainId: (id: string | null) => void;
  setViewingChainId: (chainId: string | null) => void;
  navigateToView: (view: ViewState) => void;
  navigateToDashboard: () => void;
  openBettingFlow: (chainId: string, sessionId: string) => void;
  closeBettingFlow: () => void;
  resetNavigationState: () => void;
}

export type NavigationStore = NavigationState & NavigationActions;

export function createInitialNavigationState(): NavigationState {
  return {
    showAuxiliaryJudgment: null,
    showBettingModal: false,
    pendingChainId: null,
    currentSessionId: null,
    activeSessionId: null,
    currentView: 'dashboard',
    editingChainId: null,
    viewingChainId: null,
  };
}

export function createNavigationStore(initialState?: Partial<NavigationState>) {
  const initial: NavigationState = {
    ...createInitialNavigationState(),
    ...initialState,
  };

  return createStore<NavigationStore>()((set) => ({
    ...initial,
    setShowAuxiliaryJudgment: (chainId) =>
      set({ showAuxiliaryJudgment: chainId }),
    setShowBettingModal: (isOpen) => set({ showBettingModal: isOpen }),
    setPendingChainId: (chainId) => set({ pendingChainId: chainId }),
    setCurrentSessionId: (sessionId) => set({ currentSessionId: sessionId }),
    setActiveSessionId: (sessionId) => set({ activeSessionId: sessionId }),
    setEditingChainId: (id) => set({ editingChainId: id }),
    setViewingChainId: (chainId) => set({ viewingChainId: chainId }),
    navigateToView: (view) =>
      set({
        currentView: view,
        ...(view === 'dashboard'
          ? { editingChainId: null, viewingChainId: null }
          : {}),
      }),
    navigateToDashboard: () =>
      set({
        currentView: 'dashboard',
        editingChainId: null,
        viewingChainId: null,
      }),
    openBettingFlow: (chainId, sessionId) =>
      set({
        showBettingModal: true,
        pendingChainId: chainId,
        currentSessionId: sessionId,
      }),
    closeBettingFlow: () =>
      set({
        showBettingModal: false,
        pendingChainId: null,
        currentSessionId: null,
      }),
    resetNavigationState: () => set(createInitialNavigationState()),
  }));
}

export const navigationStore = createNavigationStore();

export function useNavigationStore<T>(
  selector: (state: NavigationStore) => T,
): T {
  return useStore(navigationStore, selector);
}

export const selectCurrentView = (state: NavigationStore): ViewState =>
  state.currentView;
export const selectEditingChainId = (state: NavigationStore): string | null =>
  state.editingChainId;
export const selectViewingChainId = (state: NavigationStore): string | null =>
  state.viewingChainId;

export function selectBettingModal(state: NavigationStore) {
  return {
    isOpen: state.showBettingModal,
    pendingChainId: state.pendingChainId,
    currentSessionId: state.currentSessionId,
  };
}
