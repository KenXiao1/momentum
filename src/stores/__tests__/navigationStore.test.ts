import { beforeEach, describe, expect, it } from 'vitest';
import { createGroupChain, createUnitChain } from '../../test/factories';
import {
  navigationStore,
  createInitialNavigationState,
  createNavigationStore,
} from '../navigationStore';

describe('navigationStore', () => {
  beforeEach(() => {
    navigationStore.getState().resetNavigationState();
  });

  it('creates the documented initial navigation state', () => {
    const store = createNavigationStore();

    expect(store.getState()).toMatchObject(createInitialNavigationState());
  });

  it('navigates back to dashboard and clears editor/detail state', () => {
    const chain = createUnitChain({ id: 'chain-1' });
    const store = createNavigationStore();

    store.getState().setEditingChainId(chain.id);
    store.getState().setViewingChainId(chain.id);
    store.getState().navigateToView('editor');

    store.getState().navigateToDashboard();

    expect(store.getState().currentView).toBe('dashboard');
    expect(store.getState().editingChainId).toBeNull();
    expect(store.getState().viewingChainId).toBeNull();
  });

  it('navigateToView clears chain IDs when going to dashboard', () => {
    const store = createNavigationStore({
      currentView: 'detail',
      editingChainId: 'e1',
      viewingChainId: 'v1',
    });

    store.getState().navigateToView('dashboard');

    expect(store.getState().currentView).toBe('dashboard');
    expect(store.getState().editingChainId).toBeNull();
    expect(store.getState().viewingChainId).toBeNull();
  });

  it('navigateToView preserves chain IDs for non-dashboard views', () => {
    const store = createNavigationStore({ editingChainId: 'e1' });

    store.getState().navigateToView('editor');

    expect(store.getState().currentView).toBe('editor');
    expect(store.getState().editingChainId).toBe('e1');
  });

  it('opens and closes the betting flow atomically', () => {
    const store = createNavigationStore();

    store.getState().openBettingFlow('chain-2', 'session-2');

    expect(store.getState()).toMatchObject({
      showBettingModal: true,
      pendingChainId: 'chain-2',
      currentSessionId: 'session-2',
    });

    store.getState().closeBettingFlow();

    expect(store.getState()).toMatchObject({
      showBettingModal: false,
      pendingChainId: null,
      currentSessionId: null,
    });
  });

  it('resets all navigation state back to defaults', () => {
    const chain = createGroupChain({ id: 'group-1' });
    const store = createNavigationStore({
      currentView: 'group',
      viewingChainId: chain.id,
      showAuxiliaryJudgment: 'group-1',
      activeSessionId: 'active-1',
      editingChainId: chain.id,
    });

    store.getState().resetNavigationState();

    expect(store.getState()).toMatchObject(createInitialNavigationState());
  });
});
