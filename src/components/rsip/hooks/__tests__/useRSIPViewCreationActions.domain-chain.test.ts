import { act, renderHook } from '@testing-library/react';
import type { Dispatch, SetStateAction } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRsipDomain } from '../../../../hooks/domains/useRsipDomain';
import {
  createAppState,
  createLocalStorageMock,
} from '../../../../test/factories';
import type { AppState, RSIPMeta, RSIPNode } from '../../../../types';
import { localStorageAdapter } from '../../../../storage/localStorageAdapter';
import { STORAGE_KEYS } from '../../../../utils/storage/keys';
import { useRSIPViewCreationActions } from '../useRSIPViewCreationActions';
import { createState } from './testHelpers';

function createStateContainer(initialState: AppState) {
  let state = initialState;
  const setState: Dispatch<SetStateAction<AppState>> = (update) => {
    state =
      typeof update === 'function'
        ? (update as (previous: AppState) => AppState)(state)
        : update;
  };
  return { getState: () => state, setState };
}

describe('RSIP creation atomic domain chain', () => {
  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries the same node without exposing either slice before atomic success', async () => {
    const now = new Date('2026-07-16T08:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
      .mockReturnValue('00000000-0000-4000-8000-000000000002');
    const originalNodes: AppState['rsipNodes'] = [];
    const originalMeta: AppState['rsipMeta'] = {
      allowMultiplePerDay: false,
    };
    const stateRef = createStateContainer(
      createAppState({ rsipNodes: originalNodes, rsipMeta: originalMeta }),
    );
    const failure = new Error('atomic creation response unavailable');
    const createRSIPNodesWithMeta = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockImplementationOnce(async (nodes, meta) => ({ nodes, meta }));
    const storage = createLocalStorageMock({ createRSIPNodesWithMeta });
    const domain = useRsipDomain({
      setState: stateRef.setState,
      storage,
      getState: stateRef.getState,
    });
    const state = createState({
      nodes: originalNodes,
      meta: originalMeta,
      isStrictMode: true,
      canAddToday: true,
      title: 'Atomic policy',
      rule: 'Commit nodes and metadata together',
    });
    const { result } = renderHook(() =>
      useRSIPViewCreationActions({
        state,
        props: {
          onCreateNodes: domain.createNodes,
          onSaveMeta: domain.saveMeta,
        },
      }),
    );

    await act(async () => {
      await expect(result.current.handleAddSingle()).rejects.toBe(failure);
    });

    expect(stateRef.getState().rsipNodes).toBe(originalNodes);
    expect(stateRef.getState().rsipMeta).toBe(originalMeta);
    expect(storage.saveRSIPNodes).not.toHaveBeenCalled();
    expect(storage.saveRSIPMeta).not.toHaveBeenCalled();

    vi.setSystemTime(new Date(now.getTime() + 60000));
    await act(async () => {
      await result.current.handleAddSingle();
    });

    expect(stateRef.getState().rsipNodes).toEqual([
      expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000001',
        title: 'Atomic policy',
      }),
    ]);
    expect(stateRef.getState().rsipMeta).toEqual({
      allowMultiplePerDay: false,
      lastAddedAt: now,
      currentRunNumber: 1,
      currentRunStartedAt: now,
    });
    expect(createRSIPNodesWithMeta).toHaveBeenCalledTimes(2);
    expect(createRSIPNodesWithMeta.mock.calls[1]).toEqual(
      createRSIPNodesWithMeta.mock.calls[0],
    );
  });

  it('publishes nodes and metadata together before a queued mode update', async () => {
    let finish!: (value: { nodes: RSIPNode[]; meta: RSIPMeta }) => void;
    const pending = new Promise<{ nodes: RSIPNode[]; meta: RSIPMeta }>(
      (resolve) => {
        finish = resolve;
      },
    );
    const storage = createLocalStorageMock({
      createRSIPNodesWithMeta: vi.fn(() => pending),
    });
    const stateRef = createStateContainer(
      createAppState({ rsipNodes: [], rsipMeta: { treeOpenStreak: 3 } }),
    );
    const snapshots: AppState[] = [];
    const domain = useRsipDomain({
      storage,
      getState: stateRef.getState,
      setState: (update) => {
        stateRef.setState(update);
        snapshots.push(stateRef.getState());
      },
    });
    const { result } = renderHook(() =>
      useRSIPViewCreationActions({
        state: createState({ title: 'Policy', rule: 'Rule' }),
        props: {
          onCreateNodes: domain.createNodes,
          onSaveMeta: domain.saveMeta,
        },
      }),
    );
    const creation = result.current.handleAddSingle();
    const modeChange = result.current.handleModeChange('free');
    await act(async () => {
      await Promise.resolve();
    });
    expect(snapshots).toEqual([]);
    expect(storage.saveRSIPMeta).not.toHaveBeenCalled();
    const [nodes, meta] = vi.mocked(storage.createRSIPNodesWithMeta).mock
      .calls[0];
    await act(async () => {
      finish({ nodes, meta });
      await creation;
      await modeChange;
    });
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].rsipNodes).toHaveLength(1);
    expect(snapshots[0].rsipMeta).toEqual(
      expect.objectContaining({
        lastAddedAt: nodes[0].createdAt,
        currentRunNumber: 1,
        treeOpenStreak: 3,
      }),
    );
    expect(snapshots[1].rsipMeta).toEqual({
      ...snapshots[0].rsipMeta,
      allowMultiplePerDay: true,
    });
  });

  it('rejects a second queued strict-mode creation using committed state', async () => {
    const storage = createLocalStorageMock();
    const stateRef = createStateContainer(
      createAppState({ rsipNodes: [], rsipMeta: {} }),
    );
    const domain = useRsipDomain({
      storage,
      getState: stateRef.getState,
      setState: stateRef.setState,
    });
    const node = {
      id: 'one',
      title: 'One',
      rule: 'Rule',
      createdAt: new Date(),
      sortOrder: 0,
    };
    const first = domain.createNodes([node]);
    const second = domain.createNodes([{ ...node, id: 'two' }]);
    await expect(first).resolves.toBeUndefined();
    await expect(second).rejects.toThrow('one new policy per day');
    expect(stateRef.getState().rsipNodes.map(({ id }) => id)).toEqual(['one']);
    expect(storage.createRSIPNodesWithMeta).toHaveBeenCalledOnce();
  });

  it('retries a split after a local partial write and recovers both slices without duplicates', async () => {
    localStorage.clear();
    await localStorageAdapter.saveRSIPMeta({ allowMultiplePerDay: true });
    const stateRef = createStateContainer(
      createAppState({
        rsipNodes: [],
        rsipMeta: { allowMultiplePerDay: true },
      }),
    );
    const domain = useRsipDomain({
      storage: localStorageAdapter,
      getState: stateRef.getState,
      setState: stateRef.setState,
    });
    const state = createState({
      setSplitItems: vi.fn(),
      meta: { allowMultiplePerDay: true },
      splitGoal: 'Goal',
      splitItems: [
        { id: 'row-1', title: 'One', rule: 'Rule one', isPassive: false },
        { id: 'row-2', title: 'Two', rule: 'Rule two', isPassive: true },
      ],
    });
    const { result } = renderHook(() =>
      useRSIPViewCreationActions({
        state,
        props: {
          onCreateNodes: domain.createNodes,
          onSaveMeta: domain.saveMeta,
        },
      }),
    );
    const setItem = Storage.prototype.setItem;
    let failMeta = true;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
      function (key, value) {
        if (key === STORAGE_KEYS.RSIP_META && failMeta) {
          failMeta = false;
          throw new Error('interrupted meta write');
        }
        setItem.call(this, key, value);
      },
    );
    await act(async () => {
      await expect(result.current.handleSubmitSplit()).rejects.toThrow(
        'interrupted meta write',
      );
    });
    expect(stateRef.getState().rsipNodes).toEqual([]);
    expect(stateRef.getState().rsipMeta).toEqual({ allowMultiplePerDay: true });
    expect(state.setSplitItems).not.toHaveBeenCalled();
    expect(
      localStorage.getItem(STORAGE_KEYS.RSIP_ATOMIC_JOURNAL),
    ).not.toBeNull();
    await act(async () => {
      await result.current.handleSubmitSplit();
    });
    const loadedNodes = await localStorageAdapter.getRSIPNodes();
    expect(loadedNodes.map(({ title }) => title)).toEqual(['One', 'Two']);
    expect(stateRef.getState().rsipNodes).toEqual(loadedNodes);
    expect(stateRef.getState().rsipMeta).toEqual(
      await localStorageAdapter.getRSIPMeta(),
    );
    expect(stateRef.getState().rsipMeta.lastAddedAt).toBeInstanceOf(Date);
    expect(localStorage.getItem(STORAGE_KEYS.RSIP_ATOMIC_JOURNAL)).toBeNull();
    expect(state.setSplitItems).toHaveBeenCalledWith([]);
  });
});
