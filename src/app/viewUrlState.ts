import type { ActiveSession, Chain, ViewState } from '../types';

type UrlSyncedViewState = {
  currentView: ViewState;
  viewingChainId: string | null;
  editingChainId: string | null;
};

const VALID_VIEWS: ReadonlySet<ViewState> = new Set([
  'dashboard',
  'editor',
  'focus',
  'detail',
  'group',
  'rsip',
  'taskgroup-editor',
]);

function dashboardState(): UrlSyncedViewState {
  return {
    currentView: 'dashboard',
    viewingChainId: null,
    editingChainId: null,
  };
}

function parseViewParam(rawView: string | null): ViewState | null {
  if (!rawView) return null;
  if (!VALID_VIEWS.has(rawView as ViewState)) return null;
  return rawView as ViewState;
}

function parseDetailOrGroupView(
  params: URLSearchParams,
  chains: Chain[],
): UrlSyncedViewState {
  const chainId = params.get('chain');
  if (!chainId) return dashboardState();

  const chain = chains.find((c) => c.id === chainId);
  if (!chain) return dashboardState();

  return {
    currentView: chain.type === 'group' ? 'group' : 'detail',
    viewingChainId: chainId,
    editingChainId: null,
  };
}

function parseEditorView(
  params: URLSearchParams,
  view: 'editor' | 'taskgroup-editor',
  chains: Chain[],
): UrlSyncedViewState {
  const editChainId = params.get('edit');
  if (editChainId) {
    const chain = chains.find((c) => c.id === editChainId);
    if (!chain) return dashboardState();

    const isTaskGroup = chain.type === 'group' || chain.isTaskGroup;
    return {
      currentView: isTaskGroup ? 'taskgroup-editor' : 'editor',
      viewingChainId: null,
      editingChainId: chain.id,
    };
  }

  const parentId = params.get('parent');
  return {
    currentView: view,
    viewingChainId: parentId || null,
    editingChainId: null,
  };
}

export function serializeViewStateToSearch(state: {
  currentView: ViewState;
  viewingChainId: string | null;
  editingChainId: string | null;
  activeSessionChainId: string | null;
}): string {
  const params = new URLSearchParams();

  if (state.currentView !== 'dashboard') {
    params.set('view', state.currentView);
  }

  if (
    (state.currentView === 'detail' || state.currentView === 'group') &&
    state.viewingChainId
  ) {
    params.set('chain', state.viewingChainId);
  }

  if (state.currentView === 'focus' && state.activeSessionChainId) {
    params.set('chain', state.activeSessionChainId);
  }

  if (
    state.currentView === 'editor' ||
    state.currentView === 'taskgroup-editor'
  ) {
    if (state.editingChainId) {
      params.set('edit', state.editingChainId);
    } else if (state.viewingChainId) {
      params.set('parent', state.viewingChainId);
    }
  }

  const search = params.toString();
  return search ? `?${search}` : '';
}

export function parseViewStateFromSearch(input: {
  search: string;
  chains: Chain[];
  activeSession: ActiveSession | null;
}): UrlSyncedViewState {
  const params = new URLSearchParams(input.search);
  const view = parseViewParam(params.get('view'));
  if (!view || view === 'dashboard') return dashboardState();

  if (view === 'rsip') {
    return { currentView: 'rsip', viewingChainId: null, editingChainId: null };
  }

  if (view === 'focus') {
    return input.activeSession
      ? { currentView: 'focus', viewingChainId: null, editingChainId: null }
      : dashboardState();
  }

  if (view === 'detail' || view === 'group') {
    return parseDetailOrGroupView(params, input.chains);
  }

  if (view === 'editor' || view === 'taskgroup-editor') {
    return parseEditorView(params, view, input.chains);
  }

  return dashboardState();
}

/**
 * View to open when the app starts with this URL. A running focus session
 * takes precedence over any URL view, so a reload never hides its timer.
 * (Back/forward navigation uses `parseViewStateFromSearch` directly and may
 * leave focus.)
 */
export function parseInitialViewState(input: {
  search: string;
  chains: Chain[];
  activeSession: ActiveSession | null;
}): UrlSyncedViewState {
  if (input.activeSession) {
    return { currentView: 'focus', viewingChainId: null, editingChainId: null };
  }
  return parseViewStateFromSearch(input);
}
