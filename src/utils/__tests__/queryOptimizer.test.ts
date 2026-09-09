/**
 * Query Optimizer Tests - Performance & Functionality
 *
 * Tests the database query optimization layer including:
 * - Query deduplication
 * - Intelligent caching
 * - Batch operations
 * - Chain tree memoization
 * - Performance metrics
 */

import { queryOptimizer } from '../queryOptimizer';
import { Chain, ChainTreeNode } from '../../types';
import { buildChainTree } from '../chainTree';
import { performanceLogger } from '../performanceLogger';
import { reactPerformanceMonitor } from '../reactPerformanceMonitor';

// Mock dependencies
vi.mock('../chainTree');
vi.mock('../performanceLogger');
vi.mock('../reactPerformanceMonitor');

describe('QueryOptimizer', () => {
  beforeEach(() => {
    queryOptimizer.clearCache();
    vi.clearAllMocks();

    // Setup default mocks
    performanceLogger.debug = vi.fn();
    performanceLogger.time = vi.fn((label, fn) => fn());
    performanceLogger.log = vi.fn();
    performanceLogger.group = vi.fn((label, fn) => fn());

    reactPerformanceMonitor.trackCacheHit = vi.fn();
    reactPerformanceMonitor.trackCacheMiss = vi.fn();
    reactPerformanceMonitor.trackTreeBuild = vi.fn();
    reactPerformanceMonitor.generateReport = vi.fn(() => ({
      cacheHitRatio: 0.8,
    }));
  });

  const createMockChain = (id: string, parentId?: string): Chain => ({
    id,
    name: `Chain ${id}`,
    parentId,
    type: 'unit',
    sortOrder: parseInt(id),
    trigger: 'Test',
    duration: 30,
    description: 'Test chain',
    currentStreak: 0,
    auxiliaryStreak: 0,
    totalCompletions: 0,
    totalFailures: 0,
    auxiliaryFailures: 0,
    exceptions: [],
    auxiliaryExceptions: [],
    auxiliarySignal: 'Test',
    auxiliaryDuration: 15,
    auxiliaryCompletionTrigger: 'Test',
    isDurationless: false,
    createdAt: new Date(),
  });

  describe('Query Deduplication', () => {
    test('should deduplicate identical concurrent queries', async () => {
      let callCount = 0;
      const mockQuery = vi.fn(async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return `result-${callCount}`;
      });

      // Execute same query concurrently
      const promises = [
        queryOptimizer.deduplicateQuery('test:query', mockQuery),
        queryOptimizer.deduplicateQuery('test:query', mockQuery),
        queryOptimizer.deduplicateQuery('test:query', mockQuery),
      ];

      const results = await Promise.all(promises);

      // All should return same result
      expect(results).toEqual(['result-1', 'result-1', 'result-1']);
      // Function should only be called once
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    test('should cache results for subsequent queries', async () => {
      const mockQuery = vi.fn(async () => 'cached-result');

      // First call
      const result1 = await queryOptimizer.deduplicateQuery(
        'cache:test',
        mockQuery,
      );
      expect(result1).toBe('cached-result');
      expect(mockQuery).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await queryOptimizer.deduplicateQuery(
        'cache:test',
        mockQuery,
      );
      expect(result2).toBe('cached-result');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    test('should not cache error results', async () => {
      const mockQuery = vi
        .fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce('Success on retry');

      // First call fails
      await expect(
        queryOptimizer.deduplicateQuery('error:test', mockQuery),
      ).rejects.toThrow('First attempt failed');

      // Second call should retry and succeed
      const result = await queryOptimizer.deduplicateQuery(
        'error:test',
        mockQuery,
      );
      expect(result).toBe('Success on retry');
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    test('should handle cache TTL expiration', async () => {
      const mockQuery = vi
        .fn()
        .mockResolvedValueOnce('initial')
        .mockResolvedValueOnce('refreshed');

      // Mock short TTL for testing
      const originalTTL = (queryOptimizer as any).CACHE_TTL;
      (queryOptimizer as any).CACHE_TTL = 1; // 1ms TTL

      const result1 = await queryOptimizer.deduplicateQuery(
        'ttl:test',
        mockQuery,
      );
      expect(result1).toBe('initial');

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 5));

      const result2 = await queryOptimizer.deduplicateQuery(
        'ttl:test',
        mockQuery,
      );
      expect(result2).toBe('refreshed');
      expect(mockQuery).toHaveBeenCalledTimes(2);

      // Restore original TTL
      (queryOptimizer as any).CACHE_TTL = originalTTL;
    });
  });

  describe('Chain Tree Memoization', () => {
    test('should use cached tree for identical chain data', () => {
      const chains = [
        createMockChain('1'),
        createMockChain('2', '1'),
        createMockChain('3', '1'),
      ];

      const mockTree: ChainTreeNode[] = [
        { id: '1', name: 'Chain 1', children: [] } as ChainTreeNode,
      ];
      buildChainTree.mockReturnValue(mockTree);

      // First call
      const result1 = queryOptimizer.memoizedBuildChainTree(chains);
      expect(buildChainTree).toHaveBeenCalledTimes(1);
      expect(result1).toBe(mockTree);

      // Second call with same data should use cache
      const result2 = queryOptimizer.memoizedBuildChainTree(chains);
      expect(buildChainTree).toHaveBeenCalledTimes(1); // Still only called once
      expect(result2).toBe(mockTree);
      expect(reactPerformanceMonitor.trackCacheHit).toHaveBeenCalled();
    });

    test('should use cached tree when revision matches (fast path)', () => {
      const chains1 = [createMockChain('1')];
      const chains2 = chains1;

      const mockTree: ChainTreeNode[] = [
        { id: '1', name: 'Chain 1', children: [] } as ChainTreeNode,
      ];
      buildChainTree.mockReturnValue(mockTree);

      const result1 = queryOptimizer.memoizedBuildChainTree(chains1, 1);
      const result2 = queryOptimizer.memoizedBuildChainTree(chains2, 1);

      expect(result1).toBe(mockTree);
      expect(result2).toBe(mockTree);
      expect(buildChainTree).toHaveBeenCalledTimes(1);
      expect(reactPerformanceMonitor.trackCacheHit).toHaveBeenCalled();
    });

    test('should rebuild tree when revision changes (fast path)', () => {
      const chains = [createMockChain('1')];

      const mockTree1: ChainTreeNode[] = [
        { id: '1', name: 'Chain 1', children: [] } as ChainTreeNode,
      ];
      const mockTree2: ChainTreeNode[] = [
        { id: '1', name: 'Chain 1', children: [] } as ChainTreeNode,
      ];

      buildChainTree
        .mockReturnValueOnce(mockTree1)
        .mockReturnValueOnce(mockTree2);

      const result1 = queryOptimizer.memoizedBuildChainTree(chains, 1);
      const result2 = queryOptimizer.memoizedBuildChainTree(chains, 2);

      expect(result1).toBe(mockTree1);
      expect(result2).toBe(mockTree2);
      expect(buildChainTree).toHaveBeenCalledTimes(2);
      expect(reactPerformanceMonitor.trackCacheMiss).toHaveBeenCalled();
    });

    test('should rebuild tree when chain data changes', () => {
      const chains1 = [createMockChain('1')];
      const chains2 = [
        createMockChain('1'),
        createMockChain('2'), // Added new chain
      ];

      const mockTree1: ChainTreeNode[] = [
        { id: '1', name: 'Chain 1', children: [] } as ChainTreeNode,
      ];
      const mockTree2: ChainTreeNode[] = [
        { id: '1', name: 'Chain 1', children: [] } as ChainTreeNode,
        { id: '2', name: 'Chain 2', children: [] } as ChainTreeNode,
      ];

      buildChainTree
        .mockReturnValueOnce(mockTree1)
        .mockReturnValueOnce(mockTree2);

      // First call
      const result1 = queryOptimizer.memoizedBuildChainTree(chains1);
      expect(result1).toBe(mockTree1);

      // Second call with different data
      const result2 = queryOptimizer.memoizedBuildChainTree(chains2);
      expect(result2).toBe(mockTree2);
      expect(buildChainTree).toHaveBeenCalledTimes(2);
      expect(reactPerformanceMonitor.trackCacheMiss).toHaveBeenCalled();
    });

    test('should detect metadata changes vs structural changes', () => {
      const chains1 = [
        { ...createMockChain('1'), currentStreak: 0, totalCompletions: 0 },
      ];
      const chains2 = [
        { ...createMockChain('1'), currentStreak: 5, totalCompletions: 10 }, // Only metadata changed
      ];

      const mockTree: ChainTreeNode[] = [
        { id: '1', name: 'Chain 1', children: [] } as ChainTreeNode,
      ];
      buildChainTree.mockReturnValue(mockTree);

      // First call
      queryOptimizer.memoizedBuildChainTree(chains1);

      // Second call with metadata changes (should still rebuild for now, but log optimization opportunity)
      queryOptimizer.memoizedBuildChainTree(chains2);

      expect(buildChainTree).toHaveBeenCalledTimes(2);
      expect(performanceLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Structural hash unchanged'),
      );
    });

    test('should track performance metrics for tree building', () => {
      const chains = [createMockChain('1')];
      const mockTree: ChainTreeNode[] = [
        { id: '1', name: 'Chain 1', children: [] } as ChainTreeNode,
      ];

      buildChainTree.mockReturnValue(mockTree);

      // Mock performance.now to control timing
      const mockNow = vi.spyOn(performance, 'now');
      mockNow.mockReturnValueOnce(0).mockReturnValueOnce(50); // 50ms build time

      queryOptimizer.memoizedBuildChainTree(chains);

      expect(reactPerformanceMonitor.trackTreeBuild).toHaveBeenCalledWith(50);
      expect(performanceLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Tree built with 1 root nodes in 50.00ms'),
      );

      mockNow.mockRestore();
    });
  });

  describe('Batch Operations', () => {
    test('should batch load all data efficiently', async () => {
      const mockStorage = {
        getActiveChains: vi.fn().mockResolvedValue([createMockChain('1')]),
        getScheduledSessions: vi.fn().mockResolvedValue([]),
        getActiveSession: vi.fn().mockResolvedValue(null),
        getCompletionHistory: vi.fn().mockResolvedValue([]),
      };

      const result = await queryOptimizer.batchLoadData(mockStorage);

      expect(result).toEqual({
        chains: [expect.objectContaining({ id: '1' })],
        scheduledSessions: [],
        activeSession: null,
        completionHistory: [],
      });

      // All storage methods should be called
      expect(mockStorage.getActiveChains).toHaveBeenCalledTimes(1);
      expect(mockStorage.getScheduledSessions).toHaveBeenCalledTimes(1);
      expect(mockStorage.getActiveSession).toHaveBeenCalledTimes(1);
      expect(mockStorage.getCompletionHistory).toHaveBeenCalledTimes(1);
    });

    test('should deduplicate batch load requests', async () => {
      const mockStorage = {
        getActiveChains: vi.fn().mockResolvedValue([]),
        getScheduledSessions: vi.fn().mockResolvedValue([]),
        getActiveSession: vi.fn().mockResolvedValue(null),
        getCompletionHistory: vi.fn().mockResolvedValue([]),
      };

      // Concurrent batch loads
      const promises = [
        queryOptimizer.batchLoadData(mockStorage),
        queryOptimizer.batchLoadData(mockStorage),
        queryOptimizer.batchLoadData(mockStorage),
      ];

      const results = await Promise.all(promises);

      // All should return same structure
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);

      // Storage methods should only be called once despite multiple requests
      expect(mockStorage.getActiveChains).toHaveBeenCalledTimes(1);
    });

    test('should handle partial failures in batch operations', async () => {
      const mockStorage = {
        getActiveChains: vi.fn().mockResolvedValue([createMockChain('1')]),
        getScheduledSessions: vi
          .fn()
          .mockRejectedValue(new Error('Sessions failed')),
        getActiveSession: vi.fn().mockResolvedValue(null),
        getCompletionHistory: vi.fn().mockResolvedValue([]),
      };

      await expect(queryOptimizer.batchLoadData(mockStorage)).rejects.toThrow(
        'Sessions failed',
      );
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate related caches on data changes', async () => {
      const mockQuery = vi.fn().mockResolvedValue('data');

      // Populate cache with chains data
      await queryOptimizer.deduplicateQuery('chains:getAll', mockQuery);
      expect(mockQuery).toHaveBeenCalledTimes(1);

      // Invalidate chains cache
      queryOptimizer.onDataChange('chains');

      // Next query should refetch
      await queryOptimizer.deduplicateQuery('chains:getAll', mockQuery);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    test('should clear chain tree cache when chains change', () => {
      const chains = [createMockChain('1')];
      const mockTree: ChainTreeNode[] = [
        { id: '1', name: 'Chain 1', children: [] } as ChainTreeNode,
      ];
      buildChainTree.mockReturnValue(mockTree);

      // Build tree
      queryOptimizer.memoizedBuildChainTree(chains);
      expect(buildChainTree).toHaveBeenCalledTimes(1);

      // Invalidate chains
      queryOptimizer.onDataChange('chains');

      // Next build should not use cache
      queryOptimizer.memoizedBuildChainTree(chains);
      expect(buildChainTree).toHaveBeenCalledTimes(2);
    });

    test('should invalidate batched data on any data change', async () => {
      const mockStorage = {
        getActiveChains: vi.fn().mockResolvedValue([]),
        getScheduledSessions: vi.fn().mockResolvedValue([]),
        getActiveSession: vi.fn().mockResolvedValue(null),
        getCompletionHistory: vi.fn().mockResolvedValue([]),
      };

      // First batch load
      await queryOptimizer.batchLoadData(mockStorage);
      expect(mockStorage.getActiveChains).toHaveBeenCalledTimes(1);

      // Invalidate any data type
      queryOptimizer.onDataChange('sessions');

      // Next batch load should refetch
      await queryOptimizer.batchLoadData(mockStorage);
      expect(mockStorage.getActiveChains).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance Monitoring', () => {
    test('should provide cache statistics', () => {
      const stats = queryOptimizer.getCacheStats();
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('pendingQueries');
      expect(stats).toHaveProperty('cacheKeys');
      expect(Array.isArray(stats.cacheKeys)).toBe(true);
    });

    test('should generate comprehensive performance report', () => {
      const report = queryOptimizer.generatePerformanceReport();

      expect(report).toHaveProperty('cache');
      expect(report).toHaveProperty('react');
      expect(report.cache).toHaveProperty('cacheSize');
      expect(report.cache).toHaveProperty('pendingQueries');

      expect(performanceLogger.group).toHaveBeenCalledWith(
        '🔧 Query Optimizer Stats',
        expect.any(Function),
      );
      expect(reactPerformanceMonitor.generateReport).toHaveBeenCalled();
    });

    test('should track performance for optimized queries', async () => {
      const mockQuery = vi.fn().mockResolvedValue('data');

      await queryOptimizer.getOptimizedChains({ getActiveChains: mockQuery });

      expect(performanceLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[QUERY_OPTIMIZER]'),
      );
    });
  });

  describe('Edge Cases & Error Handling', () => {
    test('should handle empty chain arrays gracefully', () => {
      const mockTree: ChainTreeNode[] = [];
      buildChainTree.mockReturnValue(mockTree);

      const result = queryOptimizer.memoizedBuildChainTree([]);
      expect(result).toEqual([]);
      expect(buildChainTree).toHaveBeenCalledWith([]);
    });

    test('should handle circular dependencies in chains', () => {
      const chains = [
        createMockChain('1', '2'), // Parent is 2
        createMockChain('2', '1'), // Parent is 1 (circular)
      ];

      const mockTree: ChainTreeNode[] = [
        { id: '1', name: 'Chain 1', children: [] } as ChainTreeNode,
      ];
      buildChainTree.mockReturnValue(mockTree);

      // Should not crash
      const result = queryOptimizer.memoizedBuildChainTree(chains);
      expect(result).toBe(mockTree);
    });

    test('should handle concurrent cache clears gracefully', async () => {
      const mockQuery = vi.fn().mockResolvedValue('data');

      // Start query
      const queryPromise = queryOptimizer.deduplicateQuery(
        'test:clear',
        mockQuery,
      );

      // Clear cache while query is in progress
      queryOptimizer.clearCache();

      // Query should still complete
      const result = await queryPromise;
      expect(result).toBe('data');
    });

    test('should maintain performance under high load', async () => {
      const mockQuery = vi.fn().mockResolvedValue('data');

      // Simulate high load with many concurrent queries
      const promises = Array.from(
        { length: 100 },
        (_, i) =>
          queryOptimizer.deduplicateQuery(`load:test:${i % 5}`, mockQuery), // 5 unique keys
      );

      const results = await Promise.all(promises);

      // All queries should complete successfully
      expect(results).toHaveLength(100);
      expect(results.every((r) => r === 'data')).toBe(true);

      // Should only make 5 actual queries due to deduplication
      expect(mockQuery).toHaveBeenCalledTimes(5);
    });
  });

  describe('Memory Management', () => {
    test('should properly cleanup expired cache entries', async () => {
      const mockQuery = vi.fn().mockResolvedValue('data');

      // Mock short TTL
      const originalTTL = (queryOptimizer as any).CACHE_TTL;
      (queryOptimizer as any).CACHE_TTL = 1;

      // Add cache entry
      await queryOptimizer.deduplicateQuery('memory:test', mockQuery);
      expect(queryOptimizer.getCacheStats().cacheSize).toBe(1);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 5));

      // Accessing expired entry should remove it from cache
      await queryOptimizer.deduplicateQuery('memory:test', mockQuery);

      // Restore original TTL
      (queryOptimizer as any).CACHE_TTL = originalTTL;
    });

    test('should handle cache clear during active operations', async () => {
      let resolveQuery: (value: string) => void;
      const mockQuery = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveQuery = resolve;
          }),
      );

      // Start long-running query
      const queryPromise = queryOptimizer.deduplicateQuery(
        'slow:query',
        mockQuery,
      );

      // Clear cache while query is pending
      queryOptimizer.clearCache();

      // Complete the query
      resolveQuery!('completed');
      const result = await queryPromise;

      expect(result).toBe('completed');
      expect(queryOptimizer.getCacheStats().pendingQueries).toBe(0);
    });
  });
});
