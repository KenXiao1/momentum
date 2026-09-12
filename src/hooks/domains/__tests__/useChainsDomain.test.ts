import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState, ChainDraft } from '../../../types';
import {
  createAppState,
  createGroupChain,
  createLocalStorageMock,
  createUnitChain,
} from '../../../test/factories';
import { useChainsDomain } from '../useChainsDomain';
import { useI18n } from '../../../i18n';
import { toast } from '../../../utils/toast';
import { logger } from '../../../utils/logger';
import { getSafeErrorDetailFromUnknown } from '../../../utils/errorMessage';

const trMock = vi.fn((zh: string, en: string) => en);

vi.mock('../../../i18n', () => ({
  useI18n: vi.fn(() => ({
    language: 'en',
    tr: trMock,
  })),
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../utils/toast', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('../../../utils/errorMessage', () => ({
  getSafeErrorDetailFromUnknown: vi.fn(() => ''),
  toError: vi.fn((value: unknown) =>
    value instanceof Error ? value : new Error(String(value)),
  ),
}));

function createStateContainer(initial: AppState) {
  let state = initial;
  const setState = vi.fn(
    (update: AppState | ((prev: AppState) => AppState)) => {
      state =
        typeof update === 'function'
          ? (update as (prev: AppState) => AppState)(state)
          : update;
    },
  );
  return {
    getState: () => state,
    setState,
  };
}

function createUnitDraft(overrides: Partial<ChainDraft> = {}): ChainDraft {
  const chain = createUnitChain({
    id: 'draft-id',
    name: 'Draft Chain',
    parentId: undefined,
  });
  const {
    id,
    currentStreak,
    auxiliaryStreak,
    totalCompletions,
    totalFailures,
    auxiliaryFailures,
    createdAt,
    lastCompletedAt,
    ...draft
  } = chain;
  void id;
  void currentStreak;
  void auxiliaryStreak;
  void totalCompletions;
  void totalFailures;
  void auxiliaryFailures;
  void createdAt;
  void lastCompletedAt;
  return { ...draft, ...overrides } as ChainDraft;
}

function createGroupDraft(overrides: Partial<ChainDraft> = {}): ChainDraft {
  const chain = createGroupChain({
    id: 'group-draft-id',
    name: 'Group Draft',
    parentId: undefined,
  });
  const {
    id,
    currentStreak,
    auxiliaryStreak,
    totalCompletions,
    totalFailures,
    auxiliaryFailures,
    createdAt,
    lastCompletedAt,
    ...draft
  } = chain;
  void id;
  void currentStreak;
  void auxiliaryStreak;
  void totalCompletions;
  void totalFailures;
  void auxiliaryFailures;
  void createdAt;
  void lastCompletedAt;
  return { ...draft, ...overrides } as ChainDraft;
}

function expectNonEmptyDebugMessages() {
  const debugCalls = vi.mocked(logger.debug).mock.calls;
  expect(debugCalls.length).toBeGreaterThan(0);
  expect(
    debugCalls.every(
      ([, message]) => typeof message === 'string' && message.trim().length > 0,
    ),
  ).toBe(true);
}

