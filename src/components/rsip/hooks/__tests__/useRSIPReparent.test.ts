import { createTranslator } from '../../../../i18n/translate';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RSIPNode } from '../../../../types';
import { buildRSIPTree } from '../../../../utils/rsipTree';
import { useRSIPReparent } from '../useRSIPReparent';

type SaveNodes = (nodes: RSIPNode[]) => void | Promise<void>;

function node(overrides: Partial<RSIPNode>): RSIPNode {
  return {
    id: 'node',
    title: 'Node',
    rule: 'Do the thing',
    sortOrder: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createNodes(): RSIPNode[] {
  return [
    node({ id: 'root-a', title: 'Root A', sortOrder: 10 }),
    node({
      id: 'child',
      parentId: 'root-a',
      title: 'Child',
      sortOrder: 20,
    }),
    node({
      id: 'grandchild',
      parentId: 'child',
      title: 'Grandchild',
      sortOrder: 30,
    }),
    node({ id: 'root-b', title: 'Root B', sortOrder: 5 }),
    node({
      id: 'target-child',
      parentId: 'root-b',
      title: 'Target child',
      sortOrder: 15,
    }),
  ];
}

function renderReparent(
  onSaveNodes: SaveNodes = vi.fn(),
  nodes = createNodes(),
) {
  const tree = buildRSIPTree(nodes);
  const nodesById = new Map(nodes.map((item) => [item.id, item]));
  const hook = renderHook(() =>
    useRSIPReparent({
      nodes,
      tree,
      nodesById,
      onSaveNodes,
      t: createTranslator('en'),
    }),
  );

  return { ...hook, nodes };
}

describe('useRSIPReparent', () => {
  it('highlights the hovered node together with its real ancestors and descendants', () => {
    const { result } = renderReparent();

    act(() => result.current.handleHoverStart('child'));

    expect(result.current.hoveredId).toBe('child');
    expect([...result.current.hoveredChainIds].sort()).toEqual([
      'child',
      'grandchild',
      'root-a',
    ]);

    act(() => result.current.handleHoverEnd());

    expect(result.current.hoveredId).toBeNull();
    expect([...result.current.hoveredChainIds]).toEqual([]);
  });

  it('pins a hierarchy until the same node is toggled off', () => {
    const { result } = renderReparent();

    act(() => result.current.togglePinned('root-b'));

    expect(result.current.pinnedId).toBe('root-b');
    expect([...result.current.hoveredChainIds].sort()).toEqual([
      'root-b',
      'target-child',
    ]);

    act(() => result.current.togglePinned('root-b'));

    expect(result.current.pinnedId).toBeNull();
    expect([...result.current.hoveredChainIds]).toEqual([]);
  });

  it('exposes the selected title and every cycle-forming parent while reparenting', () => {
    const { result } = renderReparent();

    act(() => result.current.toggleReparenting('child'));

    expect(result.current.reparentingId).toBe('child');
    expect(result.current.reparentingTitle).toBe('Child');
    expect(result.current.pinnedId).toBe('child');
    expect([...result.current.invalidParentIds].sort()).toEqual([
      'child',
      'grandchild',
    ]);
    expect([...result.current.hoveredChainIds].sort()).toEqual([
      'child',
      'grandchild',
      'root-a',
    ]);
  });

  it('moves a node under a valid parent without mutating unrelated fields or input', () => {
    const onSaveNodes = vi.fn<SaveNodes>();
    const { result, nodes } = renderReparent(onSaveNodes);

    act(() => result.current.toggleReparenting('child'));
    act(() => result.current.commitReparent('child', 'root-b'));

    expect(onSaveNodes).toHaveBeenCalledTimes(1);
    const saved = onSaveNodes.mock.calls[0][0];
    expect(saved).toEqual(
      nodes.map((item) =>
        item.id === 'child' ? { ...item, parentId: 'root-b' } : item,
      ),
    );
    expect(nodes.find((item) => item.id === 'child')?.parentId).toBe('root-a');
    expect(
      buildRSIPTree(saved)
        .find((item) => item.id === 'root-b')
        ?.children.map((item) => item.id),
    ).toEqual(['target-child', 'child']);
    expect(result.current.reparentingId).toBeNull();
    expect(result.current.pinnedId).toBe('child');
    expect(result.current.relationError).toBeNull();
  });

  it('makes a node a root while preserving its sort order', () => {
    const onSaveNodes = vi.fn<SaveNodes>();
    const { result } = renderReparent(onSaveNodes);

    act(() => result.current.commitReparent('child'));

    const saved = onSaveNodes.mock.calls[0][0];
    expect(saved.find((item) => item.id === 'child')).toMatchObject({
      id: 'child',
      parentId: undefined,
      sortOrder: 20,
    });
    expect(buildRSIPTree(saved).map((item) => item.id)).toEqual([
      'root-b',
      'root-a',
      'child',
    ]);
  });

  it('rejects selecting the node itself and keeps the reparent operation active', () => {
    const onSaveNodes = vi.fn<SaveNodes>();
    const { result } = renderReparent(onSaveNodes);

    act(() => result.current.toggleReparenting('child'));
    act(() => result.current.commitReparent('child', 'child'));

    expect(onSaveNodes).not.toHaveBeenCalled();
    expect(result.current.reparentingId).toBe('child');
    expect(result.current.relationError).toBe(
      'Cannot select the node itself as parent.',
    );
  });

  it('rejects moving a node under its descendant', () => {
    const onSaveNodes = vi.fn<SaveNodes>();
    const { result } = renderReparent(onSaveNodes);

    act(() => result.current.toggleReparenting('root-a'));
    act(() => result.current.commitReparent('root-a', 'grandchild'));

    expect(onSaveNodes).not.toHaveBeenCalled();
    expect(result.current.reparentingId).toBe('root-a');
    expect(result.current.relationError).toBe(
      'Cannot move a node under its descendant.',
    );
  });

  it('rejects stale child and parent ids instead of saving a no-op or orphan', () => {
    const onSaveNodes = vi.fn<SaveNodes>();
    const { result } = renderReparent(onSaveNodes);

    act(() => result.current.commitReparent('missing-child', 'root-b'));

    expect(result.current.relationError).toBe(
      'The node to move no longer exists. Refresh and try again.',
    );

    act(() => result.current.commitReparent('child', 'missing-parent'));

    expect(result.current.relationError).toBe(
      'The selected parent no longer exists. Choose another parent.',
    );
    expect(onSaveNodes).not.toHaveBeenCalled();
  });

  it('keeps the operation open and the original nodes unchanged after a synchronous save failure', () => {
    const onSaveNodes = vi.fn<SaveNodes>(() => {
      throw new Error('disk is read-only');
    });
    const { result, nodes } = renderReparent(onSaveNodes);

    act(() => result.current.toggleReparenting('child'));
    act(() => result.current.commitReparent('child', 'root-b'));

    expect(onSaveNodes).toHaveBeenCalledWith(
      nodes.map((item) =>
        item.id === 'child' ? { ...item, parentId: 'root-b' } : item,
      ),
    );
    expect(nodes.find((item) => item.id === 'child')?.parentId).toBe('root-a');
    expect(result.current.reparentingId).toBe('child');
    expect(result.current.relationError).toBe(
      'Could not save the new parent. Try again.',
    );
  });

  it('does not report success until an asynchronous save resolves', async () => {
    let resolveSave: (() => void) | undefined;
    const savePromise = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    const onSaveNodes = vi.fn<SaveNodes>(() => savePromise);
    const { result } = renderReparent(onSaveNodes);

    act(() => result.current.toggleReparenting('child'));
    act(() => result.current.commitReparent('child', 'root-b'));

    expect(result.current.reparentingId).toBe('child');

    await act(async () => {
      resolveSave?.();
      await savePromise;
    });

    expect(result.current.reparentingId).toBeNull();
    expect(result.current.pinnedId).toBe('child');
    expect(result.current.relationError).toBeNull();
  });

  it('does not let an older save completion close a newer reparent operation', async () => {
    let resolveSave: (() => void) | undefined;
    const savePromise = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    const onSaveNodes = vi.fn<SaveNodes>(() => savePromise);
    const { result } = renderReparent(onSaveNodes);

    act(() => result.current.toggleReparenting('child'));
    act(() => result.current.commitReparent('child', 'root-b'));
    act(() => result.current.toggleReparenting('root-b'));

    await act(async () => {
      resolveSave?.();
      await savePromise;
    });

    expect(result.current.reparentingId).toBe('root-b');
    expect(result.current.reparentingTitle).toBe('Root B');
    expect(result.current.pinnedId).toBe('root-b');
    expect(result.current.relationError).toBeNull();
  });

  it('prevents overlapping full-state saves and allows the newer move after the first settles', async () => {
    let resolveFirstSave: (() => void) | undefined;
    const firstSave = new Promise<void>((resolve) => {
      resolveFirstSave = resolve;
    });
    const onSaveNodes = vi
      .fn<SaveNodes>()
      .mockImplementationOnce(() => firstSave)
      .mockImplementationOnce(() => undefined);
    const { result } = renderReparent(onSaveNodes);

    act(() => result.current.toggleReparenting('child'));
    act(() => result.current.commitReparent('child', 'root-b'));
    act(() => result.current.toggleReparenting('target-child'));
    act(() => result.current.commitReparent('target-child', 'root-a'));

    expect(onSaveNodes).toHaveBeenCalledTimes(1);
    expect(result.current.reparentingId).toBe('target-child');
    expect(result.current.relationError).toBe(
      'A previous reparent save is still in progress. Try again when it finishes.',
    );

    await act(async () => {
      resolveFirstSave?.();
      await firstSave;
    });

    expect(result.current.reparentingId).toBe('target-child');
    expect(result.current.relationError).toBeNull();

    act(() => result.current.commitReparent('target-child', 'root-a'));

    expect(onSaveNodes).toHaveBeenCalledTimes(2);
    expect(onSaveNodes.mock.calls[1][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'target-child',
          parentId: 'root-a',
        }),
      ]),
    );
    expect(result.current.reparentingId).toBeNull();
    expect(result.current.pinnedId).toBe('target-child');
  });

  it('does not repin a cancelled node when its old save later resolves', async () => {
    let resolveSave: (() => void) | undefined;
    const savePromise = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    const onSaveNodes = vi.fn<SaveNodes>(() => savePromise);
    const { result } = renderReparent(onSaveNodes);

    act(() => result.current.toggleReparenting('child'));
    act(() => result.current.commitReparent('child', 'root-b'));
    act(() => result.current.cancelReparent());
    act(() => result.current.togglePinned('child'));

    await act(async () => {
      resolveSave?.();
      await savePromise;
    });

    expect(result.current.reparentingId).toBeNull();
    expect(result.current.pinnedId).toBeNull();
    expect(result.current.relationError).toBeNull();
  });

  it('does not surface an old save rejection after the operation is cancelled', async () => {
    let rejectSave: ((error: Error) => void) | undefined;
    const savePromise = new Promise<void>((_resolve, reject) => {
      rejectSave = reject;
    });
    const onSaveNodes = vi.fn<SaveNodes>(() => savePromise);
    const { result } = renderReparent(onSaveNodes);

    act(() => result.current.toggleReparenting('child'));
    act(() => result.current.commitReparent('child', 'root-b'));
    act(() => result.current.cancelReparent());

    await act(async () => {
      rejectSave?.(new Error('late network failure'));
      await savePromise.catch(() => undefined);
    });

    expect(result.current.reparentingId).toBeNull();
    expect(result.current.relationError).toBeNull();
    expect(result.current.pinnedId).toBe('child');
  });

  it('keeps the operation available for retry when an asynchronous save rejects', async () => {
    const onSaveNodes = vi.fn<SaveNodes>(() =>
      Promise.reject(new Error('network unavailable')),
    );
    const { result } = renderReparent(onSaveNodes);

    act(() => result.current.toggleReparenting('child'));
    act(() => result.current.commitReparent('child', 'root-b'));

    await waitFor(() => {
      expect(result.current.relationError).toBe(
        'Could not save the new parent. Try again.',
      );
    });
    expect(result.current.reparentingId).toBe('child');
    expect(result.current.invalidParentIds).toEqual(
      new Set(['child', 'grandchild']),
    );
  });

  it('clears an error and invalid targets when reparenting is cancelled', () => {
    const { result } = renderReparent();

    act(() => result.current.toggleReparenting('child'));
    act(() => result.current.setRelationError('Choose another parent'));
    act(() => result.current.cancelReparent());

    expect(result.current.reparentingId).toBeNull();
    expect(result.current.relationError).toBeNull();
    expect([...result.current.invalidParentIds]).toEqual([]);
    expect(result.current.pinnedId).toBe('child');
  });
});
