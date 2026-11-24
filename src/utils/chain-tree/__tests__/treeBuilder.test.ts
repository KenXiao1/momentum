import { describe, expect, it } from 'vitest';
import type { Chain } from '../../../types';
import { createGroupChain, createUnitChain } from '../../../test/factories';
import { buildChainTree } from '../treeBuilder';

describe('chain-tree/treeBuilder', () => {
  it('sorts roots and nested children by sortOrder', () => {
    const parent = createGroupChain({ id: 'g-1', sortOrder: 2 });
    const otherRoot = createGroupChain({ id: 'g-2', sortOrder: 1 });
    const childA = createUnitChain({
      id: 'c-a',
      parentId: 'g-1',
      sortOrder: 2,
    });
    const childB = createUnitChain({
      id: 'c-b',
      parentId: 'g-1',
      sortOrder: 1,
    });
    const grandChild = createUnitChain({
      id: 'gc',
      parentId: 'c-b',
      sortOrder: 1,
    });

    // Children listed before their parents must still be attached.
    const result = buildChainTree([
      grandChild,
      childA,
      childB,
      parent,
      otherRoot,
    ]);

    expect(result.map((node) => node.id)).toEqual(['g-2', 'g-1']);
    expect(result[1].children.map((node) => node.id)).toEqual(['c-b', 'c-a']);
    expect(result[1].children[0].children.map((node) => node.id)).toEqual([
      'gc',
    ]);
  });

  it('converts self-parent references to root nodes', () => {
    const selfParent = createUnitChain({ id: 'self', parentId: 'self' });

    const result = buildChainTree([selfParent]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('self');
    expect(result[0].parentId).toBeUndefined();
  });

  it('promotes nodes with missing parents to roots', () => {
    const orphan = createUnitChain({
      id: 'orphan',
      parentId: 'missing',
      sortOrder: 2,
    });
    const root = createUnitChain({ id: 'root', sortOrder: 1 });

    const result = buildChainTree([orphan, root]);

    expect(result.map((node) => node.id)).toEqual(['root', 'orphan']);
    expect(result[1].parentId).toBeUndefined();
  });

  it('leaves members of a multi-node parent cycle out of the tree', () => {
    const nodeA = createUnitChain({ id: 'a', parentId: 'b' });
    const nodeB = createUnitChain({ id: 'b', parentId: 'a' });

    expect(buildChainTree([nodeA, nodeB])).toEqual([]);
  });

  it('skips records without ids and does not mutate the input chains', () => {
    const valid = createUnitChain({ id: 'valid-id', parentId: 'missing' });
    const malformed = {
      ...createUnitChain({ id: 'placeholder' }),
      id: '',
    } as Chain;

    const result = buildChainTree([valid, malformed]);

    expect(result.map((node) => node.id)).toEqual(['valid-id']);
    expect(valid.parentId).toBe('missing');
  });
});
