import type { ActiveSession, Chain } from '../../types';
import { describe, expect, test } from 'vitest';
import {
  parseViewStateFromSearch,
  serializeViewStateToSearch,
} from '../viewUrlState';

describe('viewUrlState', () => {
  test('serializeViewStateToSearch omits params for dashboard', () => {
    const search = serializeViewStateToSearch({
      currentView: 'dashboard',
      viewingChainId: null,
      editingChainId: null,
      activeSessionChainId: null,
    });
    expect(search).toBe('');
  });

  test('serializeViewStateToSearch encodes detail view', () => {
    const search = serializeViewStateToSearch({
      currentView: 'detail',
      viewingChainId: 'chain-1',
      editingChainId: null,
      activeSessionChainId: null,
    });
    expect(search).toBe('?view=detail&chain=chain-1');
  });

  test('parseViewStateFromSearch returns dashboard for empty search', () => {
    const state = parseViewStateFromSearch({
      search: '',
      chains: [],
      activeSession: null,
    });
    expect(state).toEqual({
      currentView: 'dashboard',
      viewingChainId: null,
      editingChainId: null,
    });
  });

  test('parseViewStateFromSearch chooses group/detail based on chain type', () => {
    const groupChain = {
      id: 'group-1',
      type: 'group',
      isTaskGroup: true,
    } as Chain;
    const unitChain = {
      id: 'unit-1',
      type: 'unit',
    } as Chain;

    const groupState = parseViewStateFromSearch({
      search: '?view=detail&chain=group-1',
      chains: [groupChain, unitChain],
      activeSession: null,
    });
    expect(groupState.currentView).toBe('group');
    expect(groupState.viewingChainId).toBe('group-1');

    const unitState = parseViewStateFromSearch({
      search: '?view=group&chain=unit-1',
      chains: [groupChain, unitChain],
      activeSession: null,
    });
    expect(unitState.currentView).toBe('detail');
    expect(unitState.viewingChainId).toBe('unit-1');
  });

  test('parseViewStateFromSearch routes task groups to taskgroup-editor when editing', () => {
    const taskGroup = {
      id: 'group-1',
      type: 'group',
      isTaskGroup: true,
    } as Chain;

    const state = parseViewStateFromSearch({
      search: '?view=editor&edit=group-1',
      chains: [taskGroup],
      activeSession: null,
    });

    expect(state.currentView).toBe('taskgroup-editor');
    expect(state.editingChainId).toBe('group-1');
    expect(state.viewingChainId).toBeNull();
  });

  test('parseViewStateFromSearch ignores focus view when no active session', () => {
    const state = parseViewStateFromSearch({
      search: '?view=focus&chain=chain-1',
      chains: [],
      activeSession: null,
    });
    expect(state.currentView).toBe('dashboard');
  });

  test('parseViewStateFromSearch accepts focus view when active session exists', () => {
    const activeSession = { chainId: 'chain-1' } as ActiveSession;
    const state = parseViewStateFromSearch({
      search: '?view=focus&chain=chain-1',
      chains: [],
      activeSession,
    });
    expect(state.currentView).toBe('focus');
  });

  test('parseViewStateFromSearch handles invalid and rsip views', () => {
    const invalid = parseViewStateFromSearch({
      search: '?view=invalid-view',
      chains: [],
      activeSession: null,
    });
    expect(invalid).toEqual({
      currentView: 'dashboard',
      viewingChainId: null,
      editingChainId: null,
    });

    const rsip = parseViewStateFromSearch({
      search: '?view=rsip',
      chains: [],
      activeSession: null,
    });
    expect(rsip).toEqual({
      currentView: 'rsip',
      viewingChainId: null,
      editingChainId: null,
    });
  });

  test('parseViewStateFromSearch reads editor parent and rejects missing edit chain', () => {
    const parentState = parseViewStateFromSearch({
      search: '?view=editor&parent=parent-1',
      chains: [],
      activeSession: null,
    });
    expect(parentState.currentView).toBe('editor');
    expect(parentState.viewingChainId).toBe('parent-1');
    expect(parentState.editingChainId).toBeNull();

    const missingEdit = parseViewStateFromSearch({
      search: '?view=taskgroup-editor&edit=missing',
      chains: [],
      activeSession: null,
    });
    expect(missingEdit.currentView).toBe('dashboard');
  });

  test('serializeViewStateToSearch handles focus and editor parent modes', () => {
    const focusSearch = serializeViewStateToSearch({
      currentView: 'focus',
      viewingChainId: null,
      editingChainId: null,
      activeSessionChainId: 'session-chain',
    });
    expect(focusSearch).toBe('?view=focus&chain=session-chain');

    const editorSearch = serializeViewStateToSearch({
      currentView: 'editor',
      viewingChainId: 'parent-1',
      editingChainId: null,
      activeSessionChainId: null,
    });
    expect(editorSearch).toBe('?view=editor&parent=parent-1');
  });
});
