import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RSIPViewProps } from '../../../RSIPView.types';
import type { RSIPNode } from '../../../../types';
import type { RSIPViewStateSlice } from '../useRSIPViewModel.types';
import { useRSIPViewCreationActions } from '../useRSIPViewCreationActions';
import { createGroup, createNode, createState } from './testHelpers';

const NOW = new Date('2026-07-14T10:20:30.000Z');
const UUID_1 = '00000000-0000-4000-8000-000000000001';
const UUID_2 = '00000000-0000-4000-8000-000000000002';

type CreationProps = Pick<
  RSIPViewProps,
  'onSaveMeta' | 'onSaveNodes' | 'onSaveGroups' | 'onCreateGroup'
>;

function createProps(overrides: Partial<CreationProps> = {}): CreationProps {
  return {
    onSaveNodes: vi.fn(),
    onSaveMeta: vi.fn(),
    ...overrides,
  };
}

function renderCreationActions(
  stateOverrides: Partial<RSIPViewStateSlice> = {},
  propsOverrides: Partial<CreationProps> = {},
) {
  const state = createState(stateOverrides);
  const props = createProps(propsOverrides);
  const hook = renderHook(() => useRSIPViewCreationActions({ state, props }));

  return { ...hook, props, state };
}

function createDeferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('useRSIPViewCreationActions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('persists both mode choices without discarding unrelated metadata', async () => {
    const onSaveMeta = vi.fn(async () => undefined);
    const meta = { treeOpenStreak: 4, allowMultiplePerDay: false };
    const { result } = renderCreationActions({ meta }, { onSaveMeta });

    await act(() => result.current.handleModeChange('free'));
    await act(() => result.current.handleModeChange('strict'));

    expect(onSaveMeta).toHaveBeenNthCalledWith(1, {
      treeOpenStreak: 4,
      allowMultiplePerDay: true,
    });
    expect(onSaveMeta).toHaveBeenNthCalledWith(2, {
      treeOpenStreak: 4,
      allowMultiplePerDay: false,
    });
  });

  it('serializes rapid mode changes so an older full-meta save cannot finish last', async () => {
    const firstSave = createDeferred();
    const onSaveMeta = vi
      .fn<NonNullable<CreationProps['onSaveMeta']>>()
      .mockImplementationOnce(() => firstSave.promise)
      .mockResolvedValueOnce(undefined);
    const { result } = renderCreationActions(
      { meta: { treeOpenStreak: 4, allowMultiplePerDay: false } },
      { onSaveMeta },
    );

    let freeSave!: Promise<void>;
    let strictSave!: Promise<void>;
    act(() => {
      freeSave = result.current.handleModeChange('free');
      strictSave = result.current.handleModeChange('strict');
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onSaveMeta).toHaveBeenCalledOnce();
    expect(onSaveMeta).toHaveBeenCalledWith({
      treeOpenStreak: 4,
      allowMultiplePerDay: true,
    });

    await act(async () => {
      firstSave.resolve();
      await freeSave;
      await strictSave;
    });

    expect(onSaveMeta).toHaveBeenNthCalledWith(2, {
      treeOpenStreak: 4,
      allowMultiplePerDay: false,
    });
  });

  it('does not leak a rejected metadata patch into the next queued update', async () => {
    const failure = new Error('mode save failed');
    const onSaveMeta = vi
      .fn<NonNullable<CreationProps['onSaveMeta']>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined);
    const { result } = renderCreationActions(
      { meta: { treeOpenStreak: 4, allowMultiplePerDay: false } },
      { onSaveMeta },
    );

    const modeSave = result.current.handleModeChange('free');
    const openedSave = result.current.handleRecordTreeOpened();

    await expect(modeSave).rejects.toBe(failure);
    await act(async () => {
      await openedSave;
    });

    expect(onSaveMeta).toHaveBeenNthCalledWith(2, {
      treeOpenStreak: 1,
      allowMultiplePerDay: false,
      lastTreeOpenedAt: NOW,
    });
  });

  it('increments a consecutive tree-open streak and records the exact day', async () => {
    const onSaveMeta = vi.fn(async () => undefined);
    const yesterday = new Date(NOW);
    yesterday.setDate(yesterday.getDate() - 1);
    const { result } = renderCreationActions(
      {
        meta: {
          dailyTreeOpenRequired: true,
          lastTreeOpenedAt: yesterday,
          treeOpenStreak: 6,
        },
      },
      { onSaveMeta },
    );

    await act(() => result.current.handleRecordTreeOpened());

    expect(onSaveMeta).toHaveBeenCalledWith({
      dailyTreeOpenRequired: true,
      lastTreeOpenedAt: NOW,
      treeOpenStreak: 7,
    });
  });

  it("keeps today's streak stable and resets a broken streak to one", async () => {
    const todaySave = vi.fn(async () => undefined);
    const olderSave = vi.fn(async () => undefined);
    const today = renderCreationActions(
      { meta: { lastTreeOpenedAt: new Date(NOW), treeOpenStreak: 8 } },
      { onSaveMeta: todaySave },
    );
    const older = renderCreationActions(
      {
        meta: {
          lastTreeOpenedAt: new Date('2026-07-10T10:20:30.000Z'),
          treeOpenStreak: 8,
        },
      },
      { onSaveMeta: olderSave },
    );

    await act(() => today.result.current.handleRecordTreeOpened());
    await act(() => older.result.current.handleRecordTreeOpened());

    expect(todaySave).toHaveBeenCalledWith({
      lastTreeOpenedAt: NOW,
      treeOpenStreak: 8,
    });
    expect(olderSave).toHaveBeenCalledWith({
      lastTreeOpenedAt: NOW,
      treeOpenStreak: 1,
    });
  });

  it.each([
    {
      name: 'the strict-mode daily limit is exhausted',
      overrides: { canAddToday: false, isStrictMode: true },
    },
    {
      name: 'the title is blank',
      overrides: { canAddToday: true, title: '   ' },
    },
    {
      name: 'the rule is blank',
      overrides: { canAddToday: true, rule: '\t' },
    },
  ])('does not create a single node when $name', async ({ overrides }) => {
    const onSaveNodes = vi.fn();
    const onSaveMeta = vi.fn();
    const setTitle = vi.fn();
    const setRule = vi.fn();
    const { result } = renderCreationActions(
      {
        title: 'Policy',
        rule: 'Rule',
        setTitle,
        setRule,
        ...overrides,
      },
      { onSaveNodes, onSaveMeta },
    );

    await act(() => result.current.handleAddSingle());

    expect(onSaveNodes).not.toHaveBeenCalled();
    expect(onSaveMeta).not.toHaveBeenCalled();
    expect(setTitle).not.toHaveBeenCalled();
    expect(setRule).not.toHaveBeenCalled();
  });

  it('creates one trimmed node with its hierarchy, timer, type, and passive fields', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(UUID_1);
    const existing = createNode({ id: 'existing' });
    const onSaveNodes = vi.fn(async () => undefined);
    const onSaveMeta = vi.fn(async () => undefined);
    const setTitle = vi.fn();
    const setRule = vi.fn();
    const { result } = renderCreationActions(
      {
        nodes: [existing],
        meta: { allowMultiplePerDay: true },
        title: '  Morning policy  ',
        rule: '  Start by 08:00  ',
        selectedParentId: 'parent-1',
        selectedGroupId: 'group-1',
        createUseTimer: true,
        createTimerMinutes: 25,
        createType: 'routine',
        createEmoji: '🌅',
        createIsPassive: true,
        setTitle,
        setRule,
      },
      { onSaveNodes, onSaveMeta },
    );

    await act(() => result.current.handleAddSingle());

    const expectedNode: RSIPNode = {
      id: UUID_1,
      parentId: 'parent-1',
      groupId: 'group-1',
      title: 'Morning policy',
      rule: 'Start by 08:00',
      sortOrder: Math.floor(NOW.getTime() / 1000),
      createdAt: NOW,
      useTimer: true,
      timerMinutes: 25,
      type: 'routine',
      emoji: '🌅',
      isPassive: true,
    };
    expect(onSaveNodes).toHaveBeenCalledWith([existing, expectedNode]);
    expect(onSaveMeta).toHaveBeenCalledWith({
      allowMultiplePerDay: true,
      lastAddedAt: NOW,
    });
    expect(setTitle).toHaveBeenCalledWith('');
    expect(setRule).toHaveBeenCalledWith('');
  });

  it('waits for the node-save callback before recording metadata or clearing the form', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(UUID_1);
    const deferred = createDeferred();
    const onSaveNodes = vi.fn(() => deferred.promise);
    const onSaveMeta = vi.fn(async () => undefined);
    const setTitle = vi.fn();
    const setRule = vi.fn();
    const { result } = renderCreationActions(
      { title: 'Policy', rule: 'Rule', setTitle, setRule },
      { onSaveNodes, onSaveMeta },
    );

    let submission!: Promise<void>;
    act(() => {
      submission = result.current.handleAddSingle();
    });

    expect(onSaveNodes).toHaveBeenCalledOnce();
    expect(onSaveMeta).not.toHaveBeenCalled();
    expect(setTitle).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve();
      await submission;
    });

    expect(onSaveMeta).toHaveBeenCalledOnce();
    expect(setTitle).toHaveBeenCalledWith('');
    expect(setRule).toHaveBeenCalledWith('');
  });

  it('coalesces repeated single-node submissions while the full-state save is pending', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(UUID_1);
    const deferred = createDeferred();
    const onSaveNodes = vi.fn(() => deferred.promise);
    const onSaveMeta = vi.fn(async () => undefined);
    const { result } = renderCreationActions(
      { title: 'Policy', rule: 'Rule' },
      { onSaveNodes, onSaveMeta },
    );

    let firstSubmission!: Promise<void>;
    let duplicateSubmission!: Promise<void>;
    act(() => {
      firstSubmission = result.current.handleAddSingle();
      duplicateSubmission = result.current.handleAddSingle();
    });

    await duplicateSubmission;
    expect(onSaveNodes).toHaveBeenCalledOnce();
    expect(onSaveMeta).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve();
      await firstSubmission;
    });

    expect(onSaveMeta).toHaveBeenCalledOnce();
  });

  it('merges a mode change made while node persistence is pending into the later metadata update', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(UUID_1);
    const nodeSave = createDeferred();
    const onSaveNodes = vi.fn(() => nodeSave.promise);
    const onSaveMeta = vi.fn(async () => undefined);
    const { result } = renderCreationActions(
      {
        meta: { treeOpenStreak: 3, allowMultiplePerDay: false },
        title: 'Policy',
        rule: 'Rule',
      },
      { onSaveNodes, onSaveMeta },
    );

    let creation!: Promise<void>;
    let modeChange!: Promise<void>;
    act(() => {
      creation = result.current.handleAddSingle();
      modeChange = result.current.handleModeChange('free');
    });

    await act(async () => {
      await modeChange;
    });
    expect(onSaveMeta).toHaveBeenCalledWith({
      treeOpenStreak: 3,
      allowMultiplePerDay: true,
    });

    await act(async () => {
      nodeSave.resolve();
      await creation;
    });

    expect(onSaveMeta).toHaveBeenNthCalledWith(2, {
      treeOpenStreak: 3,
      allowMultiplePerDay: true,
      lastAddedAt: NOW,
    });
  });

  it('surfaces a node-save failure without falsely marking or clearing the draft', async () => {
    const failure = new Error('save failed');
    const onSaveMeta = vi.fn();
    const setTitle = vi.fn();
    const setRule = vi.fn();
    const { result } = renderCreationActions(
      { title: 'Policy', rule: 'Rule', setTitle, setRule },
      {
        onSaveNodes: vi.fn(() => Promise.reject(failure)),
        onSaveMeta,
      },
    );

    let submission!: Promise<void>;
    act(() => {
      submission = result.current.handleAddSingle();
    });

    await expect(submission).rejects.toBe(failure);
    expect(onSaveMeta).not.toHaveBeenCalled();
    expect(setTitle).not.toHaveBeenCalled();
    expect(setRule).not.toHaveBeenCalled();
  });

  it('clears a committed node draft even when the follow-up metadata save fails', async () => {
    const failure = new Error('meta save failed');
    const setTitle = vi.fn();
    const setRule = vi.fn();
    const { result } = renderCreationActions(
      { title: 'Policy', rule: 'Rule', setTitle, setRule },
      {
        onSaveNodes: vi.fn(async () => undefined),
        onSaveMeta: vi.fn(() => Promise.reject(failure)),
      },
    );

    await expect(result.current.handleAddSingle()).rejects.toBe(failure);
    expect(setTitle).toHaveBeenCalledWith('');
    expect(setRule).toHaveBeenCalledWith('');
  });

  it('applies a split template with fresh row identities and leaves its source unchanged', () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce(UUID_1)
      .mockReturnValueOnce(UUID_2);
    const template = {
      goal: 'Sleep well',
      items: [
        {
          id: 'source-1',
          title: 'Wind down',
          rule: 'At 22:00',
          isPassive: false,
        },
        {
          id: 'source-2',
          title: 'No phone',
          rule: 'After 22:30',
          isPassive: true,
        },
      ],
    };
    const setSplitGoal = vi.fn();
    const setSplitItems = vi.fn();
    const { result } = renderCreationActions({
      splitTemplates: { sleep: template },
      setSplitGoal,
      setSplitItems,
    });

    act(() => result.current.handleApplySplitTemplate('sleep'));

    expect(setSplitGoal).toHaveBeenCalledWith('Sleep well');
    expect(setSplitItems).toHaveBeenCalledWith([
      { ...template.items[0], id: UUID_1 },
      { ...template.items[1], id: UUID_2 },
    ]);
    expect(template.items.map((item) => item.id)).toEqual([
      'source-1',
      'source-2',
    ]);
  });

  it('ignores an unknown split template and appends a real blank draft row', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(UUID_1);
    const setSplitGoal = vi.fn();
    const setSplitItems = vi.fn();
    const { result } = renderCreationActions({
      setSplitGoal,
      setSplitItems,
    });

    act(() => result.current.handleApplySplitTemplate('missing'));
    act(() => result.current.handleAddSplitRow());

    expect(setSplitGoal).not.toHaveBeenCalled();
    const append = setSplitItems.mock.calls[0][0];
    expect(
      append([{ id: 'old', title: 'Existing', rule: 'Rule', isPassive: true }]),
    ).toEqual([
      { id: 'old', title: 'Existing', rule: 'Rule', isPassive: true },
      { id: UUID_1, title: '', rule: '', isPassive: false },
    ]);
  });

  it.each([
    {
      name: 'daily creation is unavailable',
      state: {
        canAddToday: false,
        splitItems: [
          { id: 'valid', title: 'Title', rule: 'Rule', isPassive: false },
        ],
      },
    },
    {
      name: 'every row is incomplete',
      state: {
        canAddToday: true,
        splitItems: [
          { id: 'no-title', title: ' ', rule: 'Rule', isPassive: false },
          { id: 'no-rule', title: 'Title', rule: ' ', isPassive: true },
        ],
      },
    },
  ])('does not submit a split when $name', async ({ state }) => {
    const onSaveNodes = vi.fn();
    const onSaveMeta = vi.fn();
    const setSplitItems = vi.fn();
    const { result } = renderCreationActions(
      { ...state, setSplitItems },
      { onSaveNodes, onSaveMeta },
    );

    await act(() => result.current.handleSubmitSplit());

    expect(onSaveNodes).not.toHaveBeenCalled();
    expect(onSaveMeta).not.toHaveBeenCalled();
    expect(setSplitItems).not.toHaveBeenCalled();
  });

  it('creates only valid split rows in stable order and resets after save callbacks resolve', async () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce(UUID_1)
      .mockReturnValueOnce(UUID_2);
    const existing = createNode({ id: 'existing' });
    const onSaveNodes = vi.fn(async () => undefined);
    const onSaveMeta = vi.fn(async () => undefined);
    const setSplitItems = vi.fn();
    const setSplitGoal = vi.fn();
    const { result } = renderCreationActions(
      {
        nodes: [existing],
        meta: { allowMultiplePerDay: true },
        selectedParentId: 'parent-1',
        selectedGroupId: 'group-1',
        createType: 'policy',
        createEmoji: '📜',
        splitGoal: '  Better sleep  ',
        splitItems: [
          {
            id: 'row-1',
            title: '  First  ',
            rule: '  Rule one  ',
            isPassive: false,
          },
          { id: 'invalid', title: 'Missing rule', rule: ' ', isPassive: false },
          {
            id: 'row-2',
            title: '  Second  ',
            rule: '  Rule two  ',
            isPassive: true,
          },
        ],
        setSplitItems,
        setSplitGoal,
      },
      { onSaveNodes, onSaveMeta },
    );

    await act(() => result.current.handleSubmitSplit());

    const baseSort = Math.floor(NOW.getTime() / 1000);
    expect(onSaveNodes).toHaveBeenCalledWith([
      existing,
      {
        id: UUID_1,
        parentId: 'parent-1',
        groupId: 'group-1',
        title: 'First',
        rule: 'Rule one',
        sortOrder: baseSort,
        createdAt: NOW,
        type: 'policy',
        emoji: '📜',
        isPassive: false,
        splitFromGoal: 'Better sleep',
      },
      {
        id: UUID_2,
        parentId: 'parent-1',
        groupId: 'group-1',
        title: 'Second',
        rule: 'Rule two',
        sortOrder: baseSort + 1,
        createdAt: NOW,
        type: 'policy',
        emoji: '📜',
        isPassive: true,
        splitFromGoal: 'Better sleep',
      },
    ]);
    expect(onSaveMeta).toHaveBeenCalledWith({
      allowMultiplePerDay: true,
      lastAddedAt: NOW,
    });
    expect(setSplitItems).toHaveBeenCalledWith([]);
    expect(setSplitGoal).toHaveBeenCalledWith('');
  });

  it('prevents duplicate split submissions until the first save has settled', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(UUID_1);
    const deferred = createDeferred();
    const onSaveNodes = vi.fn(() => deferred.promise);
    const onSaveMeta = vi.fn(async () => undefined);
    const { result } = renderCreationActions(
      {
        splitItems: [
          { id: 'row', title: 'Policy', rule: 'Rule', isPassive: false },
        ],
      },
      { onSaveNodes, onSaveMeta },
    );

    let firstSubmission!: Promise<void>;
    let duplicateSubmission!: Promise<void>;
    act(() => {
      firstSubmission = result.current.handleSubmitSplit();
      duplicateSubmission = result.current.handleSubmitSplit();
    });

    await duplicateSubmission;
    expect(onSaveNodes).toHaveBeenCalledOnce();

    await act(async () => {
      deferred.resolve();
      await firstSubmission;
    });

    expect(onSaveMeta).toHaveBeenCalledOnce();
  });

  it('clears committed split rows even when the follow-up metadata save fails', async () => {
    const failure = new Error('meta save failed');
    const setSplitItems = vi.fn();
    const setSplitGoal = vi.fn();
    const { result } = renderCreationActions(
      {
        splitGoal: 'Goal',
        splitItems: [
          { id: 'row', title: 'Policy', rule: 'Rule', isPassive: false },
        ],
        setSplitItems,
        setSplitGoal,
      },
      {
        onSaveNodes: vi.fn(async () => undefined),
        onSaveMeta: vi.fn(() => Promise.reject(failure)),
      },
    );

    await expect(result.current.handleSubmitSplit()).rejects.toBe(failure);
    expect(setSplitItems).toHaveBeenCalledWith([]);
    expect(setSplitGoal).toHaveBeenCalledWith('');
  });

  it('delegates group creation with normalized input and selects the saved group', async () => {
    const group = createGroup({ id: 'remote-group' });
    const onCreateGroup = vi.fn(async () => group);
    const onSaveGroups = vi.fn();
    const setSelectedGroupId = vi.fn();
    vi.spyOn(window, 'prompt')
      .mockReturnValueOnce('  Remote group  ')
      .mockReturnValueOnce('-2.7')
      .mockReturnValueOnce('  🛰️  ');
    const { result } = renderCreationActions(
      { setSelectedGroupId },
      { onCreateGroup, onSaveGroups },
    );

    await act(() => result.current.handleCreateGroup());

    expect(onCreateGroup).toHaveBeenCalledWith('Remote group', 0, '🛰️');
    expect(onSaveGroups).not.toHaveBeenCalled();
    expect(setSelectedGroupId).toHaveBeenCalledWith('remote-group');
  });

  it('falls back to local group creation with safe defaults and awaits its save callback', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(UUID_1);
    vi.spyOn(window, 'prompt')
      .mockReturnValueOnce('  Local group  ')
      .mockReturnValueOnce('not-a-number')
      .mockReturnValueOnce('   ');
    const existing = createGroup({ id: 'existing' });
    const deferred = createDeferred();
    const onSaveGroups = vi.fn(() => deferred.promise);
    const setSelectedGroupId = vi.fn();
    const { result } = renderCreationActions(
      { groups: [existing], setSelectedGroupId },
      { onSaveGroups },
    );

    let creation!: Promise<void>;
    act(() => {
      creation = result.current.handleCreateGroup();
    });

    expect(onSaveGroups).toHaveBeenCalledWith([
      existing,
      {
        id: UUID_1,
        title: 'Local group',
        faultTolerance: 1,
        emoji: undefined,
        createdAt: NOW,
      },
    ]);
    expect(setSelectedGroupId).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve();
      await creation;
    });

    expect(setSelectedGroupId).toHaveBeenCalledWith(UUID_1);
  });

  it('does not open another group prompt while group persistence is pending', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(UUID_1);
    const prompt = vi
      .spyOn(window, 'prompt')
      .mockReturnValueOnce('Group')
      .mockReturnValueOnce('1')
      .mockReturnValueOnce('🧱');
    const deferred = createDeferred();
    const onSaveGroups = vi.fn(() => deferred.promise);
    const { result } = renderCreationActions({}, { onSaveGroups });

    let firstCreation!: Promise<void>;
    let duplicateCreation!: Promise<void>;
    act(() => {
      firstCreation = result.current.handleCreateGroup();
      duplicateCreation = result.current.handleCreateGroup();
    });

    await duplicateCreation;
    expect(prompt).toHaveBeenCalledTimes(3);
    expect(onSaveGroups).toHaveBeenCalledOnce();

    await act(async () => {
      deferred.resolve();
      await firstCreation;
    });
  });

  it('cancels group creation without prompting for extra fields or saving', async () => {
    const prompt = vi.spyOn(window, 'prompt').mockReturnValueOnce('   ');
    const onCreateGroup = vi.fn();
    const onSaveGroups = vi.fn();
    const { result } = renderCreationActions(
      {},
      { onCreateGroup, onSaveGroups },
    );

    await act(() => result.current.handleCreateGroup());

    expect(prompt).toHaveBeenCalledOnce();
    expect(onCreateGroup).not.toHaveBeenCalled();
    expect(onSaveGroups).not.toHaveBeenCalled();
  });
  it('B05 refuses a strict-mode template batch without saving any nodes', async () => {
    const { result, props } = renderCreationActions({
      meta: { allowMultiplePerDay: false },
      canAddToday: true,
      splitItems: [
        { id: 'a', title: 'A', rule: 'Rule A', isPassive: false },
        { id: 'b', title: 'B', rule: 'Rule B', isPassive: false },
      ],
    });
    await act(() => result.current.handleSubmitSplit());
    expect(props.onSaveNodes).not.toHaveBeenCalled();
    expect(props.onSaveMeta).not.toHaveBeenCalled();
  });
});