describe('useChainsDomain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trMock.mockClear();
    vi.mocked(useI18n).mockReturnValue({
      language: 'en',
      tr: trMock,
    });
  });

  it('should open chain editor and ignore non-string parent input', () => {
    const stateRef = createStateContainer(createAppState());
    const onNavigateToEditor = vi.fn();
    const { result } = renderHook(() =>
      useChainsDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        editingChainId: null,
        storage: createLocalStorageMock(),
        safelySaveChains: vi.fn(async () => undefined),
        onNavigateToEditor,
      }),
    );

    const fakeEvent = { target: { value: 'should-not-pass' } };
    act(() => {
      result.current.handleCreateChain(fakeEvent);
    });

    expect(onNavigateToEditor).toHaveBeenCalledWith(null);
  });

  it('should open chain editor with explicit parent id', () => {
    const stateRef = createStateContainer(createAppState());
    const onNavigateToEditor = vi.fn();
    const { result } = renderHook(() =>
      useChainsDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        editingChainId: null,
        storage: createLocalStorageMock(),
        safelySaveChains: vi.fn(async () => undefined),
        onNavigateToEditor,
      }),
    );

    act(() => {
      result.current.handleCreateChain('parent-123');
    });

    expect(onNavigateToEditor).toHaveBeenCalledWith('parent-123');
  });

  it('should open task group editor when creating task group', () => {
    const stateRef = createStateContainer(createAppState());
    const onNavigateToTaskGroupEditor = vi.fn();
    const { result } = renderHook(() =>
      useChainsDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        editingChainId: null,
        storage: createLocalStorageMock(),
        safelySaveChains: vi.fn(async () => undefined),
        onNavigateToTaskGroupEditor,
      }),
    );

    act(() => {
      result.current.handleCreateTaskGroup();
    });

    expect(onNavigateToTaskGroupEditor).toHaveBeenCalledTimes(1);
  });

  it('should route group chain edit to taskgroup editor', () => {
    const group = createGroupChain({ id: 'group-1', name: 'Group 1' });
    const stateRef = createStateContainer(createAppState({ chains: [group] }));
    const onEditChain = vi.fn();

    const { result } = renderHook(() =>
      useChainsDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        editingChainId: null,
        storage: createLocalStorageMock(),
        safelySaveChains: vi.fn(async () => undefined),
        onEditChain,
      }),
    );

    act(() => {
      result.current.handleEditChain(group.id);
    });

    expect(onEditChain).toHaveBeenCalledWith(group, true);
  });

  it('should route legacy task-group shaped chains to taskgroup editor', () => {
    const legacyTaskGroup = {
      ...createUnitChain({ id: 'legacy-taskgroup', name: 'Legacy Task Group' }),
      isTaskGroup: true,
    } as AppState['chains'][number];
    const decoy = createUnitChain({ id: 'decoy-unit', name: 'Decoy Unit' });
    const stateRef = createStateContainer(
      createAppState({ chains: [decoy, legacyTaskGroup] }),
    );
    const onEditChain = vi.fn();

    const { result } = renderHook(() =>
      useChainsDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        editingChainId: null,
        storage: createLocalStorageMock(),
        safelySaveChains: vi.fn(async () => undefined),
        onEditChain,
      }),
    );

    act(() => {
      result.current.handleEditChain(legacyTaskGroup.id);
    });

    expect(onEditChain).toHaveBeenCalledWith(legacyTaskGroup, true);
  });

  it('should route unit chain edit to chain editor', () => {
    const unit = createUnitChain({ id: 'unit-1', name: 'Unit 1' });
    const stateRef = createStateContainer(createAppState({ chains: [unit] }));
    const onEditChain = vi.fn();

    const { result } = renderHook(() =>
      useChainsDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        editingChainId: null,
        storage: createLocalStorageMock(),
        safelySaveChains: vi.fn(async () => undefined),
        onEditChain,
      }),
    );

    act(() => {
      result.current.handleEditChain(unit.id);
    });

    expect(onEditChain).toHaveBeenCalledWith(unit, false);
  });

  it('should ignore edit request when chain id does not exist', () => {
    const stateRef = createStateContainer(createAppState());
    const onEditChain = vi.fn();

    const { result } = renderHook(() =>
      useChainsDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        editingChainId: null,
        storage: createLocalStorageMock(),
        safelySaveChains: vi.fn(async () => undefined),
        onEditChain,
      }),
    );

    act(() => {
      result.current.handleEditChain('missing-id');
    });

    expect(onEditChain).not.toHaveBeenCalled();
  });

  it('should create a new chain and persist via safelySaveChains', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('new-chain-id');
    const existing = createUnitChain({ id: 'existing-1', name: 'Existing' });
    const anotherActive = createUnitChain({
      id: 'existing-2',
      name: 'Existing 2',
    });
    const deleted = createUnitChain({
      id: 'deleted-1',
      name: 'Deleted',
      deletedAt: new Date(),
    });
    const stateRef = createStateContainer(
      createAppState({ chains: [existing, anotherActive] }),
    );
    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => [existing, anotherActive, deleted]),
    });
    const safelySaveChains = vi.fn(async () => undefined);
    const onNavigateToDashboard = vi.fn();

    const { result } = renderHook(() =>
      useChainsDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        editingChainId: null,
        storage,
        safelySaveChains,
        onNavigateToDashboard,
      }),
    );

    await act(async () => {
      await result.current.handleSaveChain(createUnitDraft(), false);
    });

    expect(safelySaveChains).toHaveBeenCalledTimes(1);
    const updated = safelySaveChains.mock.calls[0]?.[0];
    expect(updated).toHaveLength(3);
    expect(updated?.[2]).toMatchObject({
      id: 'new-chain-id',
      name: 'Draft Chain',
      parentId: undefined,
      currentStreak: 0,
      auxiliaryStreak: 0,
      totalCompletions: 0,
      totalFailures: 0,
      auxiliaryFailures: 0,
    });
    expect(onNavigateToDashboard).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(
      'CHAINS',
      'Starting to save chain data',
      expect.objectContaining({
        chainName: 'Draft Chain',
        chainType: 'unit',
        isCopy: false,
        chainCount: 2,
      }),
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'CHAINS',
      'Loaded existing chains (including deleted)',
      {
        count: 3,
      },
    );
    expect(logger.debug).toHaveBeenCalledWith('CHAINS', 'Chain counts', {
      active: 2,
      deleted: 1,
    });
    expect(logger.debug).toHaveBeenCalledWith(
      'CHAINS',
      'Create chain',
      expect.objectContaining({
        newChainId: 'new-chain-id',
        type: 'unit',
      }),
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'CHAINS',
      'Added chain; updated active chains',
      {
        count: 3,
      },
    );
    expect(logger.debug).toHaveBeenCalledWith('CHAINS', 'Saving chains');
    expect(logger.debug).toHaveBeenCalledWith(
      'CHAINS',
      'Save succeeded; updating UI state',
    );
    expectNonEmptyDebugMessages();
  });

  it('should create a new group chain from draft when not editing', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('new-group-id');
    const existing = createUnitChain({ id: 'existing-1', name: 'Existing' });
    const stateRef = createStateContainer(
      createAppState({ chains: [existing] }),
    );
    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => [existing]),
    });
    const safelySaveChains = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useChainsDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        editingChainId: null,
        storage,
        safelySaveChains,
      }),
    );

    await act(async () => {
      await result.current.handleSaveChain(
        createGroupDraft({ name: 'New Group Draft' }),
        false,
      );
    });

    const updated = safelySaveChains.mock.calls[0]?.[0] as AppState['chains'];
    const newGroup = updated.find((chain) => chain.id === 'new-group-id');

    expect(newGroup).toMatchObject({
      id: 'new-group-id',
      type: 'group',
      name: 'New Group Draft',
    });
    expect(logger.debug).toHaveBeenCalledWith(
      'CHAINS',
      'Create chain',
      expect.objectContaining({
        newChainId: 'new-group-id',
        type: 'group',
      }),
    );
    expectNonEmptyDebugMessages();
  });

  it('should update an existing unit chain in-place and normalize invalid parent id', async () => {
    const editing = createUnitChain({
      id: 'editing-1',
      name: 'Editing',
      parentId: 'old-parent',
    });
    const untouched = createUnitChain({ id: 'untouched-1', name: 'Untouched' });
    const stateRef = createStateContainer(
      createAppState({ chains: [editing, untouched] }),
    );
    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => [editing, untouched]),
    });
    const safelySaveChains = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useChainsDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        editingChainId: editing.id,
        storage,
        safelySaveChains,
      }),
    );

    await act(async () => {
      await result.current.handleSaveChain(
        createUnitDraft({
          name: 'Edited Unit',
          parentId: { bad: 'value' } as unknown as string,
        }),
        false,
      );
    });

    const updated = safelySaveChains.mock.calls[0]?.[0] as AppState['chains'];
    const edited = updated.find((c) => c.id === editing.id);
    const stillUntouched = updated.find((c) => c.id === untouched.id);

    expect(updated).toHaveLength(2);
    expect(edited?.name).toBe('Edited Unit');
    expect(edited?.parentId).toBeUndefined();
    expect(stillUntouched).toEqual(untouched);
    expect(logger.debug).toHaveBeenCalledWith(
      'CHAINS',
      'Editing existing chain',
      { chainId: editing.id },
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'CHAINS',
      'Edited chain; updated active chains',
      { count: 2 },
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'CHAINS',
      'Edited chain snapshot',
      {
        chainId: editing.id,
        name: 'Edited Unit',
        type: 'unit',
      },
    );
  });

  it('should default isCopy to false when omitted and preserve a valid string parent id', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('implicit-copy-flag-id');
    const stateRef = createStateContainer(createAppState({ chains: [] }));
    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => []),
    });
    const safelySaveChains = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useChainsDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        storage,
        safelySaveChains,
      }),
    );

    await act(async () => {
      await result.current.handleSaveChain(
        createUnitDraft({ parentId: 'parent-123', name: 'Implicit Copy Flag' }),
      );
    });

    expect(safelySaveChains).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'implicit-copy-flag-id',
        parentId: 'parent-123',
        name: 'Implicit Copy Flag',
      }),
    ]);
    expect(logger.debug).toHaveBeenCalledWith(
      'CHAINS',
      'Starting to save chain data',
      expect.objectContaining({
        isCopy: false,
      }),
    );
  });

  it('should convert edited group chain into unit chain by removing group-only fields', async () => {
    const editing = createGroupChain({
      id: 'editing-group',
      name: 'Group Before',
      timeLimitHours: 5,
      groupRepeatCount: 2,
    });
    const stateRef = createStateContainer(
      createAppState({ chains: [editing] }),
    );
    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => [editing]),
    });
    const safelySaveChains = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useChainsDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        editingChainId: editing.id,
        storage,
        safelySaveChains,
      }),
    );

    await act(async () => {
      await result.current.handleSaveChain(
        createUnitDraft({ name: 'Converted To Unit' }),
        false,
      );
    });

    const updated = safelySaveChains.mock.calls[0]?.[0] as AppState['chains'];
    const converted = updated[0] as Record<string, unknown>;

    expect(converted.type).toBe('unit');
    expect(converted.name).toBe('Converted To Unit');
    expect('timeLimitHours' in converted).toBe(false);
    expect('groupRepeatCount' in converted).toBe(false);
  });

  it('should convert edited unit chain into group chain', async () => {
    const editing = createUnitChain({
      id: 'editing-unit',
      name: 'Unit Before',
    });
    const stateRef = createStateContainer(
      createAppState({ chains: [editing] }),
    );
    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => [editing]),
    });
    const safelySaveChains = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useChainsDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        editingChainId: editing.id,
        storage,
        safelySaveChains,
      }),
    );

    await act(async () => {
      await result.current.handleSaveChain(
        createGroupDraft({ name: 'Converted To Group' }),
        false,
      );
    });

    const updated = safelySaveChains.mock.calls[0]?.[0] as AppState['chains'];
    expect(updated[0]).toMatchObject({
      id: editing.id,
      type: 'group',
      name: 'Converted To Group',
    });
  });

  it('should create a copied chain when editing and copy mode is enabled', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('copied-chain-id');
    const editing = createUnitChain({ id: 'editing-1', name: 'Source Chain' });
    const stateRef = createStateContainer(
      createAppState({ chains: [editing] }),
    );
    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => [editing]),
    });
    const safelySaveChains = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useChainsDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        editingChainId: editing.id,
        storage,
        safelySaveChains,
      }),
    );

    await act(async () => {
      await result.current.handleSaveChain(
        createUnitDraft({ name: 'Copied Chain' }),
        true,
      );
    });

    const updated = safelySaveChains.mock.calls[0]?.[0] as AppState['chains'];
    const original = updated.find((c) => c.id === editing.id);
    const copied = updated.find((c) => c.id === 'copied-chain-id');

    expect(updated).toHaveLength(2);
    expect(original?.name).toBe('Source Chain');
    expect(copied).toMatchObject({ name: 'Copied Chain' });
    expect(logger.debug).toHaveBeenCalledWith(
      'CHAINS',
      'Copy chain',
      expect.objectContaining({
        newChainId: 'copied-chain-id',
      }),
    );
    expectNonEmptyDebugMessages();
  });

  it('should surface save errors and reload active chains', async () => {
    const editing = createUnitChain({ id: 'editing-1', name: 'Editing' });
    const fallback = [createUnitChain({ id: 'fallback-1', name: 'Fallback' })];
    const stateRef = createStateContainer(
      createAppState({ chains: [editing] }),
    );
    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => [editing]),
      getActiveChains: vi.fn(async () => fallback),
    });
    const safelySaveChains = vi.fn(async () => {
      throw new Error('save failed');
    });
    vi.mocked(getSafeErrorDetailFromUnknown).mockReturnValue('disk is full');

    const { result } = renderHook(() =>
      useChainsDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        editingChainId: editing.id,
        storage,
        safelySaveChains,
      }),
    );

    await act(async () => {
      await result.current.handleSaveChain(
        createUnitDraft({ name: 'Edited name' }),
        false,
      );
    });

    expect(getSafeErrorDetailFromUnknown).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('Save failed: disk is full');
    expect(storage.getActiveChains).toHaveBeenCalledTimes(1);
    expect(stateRef.getState().chains).toEqual(fallback);
    expect(logger.error).toHaveBeenCalledWith(
      'CHAINS',
      'Failed to save chain',
      undefined,
      expect.any(Error),
    );
    expect(trMock).toHaveBeenCalledWith(
      expect.any(String),
      'Save failed: disk is full',
    );
  });

  it('should log reload failure when save recovery also fails', async () => {
    const editing = createUnitChain({ id: 'editing-1', name: 'Editing' });
    const stateRef = createStateContainer(
      createAppState({ chains: [editing] }),
    );
    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => [editing]),
      getActiveChains: vi.fn(async () => {
        throw new Error('reload failed');
      }),
    });
    const safelySaveChains = vi.fn(async () => {
      throw new Error('save failed');
    });
    vi.mocked(getSafeErrorDetailFromUnknown).mockReturnValue('network error');

    const { result } = renderHook(() =>
      useChainsDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        editingChainId: editing.id,
        storage,
        safelySaveChains,
      }),
    );

    await act(async () => {
      await result.current.handleSaveChain(
        createUnitDraft({ name: 'Edited name' }),
        false,
      );
    });

    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenNthCalledWith(
      1,
      'CHAINS',
      'Failed to save chain',
      undefined,
      expect.any(Error),
    );
    expect(logger.error).toHaveBeenNthCalledWith(
      2,
      'CHAINS',
      '重新加载数据也失败了',
      undefined,
      expect.any(Error),
    );
  });

  it('should use generic toast message when safe detail is unavailable', async () => {
    const editing = createUnitChain({ id: 'editing-1', name: 'Editing' });
    const fallback = [createUnitChain({ id: 'fallback-1', name: 'Fallback' })];
    const stateRef = createStateContainer(
      createAppState({ chains: [editing] }),
    );
    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => [editing]),
      getActiveChains: vi.fn(async () => fallback),
    });
    const safelySaveChains = vi.fn(async () => {
      throw new Error('save failed');
    });
    vi.mocked(getSafeErrorDetailFromUnknown).mockReturnValue('');

    const { result } = renderHook(() =>
      useChainsDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        editingChainId: editing.id,
        storage,
        safelySaveChains,
      }),
    );

    await act(async () => {
      await result.current.handleSaveChain(
        createUnitDraft({ name: 'Edited name' }),
        false,
      );
    });

    expect(toast.error).toHaveBeenCalledWith(
      'Save failed. Check the console for details, then try again.',
    );
    expect(trMock).toHaveBeenCalledWith(
      expect.any(String),
      'Save failed. Check the console for details, then try again.',
    );
  });

  it('should recover when loading all chains fails before save starts', async () => {
    const fallback = [
      createUnitChain({ id: 'fallback-2', name: 'Fallback 2' }),
    ];
    const stateRef = createStateContainer(createAppState({ chains: [] }));
    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => {
        throw new Error('load failed');
      }),
      getActiveChains: vi.fn(async () => fallback),
    });

    const { result } = renderHook(() =>
      useChainsDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        storage,
        safelySaveChains: vi.fn(async () => undefined),
      }),
    );

    await act(async () => {
      await result.current.handleSaveChain(
        createUnitDraft({ name: 'New Name' }),
        false,
      );
    });

    expect(storage.getActiveChains).toHaveBeenCalledTimes(1);
    expect(stateRef.getState().chains).toEqual(fallback);
    expect(toast.error).toHaveBeenCalled();
  });

  it('should preserve state when both save and reload throw non-Error values', async () => {
    const editing = createUnitChain({
      id: 'editing-non-error',
      name: 'Editing',
    });
    const stateRef = createStateContainer(
      createAppState({ chains: [editing] }),
    );
    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => [editing]),
      getActiveChains: vi.fn(async () => {
        throw 'reload-failed';
      }),
    });
    const safelySaveChains = vi.fn(async () => {
      throw 'save-failed';
    });
    vi.mocked(getSafeErrorDetailFromUnknown).mockReturnValue('');

    const { result } = renderHook(() =>
      useChainsDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        editingChainId: editing.id,
        storage,
        safelySaveChains,
      }),
    );

    await act(async () => {
      await result.current.handleSaveChain(
        createUnitDraft({ name: 'Edited name' }),
        false,
      );
    });

    expect(toast.error).toHaveBeenCalledWith(
      'Save failed. Check the console for details, then try again.',
    );
    expect(stateRef.getState().chains).toEqual([editing]);
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it('should use chinese error copy when safe detail is unavailable', async () => {
    vi.mocked(useI18n).mockReturnValue({
      language: 'zh',
      tr: (zh: string) => zh,
    });
    const editing = createUnitChain({ id: 'editing-zh', name: 'Editing Zh' });
    const stateRef = createStateContainer(
      createAppState({ chains: [editing] }),
    );
    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => [editing]),
      getActiveChains: vi.fn(async () => {
        throw 'reload-failed';
      }),
    });
    const safelySaveChains = vi.fn(async () => {
      throw 'save-failed';
    });
    vi.mocked(getSafeErrorDetailFromUnknown).mockReturnValue('');

    const { result } = renderHook(() =>
      useChainsDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        editingChainId: editing.id,
        storage,
        safelySaveChains,
      }),
    );

    await act(async () => {
      await result.current.handleSaveChain(
        createUnitDraft({ name: '中文保存失败' }),
        false,
      );
    });

    expect(toast.error).toHaveBeenCalledWith(
      '保存失败，请重试（详情见控制台）',
    );
    expect(logger.error).toHaveBeenNthCalledWith(
      2,
      'CHAINS',
      '重新加载数据也失败了',
      undefined,
      expect.any(Error),
    );
  });
});
