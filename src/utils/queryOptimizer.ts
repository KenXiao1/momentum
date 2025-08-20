import { Chain, ScheduledSession, ActiveSession, CompletionHistory, ChainTreeNode } from '../types';
import { buildChainTree } from './chainTree';
import { performanceLogger } from './performanceLogger';
import { reactPerformanceMonitor } from './reactPerformanceMonitor';

/**
 * Database Query Optimizer - Reduces redundant calls and implements intelligent caching
 * 
 * Key optimizations:
 * 1. Query deduplication - Prevent multiple identical queries
 * 2. Batch operations - Combine related queries  
 * 3. Memoized chain tree building
 * 4. Intelligent cache invalidation
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  dependencies?: string[];
}

interface BatchedData {
  chains: Chain[];
  scheduledSessions: ScheduledSession[];
  activeSession: ActiveSession | null;
  completionHistory: CompletionHistory[];
}

class QueryOptimizer {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingQueries = new Map<string, Promise<any>>();
  private readonly CACHE_TTL = 30 * 1000; // 30 seconds
  private readonly TREE_CACHE_KEY = 'chainTree';
  private lastChainHash: string = '';
  
  /**
   * Generate hash for chain data to detect changes
   * Enhanced version that considers more granular changes
   */
  private generateChainHash(chains: Chain[]): string {
    // Include more details to detect subtle changes that affect tree structure
    return chains
      .map(c => `${c.id}-${c.parentId || 'ROOT'}-${c.name}-${c.sortOrder}-${c.type}-${c.currentStreak}-${c.totalCompletions}`)
      .sort()
      .join('|');
  }
  
  /**
   * Get cached data if still valid
   */
  private getCachedData<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  /**
   * Cache data with dependencies
   */
  private setCachedData<T>(key: string, data: T, dependencies?: string[]): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      dependencies
    });
  }
  
  /**
   * Invalidate cache entries based on dependencies
   */
  private invalidateCache(dependency: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.dependencies?.includes(dependency)) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Deduplicate identical queries in progress
   */
  async deduplicateQuery<T>(key: string, queryFn: () => Promise<T>): Promise<T> {
    // If query is already pending, return the same promise
    if (this.pendingQueries.has(key)) {
      return this.pendingQueries.get(key)!;
    }
    
    // Check cache first
    const cached = this.getCachedData<T>(key);
    if (cached !== null) {
      performanceLogger.debug(`[QUERY_OPTIMIZER] Cache hit for: ${key}`);
      return cached;
    }
    
    performanceLogger.debug(`[QUERY_OPTIMIZER] Executing fresh query: ${key}`);
    
    // Execute query and store promise
    const promise = queryFn().finally(() => {
      this.pendingQueries.delete(key);
    });
    
    this.pendingQueries.set(key, promise);
    
    try {
      const result = await promise;
      this.setCachedData(key, result, [key.split(':')[0]]); // Use operation type as dependency
      return result;
    } catch (error) {
      // Don't cache errors
      throw error;
    }
  }
  
  /**
   * Advanced optimized chain tree building with intelligent caching
   * Uses multiple layers of optimization for maximum performance
   */
  memoizedBuildChainTree(chains: Chain[]): ChainTreeNode[] {
    const currentHash = this.generateChainHash(chains);
    
    // Level 1: Check if data hasn't changed at all
    if (currentHash === this.lastChainHash) {
      const cached = this.getCachedData<ChainTreeNode[]>(this.TREE_CACHE_KEY);
      if (cached) {
        reactPerformanceMonitor.trackCacheHit();
        performanceLogger.debug('[QUERY_OPTIMIZER] Using cached chain tree (Level 1: No changes)');
        return cached;
      }
    }
    
    // Level 2: Check for structural changes only (for incremental updates in the future)
    const structuralHash = this.generateStructuralHash(chains);
    const cachedStructuralHash = this.getCachedData<string>(`${this.TREE_CACHE_KEY}_structural`);
    
    if (structuralHash === cachedStructuralHash) {
      // Only metadata changed, we could potentially update existing tree nodes
      // For now, we'll rebuild but log this optimization opportunity
      performanceLogger.debug('[QUERY_OPTIMIZER] Structural hash unchanged, could optimize with incremental update');
    }
    
    performanceLogger.debug('[QUERY_OPTIMIZER] Rebuilding chain tree');
    
    // Track cache miss
    reactPerformanceMonitor.trackCacheMiss();
    
    // Enhanced tree building with performance monitoring
    return performanceLogger.time('buildChainTree-full', () => {
      const startTime = performance.now();
      const tree = buildChainTree(chains);
      const buildTime = performance.now() - startTime;
      
      // Track tree build performance
      reactPerformanceMonitor.trackTreeBuild(buildTime);
      
      // Cache both the tree and the structural hash
      this.setCachedData(this.TREE_CACHE_KEY, tree);
      this.setCachedData(`${this.TREE_CACHE_KEY}_structural`, structuralHash);
      this.lastChainHash = currentHash;
      
      // Performance metrics
      performanceLogger.debug(`[QUERY_OPTIMIZER] Tree built with ${tree.length} root nodes in ${buildTime.toFixed(2)}ms`);
      
      return tree;
    });
  }
  
  /**
   * Generate structural hash (ignores metadata like completion counts)
   * Used for detecting when only metadata changed vs structural changes
   */
  private generateStructuralHash(chains: Chain[]): string {
    return chains
      .map(c => `${c.id}-${c.parentId || 'ROOT'}-${c.sortOrder}-${c.type}`)
      .sort()
      .join('|');
  }
  
  /**
   * Batch load all related data in a single optimized operation
   */
  async batchLoadData(storage: any): Promise<BatchedData> {
    const cacheKey = 'batchedData';
    
    return this.deduplicateQuery(cacheKey, async () => {
      performanceLogger.debug('[QUERY_OPTIMIZER] Batch loading data...');
      const startTime = performance.now();
      
      // Execute all queries in parallel for maximum performance
      const [chains, scheduledSessions, activeSession, completionHistory] = await Promise.all([
        storage.getActiveChains(),
        storage.getScheduledSessions(),
        storage.getActiveSession(),
        storage.getCompletionHistory()
      ]);
      
      const endTime = performance.now();
      performanceLogger.debug(`[QUERY_OPTIMIZER] Batch load completed in ${(endTime - startTime).toFixed(2)}ms`);
      
      return {
        chains,
        scheduledSessions,
        activeSession,
        completionHistory
      };
    });
  }
  
  /**
   * Optimized getChains with deduplication
   */
  async getOptimizedChains(storage: any): Promise<Chain[]> {
    return this.deduplicateQuery('chains:getActive', () => storage.getActiveChains());
  }
  
  /**
   * Clear all caches (useful for forced refresh)
   */
  clearCache(): void {
    this.cache.clear();
    this.pendingQueries.clear();
    this.lastChainHash = '';
    performanceLogger.debug('[QUERY_OPTIMIZER] Cache cleared');
  }
  
  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      pendingQueries: this.pendingQueries.size,
      cacheKeys: Array.from(this.cache.keys())
    };
  }
  
  /**
   * Generate performance report combining cache and React metrics
   */
  generatePerformanceReport() {
    const cacheStats = this.getCacheStats();
    const reactStats = reactPerformanceMonitor.generateReport();
    
    performanceLogger.group('🔧 Query Optimizer Stats', () => {
      performanceLogger.log(`  • Active cache entries: ${cacheStats.cacheSize}`);
      performanceLogger.log(`  • Pending queries: ${cacheStats.pendingQueries}`);
      performanceLogger.log(`  • Cache keys: ${cacheStats.cacheKeys.join(', ')}`);
    });
    
    return {
      cache: cacheStats,
      react: reactStats,
    };
  }
  
  /**
   * Invalidate caches when data changes
   */
  onDataChange(dataType: 'chains' | 'sessions' | 'history'): void {
    performanceLogger.debug(`[QUERY_OPTIMIZER] Invalidating caches for: ${dataType}`);
    
    if (dataType === 'chains') {
      this.invalidateCache('chains');
      this.cache.delete(this.TREE_CACHE_KEY);
      this.lastChainHash = '';
    }
    
    this.invalidateCache('batchedData');
  }
}

// Singleton instance for global use
export const queryOptimizer = new QueryOptimizer();

/**
 * React hook for optimized data loading
 */
export const useOptimizedData = (storage: any) => {
  const loadData = async () => {
    return queryOptimizer.batchLoadData(storage);
  };
  
  const invalidateCache = (dataType: 'chains' | 'sessions' | 'history') => {
    queryOptimizer.onDataChange(dataType);
  };
  
  return { loadData, invalidateCache, clearCache: queryOptimizer.clearCache };
};
