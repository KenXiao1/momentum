import { useCallback, useEffect, useRef } from 'react';
import type { ActiveSession, Chain } from '../../types';
import {
  parseInitialViewState,
  parseViewStateFromSearch,
  serializeViewStateToSearch,
} from '../viewUrlState';
import {
  navigationStore,
  selectCurrentView,
  selectEditingChainId,
  selectViewingChainId,
  useNavigationStore,
} from '../../stores/navigationStore';

interface UseViewUrlSyncParams {
  chains: Chain[];
  activeSession: ActiveSession | null;
  shouldLoadData: boolean;
  isLoadingData: boolean;
}

type UrlSyncedViewState = ReturnType<typeof parseViewStateFromSearch>;

export function useViewUrlSync({
  chains,
  activeSession,
  shouldLoadData,
  isLoadingData,
}: UseViewUrlSyncParams): void {
  const stateRef = useRef({ chains, activeSession });
  useEffect(() => {
    stateRef.current = { chains, activeSession };
  }, [chains, activeSession]);

  const currentView = useNavigationStore(selectCurrentView);
  const viewingChainId = useNavigationStore(selectViewingChainId);
  const editingChainId = useNavigationStore(selectEditingChainId);

  const isApplyingUrlRef = useRef(false);
  const hasProcessedInitialUrlRef = useRef(false);

  const applyViewStateFromUrl = useCallback((next: UrlSyncedViewState) => {
    isApplyingUrlRef.current = true;
    navigationStore.setState({
      currentView: next.currentView,
      viewingChainId: next.viewingChainId,
      editingChainId: next.editingChainId,
    });

    setTimeout(() => {
      isApplyingUrlRef.current = false;
    }, 0);
  }, []);

  useEffect(() => {
    if (!shouldLoadData) {
      hasProcessedInitialUrlRef.current = false;
    }
  }, [shouldLoadData]);

  // Apply URL -> state once, after data is available.
  useEffect(() => {
    if (!shouldLoadData || isLoadingData) return;
    if (hasProcessedInitialUrlRef.current) return;
    hasProcessedInitialUrlRef.current = true;

    const next = parseInitialViewState({
      search: window.location.search,
      chains: stateRef.current.chains,
      activeSession: stateRef.current.activeSession,
    });

    const hasViewParam = new URLSearchParams(window.location.search).has(
      'view',
    );
    if (hasViewParam && next.currentView === 'dashboard') {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.hash}`,
      );
    }

    applyViewStateFromUrl(next);
  }, [shouldLoadData, isLoadingData, applyViewStateFromUrl]);

  // Sync state -> URL on navigation changes.
  useEffect(() => {
    if (!hasProcessedInitialUrlRef.current) return;
    if (!shouldLoadData || isLoadingData) return;
    if (isApplyingUrlRef.current) return;

    const nextSearch = serializeViewStateToSearch({
      currentView,
      viewingChainId,
      editingChainId,
      activeSessionChainId: activeSession?.chainId ?? null,
    });

    if (nextSearch === window.location.search) return;

    const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`;
    window.history.pushState(null, '', nextUrl);
  }, [
    currentView,
    viewingChainId,
    editingChainId,
    activeSession?.chainId,
    shouldLoadData,
    isLoadingData,
  ]);

  // Handle browser back/forward.
  useEffect(() => {
    const onPopState = () => {
      const next = parseViewStateFromSearch({
        search: window.location.search,
        chains: stateRef.current.chains,
        activeSession: stateRef.current.activeSession,
      });

      applyViewStateFromUrl(next);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyViewStateFromUrl]);
}
