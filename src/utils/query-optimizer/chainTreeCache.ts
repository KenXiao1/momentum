import { Chain, ChainTreeNode } from '../../types';
import { buildChainTree } from '../chainTree';
import { performanceLogger } from '../performanceLogger';
import { reactPerformanceMonitor } from '../reactPerformanceMonitor';
import { getCachedData, setCachedData, type CacheMap } from './cache';

export class ChainTreeCache {
  private readonly treeCacheKey = 'chainTree';
  private lastChainHash: string = '';
  private lastChainsRevision: number | null = null;
  private lastChains: Chain[] | null = null;

  constructor(
    private readonly cache: CacheMap,
    private readonly getCacheTtlMs: () => number,
  ) {}

  clear(): void {
    this.cache.delete(this.treeCacheKey);
    this.cache.delete(`${this.treeCacheKey}_structural`);
    this.lastChainHash = '';
    this.lastChainsRevision = null;
    this.lastChains = null;
  }

  memoizedBuildChainTree(chains: Chain[], revision?: number): ChainTreeNode[] {
    if (typeof revision === 'number') {
      const cached = getCachedData<ChainTreeNode[]>(
        this.cache,
        this.getCacheTtlMs(),
        this.treeCacheKey,
      );
      if (
        cached &&
        this.lastChainsRevision === revision &&
        this.lastChains === chains
      ) {
        reactPerformanceMonitor.trackCacheHit();
        performanceLogger.debug(
          '[QUERY_OPTIMIZER] Using cached chain tree (revision match)',
        );
        return cached;
      }

      performanceLogger.debug(
        '[QUERY_OPTIMIZER] Rebuilding chain tree (revision changed or cache expired)',
      );
      reactPerformanceMonitor.trackCacheMiss();

      return this.buildChainTreeWithMonitoring(chains, (tree) => {
        setCachedData(this.cache, this.treeCacheKey, tree);
        this.lastChainsRevision = revision;
        this.lastChains = chains;
        this.lastChainHash = '';
      });
    }

    const currentHash = this.generateChainHash(chains);

    if (currentHash === this.lastChainHash && this.lastChains === chains) {
      const cached = getCachedData<ChainTreeNode[]>(
        this.cache,
        this.getCacheTtlMs(),
        this.treeCacheKey,
      );
      if (cached) {
        reactPerformanceMonitor.trackCacheHit();
        performanceLogger.debug(
          '[QUERY_OPTIMIZER] Using cached chain tree (hash match)',
        );
        return cached;
      }
    }

    const structuralHash = this.generateStructuralHash(chains);
    const cachedStructuralHash = getCachedData<string>(
      this.cache,
      this.getCacheTtlMs(),
      `${this.treeCacheKey}_structural`,
    );

    if (structuralHash === cachedStructuralHash) {
      performanceLogger.debug(
        '[QUERY_OPTIMIZER] Structural hash unchanged, could optimize with incremental update',
      );
    }

    performanceLogger.debug(
      '[QUERY_OPTIMIZER] Rebuilding chain tree (hash path)',
    );
    reactPerformanceMonitor.trackCacheMiss();

    return this.buildChainTreeWithMonitoring(chains, (tree) => {
      setCachedData(this.cache, this.treeCacheKey, tree);
      setCachedData(
        this.cache,
        `${this.treeCacheKey}_structural`,
        structuralHash,
      );
      this.lastChainHash = currentHash;
      this.lastChainsRevision = null;
      this.lastChains = chains;
    });
  }

  private buildChainTreeWithMonitoring(
    chains: Chain[],
    onCache: (tree: ChainTreeNode[]) => void,
  ): ChainTreeNode[] {
    return performanceLogger.time('buildChainTree-full', () => {
      const startTime = performance.now();
      const tree = buildChainTree(chains);
      const buildTime = performance.now() - startTime;

      reactPerformanceMonitor.trackTreeBuild(buildTime);
      onCache(tree);

      performanceLogger.debug(
        `[QUERY_OPTIMIZER] Tree built with ${tree.length} root nodes in ${buildTime.toFixed(2)}ms`,
      );

      return tree;
    });
  }

  private generateChainHash(chains: Chain[]): string {
    return chains
      .map(
        (c) =>
          `${c.id}-${c.parentId || 'ROOT'}-${c.name}-${c.sortOrder}-${c.type}-${c.currentStreak}-${c.totalCompletions}`,
      )
      .sort()
      .join('|');
  }

  private generateStructuralHash(chains: Chain[]): string {
    return chains
      .map((c) => `${c.id}-${c.parentId || 'ROOT'}-${c.sortOrder}-${c.type}`)
      .sort()
      .join('|');
  }
}
