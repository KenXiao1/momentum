import { describe, expect, it, vi } from 'vitest';
import type { Chain } from '../../../types';
import { createGroupChain, createUnitChain } from '../../../test/factories';

type MockedPerformanceLogger = {
  time: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  debugLazy: ReturnType<typeof vi.fn>;
};

async function loadBuilderWithEnv(isDevValue: boolean): Promise<{
  buildChainTree: (
    chains: Chain[],
  ) => ReturnType<typeof import('../treeBuilder').buildChainTree>;
  performanceLogger: MockedPerformanceLogger;
}> {
  vi.resetModules();

  const performanceLogger: MockedPerformanceLogger = {
    time: vi.fn((_label: string, fn: () => unknown) => fn()),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    debugLazy: vi.fn(),
  };

  vi.doMock('../../env', () => ({
    isDev: isDevValue,
    isProd: !isDevValue,
  }));

  vi.doMock('../../performanceLogger', () => ({
    performanceLogger,
  }));

  const { buildChainTree } = await import('../treeBuilder');
  return { buildChainTree, performanceLogger };
}

describe('chain-tree/treeBuilder', () => {
  it('returns empty and logs error for non-array input', async () => {
    const { buildChainTree, performanceLogger } =
      await loadBuilderWithEnv(false);

    const result = buildChainTree(null as unknown as Chain[]);

    expect(result).toEqual([]);
    expect(performanceLogger.error).toHaveBeenCalledWith(
      expect.stringMatching(/.+/),
    );
  });

  it('returns early for empty input and emits debug marker', async () => {
    const { buildChainTree, performanceLogger } =
      await loadBuilderWithEnv(true);

    const result = buildChainTree([]);

    expect(result).toEqual([]);
    expect(performanceLogger.debug).toHaveBeenCalledWith(
      expect.stringMatching(/.+/),
    );
  });

  it('builds sorted tree structure with correct depth propagation', async () => {
    const { buildChainTree, performanceLogger } =
      await loadBuilderWithEnv(true);
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

    const result = buildChainTree([
      parent,
      otherRoot,
      childA,
      childB,
      grandChild,
    ]);

    expect(result.map((node) => node.id)).toEqual(['g-2', 'g-1']);
    expect(result[1].children.map((node) => node.id)).toEqual(['c-b', 'c-a']);
    expect(result[1].children[0].depth).toBe(1);
    expect(result[1].children[0].children[0].id).toBe('gc');
    expect(result[1].children[0].children[0].depth).toBe(2);
    expect(performanceLogger.warn).not.toHaveBeenCalled();
    expect(performanceLogger.error).not.toHaveBeenCalled();
  });

  it('keeps root nodes without parent warnings when parentId is absent', async () => {
    const { buildChainTree, performanceLogger } =
      await loadBuilderWithEnv(false);
    const root = createUnitChain({ id: 'root-no-parent', parentId: undefined });

    const result = buildChainTree([root]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('root-no-parent');
    expect(performanceLogger.warn).not.toHaveBeenCalled();
  });

  it('logs missing-node errors for two-node circular references', async () => {
    const { buildChainTree, performanceLogger } =
      await loadBuilderWithEnv(false);
    const nodeA = createUnitChain({ id: 'a', parentId: 'b' });
    const nodeB = createUnitChain({ id: 'b', parentId: 'a' });

    const result = buildChainTree([nodeA, nodeB]);

    expect(result).toEqual([]);
    expect(performanceLogger.error).toHaveBeenCalledWith(
      expect.stringMatching(/.+/),
      expect.arrayContaining(['a', 'b']),
    );
  });

  it('emits extra dev diagnostics only when isDev is true', async () => {
    const dev = await loadBuilderWithEnv(true);
    const prodLike = await loadBuilderWithEnv(false);
    const chain = createUnitChain({ id: 'diag-root' });

    dev.buildChainTree([chain]);
    prodLike.buildChainTree([chain]);

    expect(dev.performanceLogger.debugLazy).toHaveBeenCalledTimes(2);
    expect(prodLike.performanceLogger.debugLazy).toHaveBeenCalledTimes(1);
  });

  it('converts self-parent references to root nodes', async () => {
    const { buildChainTree, performanceLogger } =
      await loadBuilderWithEnv(false);
    const selfParent = createUnitChain({
      id: 'self',
      parentId: 'self',
      sortOrder: 1,
    });

    const result = buildChainTree([selfParent]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('self');
    expect(result[0].parentId).toBeUndefined();
    expect(performanceLogger.warn).toHaveBeenCalled();
  });

  it('promotes nodes with missing parents to roots', async () => {
    const { buildChainTree, performanceLogger } =
      await loadBuilderWithEnv(false);
    const orphan = createUnitChain({
      id: 'orphan',
      parentId: 'missing',
      sortOrder: 2,
    });
    const root = createUnitChain({ id: 'root', sortOrder: 1 });

    const result = buildChainTree([orphan, root]);

    expect(result.map((node) => node.id)).toEqual(['root', 'orphan']);
    expect(result[1].parentId).toBeUndefined();
    expect(performanceLogger.warn).toHaveBeenCalled();
  });

  it('logs data integrity warnings for duplicate ids and missing names', async () => {
    const { buildChainTree, performanceLogger } =
      await loadBuilderWithEnv(false);
    const duplicateA = createUnitChain({
      id: 'dup',
      name: 'first',
      sortOrder: 1,
    });
    const duplicateB = createUnitChain({ id: 'dup', name: '', sortOrder: 2 });

    const result = buildChainTree([duplicateA, duplicateB]);

    expect(result).toHaveLength(2);
    expect(performanceLogger.warn).toHaveBeenCalledTimes(1);
    expect(performanceLogger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/.+/),
      expect.arrayContaining([expect.stringContaining('dup')]),
    );
  });

  it('skips malformed chains without ids while keeping valid entries', async () => {
    const { buildChainTree, performanceLogger } =
      await loadBuilderWithEnv(false);
    const valid = createUnitChain({ id: 'valid-id', sortOrder: 1 });
    const malformed = {
      ...createUnitChain({ id: 'placeholder', sortOrder: 2 }),
      id: '',
    } as Chain;

    const result = buildChainTree([valid, malformed]);

    expect(result.map((node) => node.id)).toEqual(['valid-id']);
    expect(performanceLogger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/.+/),
      expect.arrayContaining([expect.stringMatching(/.+/)]),
    );
    expect(performanceLogger.error).toHaveBeenCalledWith(
      expect.stringMatching(/.+/),
      expect.anything(),
    );
  });
});
