import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState } from '../../../types';
import {
  createAppState,
  createGroupChain,
  createLocalStorageMock,
  createUnitChain,
} from '../../../test/factories';
import { getSafeErrorDetailFromUnknown } from '../../../utils/errorMessage';
import { logger } from '../../../utils/logger';
import { toast } from '../../../utils/toast';
import { useGroupDomain } from '../useGroupDomain';

const trMock = vi.fn((zh: string, en: string) => en);

vi.mock('../../../i18n', () => ({
  useI18n: vi.fn(() => ({
    language: 'en',
    tr: trMock,
  })),
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
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
  getSafeErrorDetailFromUnknown: vi.fn(() => null),
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

function expectNonEmptyLogMessages() {
  const infoCalls = vi.mocked(logger.info).mock.calls;
  const debugCalls = vi.mocked(logger.debug).mock.calls;
  if (infoCalls.length > 0) {
    expect(
      infoCalls.every(
        ([, message]) =>
          typeof message === 'string' && message.trim().length > 0,
      ),
    ).toBe(true);
  }
  if (debugCalls.length > 0) {
    expect(
      debugCalls.every(
        ([, message]) =>
          typeof message === 'string' && message.trim().length > 0,
      ),
    ).toBe(true);
  }
}

describe('useGroupDomain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trMock.mockClear();
  });

  it('should import units in copy mode and append copied chains', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('copied-id');
    const group = createGroupChain({ id: 'group-1', name: 'Group 1' });
    const unit = createUnitChain({ id: 'unit-1', name: 'Unit 1' });
    const stateRef = createStateContainer(
      createAppState({ chains: [group, unit] }),
    );
    const safelySaveChains = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useGroupDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        storage: createLocalStorageMock(),
        safelySaveChains,
      }),
    );

    await act(async () => {
      await result.current.handleImportUnits([unit.id], group.id, 'copy');
    });

    expect(safelySaveChains).toHaveBeenCalledTimes(1);
    const updated = safelySaveChains.mock.calls[0]?.[0];
    expect(updated).toHaveLength(3);
    expect(updated?.[2]).toMatchObject({
      id: 'copied-id',
      parentId: group.id,
      name: 'Unit 1 (Copy)',
      currentStreak: 0,
      totalCompletions: 0,
    });
    expect(updated?.[0]?.id).toBe(group.id);
    expect(updated?.[1]?.id).toBe(unit.id);
    expect(stateRef.getState().chains).toEqual(updated);
    expectNonEmptyLogMessages();
    const importStartCall = vi
      .mocked(logger.info)
      .mock.calls.find(
        (call) =>
          call[0] === 'APP_SHELL' &&
          typeof call[1] === 'string' &&
          call[2] != null &&
          typeof call[2] === 'object' &&
          (call[2] as { groupId?: string }).groupId === group.id &&
          (call[2] as { mode?: string }).mode === 'copy',
      );
    expect(importStartCall).toBeDefined();
    expect((importStartCall?.[1] as string).length).toBeGreaterThan(0);
  });

  it('should import units in move mode by updating parentId', async () => {
    const group = createGroupChain({ id: 'group-2' });
    const unit = createUnitChain({ id: 'unit-2', parentId: undefined });
    const sibling = createUnitChain({ id: 'unit-3', parentId: undefined });
    const stateRef = createStateContainer(
      createAppState({ chains: [group, unit, sibling] }),
    );
    const safelySaveChains = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useGroupDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        storage: createLocalStorageMock(),
        safelySaveChains,
      }),
    );

    await act(async () => {
      await result.current.handleImportUnits([unit.id], group.id, 'move');
    });

    const updated = safelySaveChains.mock.calls[0]?.[0];
    expect(updated?.find((chain) => chain.id === unit.id)?.parentId).toBe(
      group.id,
    );
    expect(
      updated?.find((chain) => chain.id === sibling.id)?.parentId,
    ).toBeUndefined();
    expect(
      stateRef.getState().chains.find((chain) => chain.id === unit.id)
        ?.parentId,
    ).toBe(group.id);
    expectNonEmptyLogMessages();
  });

  it('should update task repeat count and persist changes', async () => {
    const chain = createUnitChain({ id: 'unit-3', taskRepeatCount: 1 });
    const stateRef = createStateContainer(createAppState({ chains: [chain] }));
    const safelySaveChains = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useGroupDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        storage: createLocalStorageMock(),
        safelySaveChains,
      }),
    );

    await act(async () => {
      await result.current.handleUpdateTaskRepeatCount(chain.id, 5);
    });

    const updated = safelySaveChains.mock.calls[0]?.[0];
    expect(updated?.find((item) => item.id === chain.id)?.taskRepeatCount).toBe(
      5,
    );
    expect(
      stateRef.getState().chains.find((item) => item.id === chain.id)
        ?.taskRepeatCount,
    ).toBe(5);
    expectNonEmptyLogMessages();
  });

  it('should reorder units in a group by swapping sort order', async () => {
    const group = createGroupChain({ id: 'group-3' });
    const a = createUnitChain({ id: 'a', parentId: group.id, sortOrder: 0 });
    const b = createUnitChain({ id: 'b', parentId: group.id, sortOrder: 1 });
    const stateRef = createStateContainer(
      createAppState({ chains: [group, a, b] }),
    );
    const safelySaveChains = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useGroupDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        storage: createLocalStorageMock(),
        safelySaveChains,
      }),
    );

    await act(async () => {
      await result.current.handleReorderUnit(group.id, a.id, 'down');
    });

    const updated = safelySaveChains.mock.calls[0]?.[0];
    expect(updated?.find((item) => item.id === a.id)?.sortOrder).toBe(1);
    expect(updated?.find((item) => item.id === b.id)?.sortOrder).toBe(0);
    expect(
      stateRef.getState().chains.find((item) => item.id === a.id)?.sortOrder,
    ).toBe(1);
    expect(
      stateRef.getState().chains.find((item) => item.id === b.id)?.sortOrder,
    ).toBe(0);
    expectNonEmptyLogMessages();
  });

  it('should reorder units upward by swapping with previous unit', async () => {
    const group = createGroupChain({ id: 'group-up' });
    const a = createUnitChain({
      id: 'up-a',
      parentId: group.id,
      sortOrder: 10,
    });
    const b = createUnitChain({
      id: 'up-b',
      parentId: group.id,
      sortOrder: 20,
    });
    const c = createUnitChain({
      id: 'up-c',
      parentId: group.id,
      sortOrder: 30,
    });
    const stateRef = createStateContainer(
      createAppState({ chains: [group, a, b, c] }),
    );
    const safelySaveChains = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useGroupDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        storage: createLocalStorageMock(),
        safelySaveChains,
      }),
    );

    await act(async () => {
      await result.current.handleReorderUnit(group.id, b.id, 'up');
    });

    const updated = safelySaveChains.mock.calls[0]?.[0];
    expect(updated?.find((item) => item.id === a.id)?.sortOrder).toBe(20);
    expect(updated?.find((item) => item.id === b.id)?.sortOrder).toBe(10);
    expectNonEmptyLogMessages();
  });

  it('should no-op reorder when group is missing, unit is missing, or target index is out of range', async () => {
    const group = createGroupChain({ id: 'group-noop' });
    const a = createUnitChain({
      id: 'noop-a',
      parentId: group.id,
      sortOrder: 0,
    });
    const b = createUnitChain({
      id: 'noop-b',
      parentId: group.id,
      sortOrder: 1,
    });
    const stateRef = createStateContainer(
      createAppState({ chains: [group, a, b] }),
    );
    const safelySaveChains = vi.fn(async () => undefined);

    const { result, rerender } = renderHook(() =>
      useGroupDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        storage: createLocalStorageMock(),
        safelySaveChains,
      }),
    );

    await act(async () => {
      await result.current.handleReorderUnit('missing-group', a.id, 'down');
    });
    expect(safelySaveChains).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleReorderUnit(group.id, 'missing-unit', 'down');
      await result.current.handleReorderUnit(group.id, a.id, 'up');
      await result.current.handleReorderUnit(group.id, b.id, 'down');
    });
    expect(safelySaveChains).not.toHaveBeenCalled();

    rerender();
  });

  it('should recover from save failures by reloading chains and showing error toast', async () => {
    const chain = createUnitChain({ id: 'unit-4', taskRepeatCount: 1 });
    const fallback = [
      createUnitChain({ id: 'fallback-4', taskRepeatCount: 2 }),
    ];
    const stateRef = createStateContainer(createAppState({ chains: [chain] }));
    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => fallback),
    });
    const safelySaveChains = vi.fn(async () => {
      throw new Error('save failed');
    });

    const { result } = renderHook(() =>
      useGroupDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        storage,
        safelySaveChains,
      }),
    );

    await act(async () => {
      await result.current.handleUpdateTaskRepeatCount(chain.id, 3);
    });

    expect(toast.error).toHaveBeenCalled();
    expect(storage.getChains).toHaveBeenCalledTimes(1);
    expect(stateRef.getState().chains).toEqual(fallback);
    expect(logger.error).toHaveBeenCalledWith(
      'APP_SHELL',
      'Failed to update task repeat count',
      undefined,
      expect.any(Error),
    );
    expect(trMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Failed to update repeat count'),
    );
  });

  it('should include safe detail in import failure toast and log reload failure if recovery fails', async () => {
    const group = createGroupChain({ id: 'group-fail' });
    const unit = createUnitChain({ id: 'unit-fail' });
    const stateRef = createStateContainer(
      createAppState({ chains: [group, unit] }),
    );
    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => {
        throw new Error('reload failed');
      }),
    });
    const safelySaveChains = vi.fn(async () => {
      throw new Error('import save failed');
    });
    vi.mocked(getSafeErrorDetailFromUnknown).mockReturnValue(
      'safe import detail',
    );

    const { result } = renderHook(() =>
      useGroupDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        storage,
        safelySaveChains,
      }),
    );

    await act(async () => {
      await result.current.handleImportUnits([unit.id], group.id, 'copy');
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Import failed: safe import detail'),
    );
    expect(logger.error).toHaveBeenCalledWith(
      'APP_SHELL',
      'Failed to import units',
      undefined,
      expect.any(Error),
    );
    expect(logger.error).toHaveBeenCalledWith(
      'APP_SHELL',
      expect.any(String),
      undefined,
      expect.any(Error),
    );
    const importFailureTranslation = vi
      .mocked(trMock)
      .mock.calls.find(
        (call) =>
          typeof call[1] === 'string' &&
          call[1].includes('Import failed: safe import detail'),
      );
    expect(importFailureTranslation?.[0]).toEqual(expect.any(String));
    expect(importFailureTranslation?.[1]).toEqual(
      expect.stringContaining('Import failed: safe import detail'),
    );
  });

  it('should use fallback repeat-count toast when safe detail is unavailable', async () => {
    const chain = createUnitChain({
      id: 'repeat-fallback',
      taskRepeatCount: 1,
    });
    const stateRef = createStateContainer(createAppState({ chains: [chain] }));
    const storage = createLocalStorageMock({
      getChains: vi.fn(async () => []),
    });
    const safelySaveChains = vi.fn(async () => {
      throw new Error('repeat save failed');
    });
    vi.mocked(getSafeErrorDetailFromUnknown).mockReturnValue(null);

    const { result } = renderHook(() =>
      useGroupDomain({
        state: stateRef.getState(),
        setState: stateRef.setState,
        storage,
        safelySaveChains,
      }),
    );

    await act(async () => {
      await result.current.handleUpdateTaskRepeatCount(chain.id, 99);
    });

    expect(toast.error).toHaveBeenCalledWith(
      'Failed to update repeat count. Check the console for details, then try again.',
    );
    expect(trMock).toHaveBeenCalledWith(
      expect.any(String),
      'Failed to update repeat count. Check the console for details, then try again.',
    );
  });
});
