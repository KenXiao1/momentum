import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRSIPViewInteractionActions } from '../useRSIPViewInteractionActions';
import {
  createGroup,
  createNode,
  createProps,
  createState,
} from './testHelpers';

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('useRSIPViewInteractionActions violation actions', () => {
  it('shows tolerated group risk and derives descendants from the live tree', () => {
    const root = createNode({ groupId: 'group-1' });
    const child = createNode({ id: 'child', parentId: root.id });
    const grandchild = createNode({ id: 'grandchild', parentId: child.id });
    const unrelated = createNode({ id: 'unrelated' });
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state: createState({
          nodes: [root, child, grandchild, unrelated],
          groups: [createGroup({ faultTolerance: 1 })],
        }),
        props: createProps(vi.fn()),
      }),
    );

    act(() => {
      result.current.openViolationDialog(root);
    });

    expect(result.current.violationDialogNode).toBe(root);
    expect(result.current.violationDescendants).toEqual([child, grandchild]);
    expect(result.current.violationGroupMessage).toBe(
      'Group "Core policies" still has tolerance remaining. This violation will not collapse the whole group.',
    );
  });

  it('shows collapse risk in Chinese and clears all dialog state on close', () => {
    const root = createNode({ groupId: 'group-1' });
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state: createState({
          language: 'zh-CN',
          nodes: [root],
          groups: [createGroup({ title: '核心国策', faultTolerance: 0 })],
        }),
        props: createProps(vi.fn()),
      }),
    );

    act(() => {
      result.current.openViolationDialog(root);
    });

    expect(result.current.violationGroupMessage).toBe(
      '国策组「核心国策」容错已耗尽，本次违反会触发整组崩溃。',
    );

    act(() => {
      result.current.closeViolationDialog();
    });

    expect(result.current.violationDialogNode).toBeNull();
    expect(result.current.violationDescendants).toEqual([]);
    expect(result.current.violationGroupMessage).toBeUndefined();
  });

  it('does not retain an old group message when the next node has no group', () => {
    const grouped = createNode({ groupId: 'group-1' });
    const ungrouped = createNode({ id: 'ungrouped', groupId: undefined });
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state: createState({
          nodes: [grouped, ungrouped],
          groups: [createGroup()],
        }),
        props: createProps(vi.fn()),
      }),
    );

    act(() => {
      result.current.openViolationDialog(grouped);
    });
    expect(result.current.violationGroupMessage).toContain(
      'still has tolerance remaining',
    );

    act(() => {
      result.current.openViolationDialog(ungrouped);
    });

    expect(result.current.violationDialogNode).toBe(ungrouped);
    expect(result.current.violationGroupMessage).toBeUndefined();
  });

  it('passes violation evidence to the domain callback and closes the dialog', async () => {
    const root = createNode();
    const nodes = [root, createNode({ id: 'child', parentId: root.id })];
    const returnedNodes = [createNode({ id: 'replacement' })];
    const onSaveNodes = vi.fn();
    const onMarkViolated = vi.fn(async () => returnedNodes);
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state: createState({ nodes }),
        props: createProps(onSaveNodes, { onMarkViolated }),
      }),
    );

    act(() => {
      result.current.openViolationDialog(root);
    });
    await act(async () => {
      await result.current.handleConfirmViolation({
        reasonCode: 'health',
        repairHint: 'rest and retry',
      });
    });

    expect(onMarkViolated).toHaveBeenCalledWith(root.id, nodes, undefined, {
      reasonCode: 'health',
      repairHint: 'rest and retry',
      collapseReason: 'health',
    });
    expect(onSaveNodes).not.toHaveBeenCalled();
    expect(result.current.violationDialogNode).toBeNull();
  });

  it('does nothing without a selected node', async () => {
    const onSaveNodes = vi.fn();
    const onMarkViolated = vi.fn(async () => []);
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state: createState({ nodes: [createNode()] }),
        props: createProps(onSaveNodes, { onMarkViolated }),
      }),
    );

    await act(async () => {
      await result.current.handleConfirmViolation({ reasonCode: 'missed' });
    });

    expect(onMarkViolated).not.toHaveBeenCalled();
    expect(onSaveNodes).not.toHaveBeenCalled();
  });

  it('keeps the dialog open when violation persistence fails', async () => {
    const root = createNode();
    const failure = new Error('violation storage unavailable');
    const onMarkViolated = vi.fn(async () => Promise.reject(failure));
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state: createState({ nodes: [root] }),
        props: createProps(vi.fn(), { onMarkViolated }),
      }),
    );

    act(() => {
      result.current.openViolationDialog(root);
    });

    await expect(
      result.current.handleConfirmViolation({ reasonCode: 'missed' }),
    ).rejects.toBe(failure);
    expect(result.current.violationDialogNode).toBe(root);
  });

  it('coalesces repeated violation confirmations while the domain is pending', async () => {
    const root = createNode();
    const save = createDeferred();
    const onMarkViolated = vi.fn(async () => {
      await save.promise;
      return [];
    });
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state: createState({ nodes: [root] }),
        props: createProps(vi.fn(), { onMarkViolated }),
      }),
    );

    act(() => result.current.openViolationDialog(root));
    let firstConfirmation!: Promise<void>;
    let duplicateConfirmation!: Promise<void>;
    act(() => {
      firstConfirmation = result.current.handleConfirmViolation({
        reasonCode: 'missed',
      });
      duplicateConfirmation = result.current.handleConfirmViolation({
        reasonCode: 'missed',
      });
    });

    await duplicateConfirmation;
    expect(onMarkViolated).toHaveBeenCalledOnce();
    expect(result.current.violationDialogNode).toBe(root);

    await act(async () => {
      save.resolve();
      await firstConfirmation;
    });

    expect(result.current.violationDialogNode).toBeNull();
  });

  it('does not close a newer violation dialog when an older save completes', async () => {
    const first = createNode();
    const second = createNode({ id: 'second' });
    const save = createDeferred();
    const onSaveNodes = vi.fn(() => save.promise);
    const { result } = renderHook(() =>
      useRSIPViewInteractionActions({
        state: createState({ nodes: [first, second] }),
        props: createProps(onSaveNodes),
      }),
    );

    act(() => result.current.openViolationDialog(first));
    let firstConfirmation!: Promise<void>;
    act(() => {
      firstConfirmation = result.current.handleConfirmViolation({
        reasonCode: 'missed',
      });
    });
    act(() => result.current.openViolationDialog(second));

    await act(async () => {
      save.resolve();
      await firstConfirmation;
    });

    expect(result.current.violationDialogNode).toBe(second);
  });
});
