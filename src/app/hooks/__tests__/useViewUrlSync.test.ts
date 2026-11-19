import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ActiveSession } from '../../../types';
import { createUnitChain } from '../../../test/factories';
import { useViewUrlSync } from '../useViewUrlSync';
import {
  navigationStore,
  createInitialNavigationState,
} from '../../../stores/navigationStore';

describe('useViewUrlSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/');
    navigationStore.setState(createInitialNavigationState());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies URL view state to app state after data is ready', () => {
    const chain = createUnitChain({ id: 'chain-1' });
    window.history.replaceState(null, '', '/?view=detail&chain=chain-1');

    renderHook(() =>
      useViewUrlSync({
        chains: [chain],
        activeSession: null,
        shouldLoadData: true,
        isLoadingData: false,
      }),
    );

    expect(navigationStore.getState().currentView).toBe('detail');
    expect(navigationStore.getState().viewingChainId).toBe(chain.id);
    expect(navigationStore.getState().editingChainId).toBeNull();
  });

  it('removes invalid dashboard URL params via replaceState', () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    window.history.replaceState(null, '', '/?view=focus');

    renderHook(() =>
      useViewUrlSync({
        chains: [],
        activeSession: null,
        shouldLoadData: true,
        isLoadingData: false,
      }),
    );

    expect(replaceStateSpy).toHaveBeenCalled();
    expect(window.location.search).toBe('');
  });

  it('pushes URL updates when state navigation changes', () => {
    vi.useFakeTimers();
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    const chain = createUnitChain({ id: 'chain-2' });

    renderHook(() =>
      useViewUrlSync({
        chains: [chain],
        activeSession: null,
        shouldLoadData: true,
        isLoadingData: false,
      }),
    );

    vi.runAllTimers();
    pushStateSpy.mockClear();
    act(() => {
      navigationStore.setState({
        currentView: 'detail',
        viewingChainId: chain.id,
        editingChainId: null,
      });
    });

    expect(pushStateSpy).toHaveBeenCalled();
    expect(window.location.search).toContain('view=detail');
    expect(window.location.search).toContain(`chain=${chain.id}`);
  });

  it('opens focus over the URL view when a session is active after load', () => {
    const chain = createUnitChain({ id: 'chain-session' });
    window.history.replaceState(null, '', '/?view=rsip');
    const activeSession = { chainId: chain.id } as ActiveSession;

    const { rerender } = renderHook(
      ({ isLoadingData }) =>
        useViewUrlSync({
          chains: [chain],
          activeSession,
          shouldLoadData: true,
          isLoadingData,
        }),
      { initialProps: { isLoadingData: true } },
    );
    rerender({ isLoadingData: false });

    expect(navigationStore.getState().currentView).toBe('focus');
  });

  it('applies the URL view after load when no session is active', () => {
    window.history.replaceState(null, '', '/?view=rsip');

    const { rerender } = renderHook(
      ({ isLoadingData }) =>
        useViewUrlSync({
          chains: [],
          activeSession: null,
          shouldLoadData: true,
          isLoadingData,
        }),
      { initialProps: { isLoadingData: true } },
    );
    expect(navigationStore.getState().currentView).toBe('dashboard');
    rerender({ isLoadingData: false });

    expect(navigationStore.getState().currentView).toBe('rsip');
  });

  it('updates state on popstate navigation', () => {
    const chain = createUnitChain({ id: 'chain-pop' });

    renderHook(() =>
      useViewUrlSync({
        chains: [chain],
        activeSession: null,
        shouldLoadData: true,
        isLoadingData: false,
      }),
    );

    window.history.pushState(null, '', `/?view=detail&chain=${chain.id}`);
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(navigationStore.getState().currentView).toBe('detail');
    expect(navigationStore.getState().viewingChainId).toBe(chain.id);
  });

  it('does not sync URL while data is still loading', () => {
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    const chain = createUnitChain({ id: 'chain-loading' });
    navigationStore.setState({
      currentView: 'detail',
      viewingChainId: chain.id,
    });

    renderHook(() =>
      useViewUrlSync({
        chains: [chain],
        activeSession: null,
        shouldLoadData: true,
        isLoadingData: true,
      }),
    );

    expect(pushStateSpy).not.toHaveBeenCalled();
  });
});
