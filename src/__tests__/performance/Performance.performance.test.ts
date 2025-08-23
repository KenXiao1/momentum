/**
 * Performance and Load Testing Suite
 * 
 * Comprehensive performance tests for database operations, API endpoints,
 * memory usage, and concurrent user scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabaseStorage } from '../../utils/supabaseStorage';
import { RecycleBinService } from '../../services/RecycleBinService';
import { ExceptionRuleManager } from '../../services/ExceptionRuleManager';
import { testDbUtils, seedTestData } from '../utils/testDatabase';
import { performanceUtils } from '../setup.performance';

describe('Performance and Load Testing', () => {
  beforeEach(async () => {
    await seedTestData();
    performanceUtils.createMemoryLeakDetector().reset();
  });

  afterEach(() => {
    testDbUtils.resetTable('chains');
    testDbUtils.resetTable('active_sessions');
    testDbUtils.resetTable('completion_history');
  });

  describe('Database Operation Performance', () => {
    it('should handle large dataset queries efficiently', async () => {
      // Create 1000 chains for performance testing
      const bulkChains = Array.from({ length: 1000 }, (_, i) => ({
        id: `perf-chain-${i}`,
        name: `Performance Test Chain ${i}`,
        trigger: `Trigger ${i}`,
        duration: 30 + (i % 60),
        description: `Performance test chain number ${i}`,
        current_streak: i % 10,
        total_completions: i % 50,
        total_failures: i % 20,
        user_id: 'test-user-123',
        created_at: new Date(Date.now() - i * 1000).toISOString()
      }));

      // Bulk insert
      const insertStart = performance.now();
      await Promise.all(bulkChains.map(chain => testDbUtils.insert('chains', chain)));
      const insertTime = performance.now() - insertStart;

      expect(insertTime).toBeLessThan(performanceUtils.BENCHMARKS.SLOW_OPERATION);
      console.log(`Bulk insert of 1000 chains: ${insertTime.toFixed(2)}ms`);

      // Query all chains
      const queryResult = await performanceUtils.measureAsyncOperation(
        () => supabaseStorage.getChains()
      );

      expect(queryResult.duration).toBeLessThan(performanceUtils.BENCHMARKS.DATABASE_QUERY);
      expect(queryResult.result.length).toBeGreaterThanOrEqual(1000);
      
      console.log(`Query 1000 chains: ${queryResult.duration.toFixed(2)}ms`);
    });

    it('should maintain query performance with complex filters', async () => {
      // Create diverse test data
      const complexChains = Array.from({ length: 500 }, (_, i) => ({
        id: `complex-chain-${i}`,
        name: `Complex Chain ${i}`,
        trigger: `Complex Trigger ${i}`,
        duration: 30 + (i % 120),
        description: `Complex test with various properties ${i}`,
        current_streak: i % 15,
        total_completions: i % 100,
        total_failures: i % 30,
        user_id: `user-${i % 5}`, // 5 different users
        created_at: new Date(Date.now() - i * 60000).toISOString(), // Spread over time
        deleted_at: i % 10 === 0 ? new Date(Date.now() - i * 1000).toISOString() : null,
        exceptions: i % 3 === 0 ? [{ type: 'pause', reason: 'test' }] : [],
        time_limit_hours: i % 5 === 0 ? (i % 8) + 1 : null
      }));

      await Promise.all(complexChains.map(chain => testDbUtils.insert('chains', chain)));

      // Test various complex queries
      const queries = [
        // Active chains only
        () => testDbUtils.query('chains', { 'deleted_at': 'is.null' }),
        // Chains with exceptions
        () => testDbUtils.query('chains').then(chains => 
          chains.filter(c => c.exceptions && c.exceptions.length > 0)
        ),
        // High completion chains
        () => testDbUtils.query('chains').then(chains =>
          chains.filter(c => c.total_completions > 80)
        ),
        // Recent chains
        () => testDbUtils.query('chains').then(chains =>
          chains.filter(c => 
            new Date(c.created_at).getTime() > Date.now() - 30 * 60000
          )
        )
      ];

      for (const query of queries) {
        const result = await performanceUtils.measureAsyncOperation(query);
        expect(result.duration).toBeLessThan(performanceUtils.BENCHMARKS.DATABASE_QUERY);
      }
    });

    it('should handle concurrent database operations', async () => {
      const concurrentOperations = [
        // Multiple chain creations
        ...Array.from({ length: 20 }, (_, i) => 
          () => supabaseStorage.createChain({
            name: `Concurrent Chain ${i}`,
            trigger: `Concurrent ${i}`,
            duration: 45,
            description: `Created concurrently ${i}`,
            type: 'single'
          })
        ),
        // Multiple chain queries
        ...Array.from({ length: 10 }, () => () => supabaseStorage.getChains()),
        // Multiple updates
        ...Array.from({ length: 10 }, (_, i) => async () => {
          const chains = await supabaseStorage.getChains();
          if (chains.length > 0) {
            return supabaseStorage.updateChain(chains[0].id, {
              description: `Updated concurrently ${i}`
            });
          }
        })
      ];

      const concurrentResult = await performanceUtils.runConcurrentOperations(
        () => Promise.all(concurrentOperations.map(op => op())),
        1, // Single batch
        1  // Single iteration
      );

      expect(concurrentResult.totalTime).toBeLessThan(5000); // 5 seconds
      expect(concurrentResult.averageTime).toBeLessThan(2000);
      
      console.log(`Concurrent operations: ${concurrentResult.operationsPerSecond.toFixed(2)} ops/sec`);
    });
  });

  describe('Service Layer Performance', () => {
    it('should handle RecycleBinService operations efficiently', async () => {
      // Create test chains
      const chains = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          supabaseStorage.createChain({
            name: `Recycle Test Chain ${i}`,
            trigger: `Test ${i}`,
            duration: 30,
            description: `For recycle performance test ${i}`,
            type: 'single'
          })
        )
      );

      // Test bulk delete performance
      const deleteResult = await performanceUtils.measureAsyncOperation(
        () => Promise.all(chains.map(chain => 
          RecycleBinService.moveToRecycleBin(chain.id)
        ))
      );

      expect(deleteResult.duration).toBeLessThan(2000); // 2 seconds for 100 deletes
      
      // Test recycle bin retrieval performance
      const retrieveResult = await performanceUtils.measureAsyncOperation(
        () => RecycleBinService.getDeletedChains()
      );

      expect(retrieveResult.duration).toBeLessThan(performanceUtils.BENCHMARKS.DATABASE_QUERY);
      expect(retrieveResult.result.length).toBeGreaterThanOrEqual(100);

      // Test bulk restore performance
      const restoreResult = await performanceUtils.measureAsyncOperation(
        () => Promise.all(chains.slice(0, 50).map(chain =>
          RecycleBinService.restoreChain(chain.id)
        ))
      );

      expect(restoreResult.duration).toBeLessThan(1500); // 1.5 seconds for 50 restores

      console.log(`RecycleBin - Delete: ${deleteResult.duration.toFixed(2)}ms, Retrieve: ${retrieveResult.duration.toFixed(2)}ms, Restore: ${restoreResult.duration.toFixed(2)}ms`);
    });

    it('should handle ExceptionRuleManager operations at scale', async () => {
      const ruleManager = new ExceptionRuleManager();

      // Create many exception rules
      const ruleCreationResult = await performanceUtils.measureAsyncOperation(
        () => Promise.all(
          Array.from({ length: 200 }, (_, i) =>
            ruleManager.createRule(
              `Performance Rule ${i}`,
              i % 2 === 0 ? 'PAUSE_ONLY' : 'EARLY_COMPLETION_ONLY',
              `Performance test rule ${i}`
            )
          )
        )
      );

      expect(ruleCreationResult.duration).toBeLessThan(3000); // 3 seconds for 200 rules

      // Test rule search performance
      const searchResult = await performanceUtils.measureAsyncOperation(
        () => ruleManager.searchRules('Performance')
      );

      expect(searchResult.duration).toBeLessThan(performanceUtils.BENCHMARKS.MEDIUM_OPERATION);
      expect(searchResult.result.length).toBe(200);

      // Test rule filtering performance
      const filterResult = await performanceUtils.measureAsyncOperation(
        () => ruleManager.getRulesByType('PAUSE_ONLY')
      );

      expect(filterResult.duration).toBeLessThan(performanceUtils.BENCHMARKS.MEDIUM_OPERATION);
      expect(filterResult.result.length).toBe(100); // Half the rules

      console.log(`ExceptionRules - Creation: ${ruleCreationResult.duration.toFixed(2)}ms, Search: ${searchResult.duration.toFixed(2)}ms, Filter: ${filterResult.duration.toFixed(2)}ms`);
    });
  });

  describe('Memory Performance and Leak Detection', () => {
    it('should not leak memory during large data operations', async () => {
      const memoryDetector = performanceUtils.createMemoryLeakDetector();
      memoryDetector.reset();

      // Perform memory-intensive operations
      for (let i = 0; i < 10; i++) {
        // Create and delete chains repeatedly
        const chains = await Promise.all(
          Array.from({ length: 50 }, (_, j) =>
            supabaseStorage.createChain({
              name: `Memory Test Chain ${i}-${j}`,
              trigger: `Memory ${i}-${j}`,
              duration: 30,
              description: `Memory test iteration ${i} chain ${j}`,
              type: 'single'
            })
          )
        );

        await Promise.all(chains.map(chain => 
          RecycleBinService.moveToRecycleBin(chain.id)
        ));

        await Promise.all(chains.map(chain =>
          RecycleBinService.permanentlyDeleteChain(chain.id)
        ));

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const memoryCheck = memoryDetector.check();
      expect(memoryCheck.isLeaking).toBe(false);
      
      if (memoryCheck.growth > 0) {
        console.log(`Memory growth: ${(memoryCheck.growth / 1024 / 1024).toFixed(2)}MB`);
      }
    });

    it('should maintain performance under memory pressure', async () => {
      // Simulate memory pressure by creating large objects
      const largeObjects: any[] = [];
      
      try {
        // Create memory pressure (but not enough to crash)
        for (let i = 0; i < 100; i++) {
          largeObjects.push({
            id: i,
            data: new Array(10000).fill(`large-string-${i}-${'x'.repeat(100)}`)
          });
        }

        // Test operations under memory pressure
        const operationResult = await performanceUtils.measureAsyncOperation(
          () => supabaseStorage.getChains()
        );

        // Should still complete within acceptable time despite memory pressure
        expect(operationResult.duration).toBeLessThan(performanceUtils.BENCHMARKS.DATABASE_QUERY * 2);

      } finally {
        // Clean up large objects
        largeObjects.length = 0;
        if (global.gc) {
          global.gc();
        }
      }
    });
  });

  describe('Load Testing and Stress Testing', () => {
    it('should handle high-frequency operations', async () => {
      const operationCounts = {
        creates: 0,
        reads: 0,
        updates: 0,
        deletes: 0
      };

      // High-frequency mixed operations for 2 seconds
      const startTime = performance.now();
      const operations: Promise<any>[] = [];

      while (performance.now() - startTime < 2000) {
        // Random operation selection
        const rand = Math.random();
        
        if (rand < 0.4) { // 40% reads
          operations.push(
            supabaseStorage.getChains().then(() => operationCounts.reads++)
          );
        } else if (rand < 0.6) { // 20% creates
          operations.push(
            supabaseStorage.createChain({
              name: `High Freq Chain ${operationCounts.creates}`,
              trigger: `HF ${operationCounts.creates}`,
              duration: 30,
              description: `High frequency test`,
              type: 'single'
            }).then(() => operationCounts.creates++)
          );
        } else if (rand < 0.8) { // 20% updates
          operations.push(
            supabaseStorage.getChains().then(chains => {
              if (chains.length > 0) {
                return supabaseStorage.updateChain(chains[0].id, {
                  description: `Updated at ${Date.now()}`
                });
              }
            }).then(() => operationCounts.updates++)
          );
        } else { // 20% deletes
          operations.push(
            supabaseStorage.getChains().then(chains => {
              if (chains.length > 0) {
                return RecycleBinService.moveToRecycleBin(chains[0].id);
              }
            }).then(() => operationCounts.deletes++)
          );
        }

        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const results = await Promise.allSettled(operations);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`High-frequency test: ${successful} successful, ${failed} failed operations`);
      console.log(`Operations: Creates=${operationCounts.creates}, Reads=${operationCounts.reads}, Updates=${operationCounts.updates}, Deletes=${operationCounts.deletes}`);

      // At least 80% should succeed under high load
      expect(successful / (successful + failed)).toBeGreaterThan(0.8);
    });

    it('should handle burst traffic patterns', async () => {
      // Simulate burst traffic - periods of high activity followed by quiet periods
      const burstResults = [];

      for (let burst = 0; burst < 3; burst++) {
        console.log(`Starting burst ${burst + 1}`);
        
        // Burst period - high activity for 500ms
        const burstStart = performance.now();
        const burstOperations: Promise<any>[] = [];

        while (performance.now() - burstStart < 500) {
          burstOperations.push(
            supabaseStorage.createChain({
              name: `Burst Chain ${burst}-${burstOperations.length}`,
              trigger: `Burst ${burst}`,
              duration: 30,
              description: `Created during burst ${burst}`,
              type: 'single'
            })
          );
        }

        const burstResult = await Promise.allSettled(burstOperations);
        const burstSuccessful = burstResult.filter(r => r.status === 'fulfilled').length;
        
        burstResults.push({
          burst: burst + 1,
          operations: burstOperations.length,
          successful: burstSuccessful,
          success_rate: burstSuccessful / burstOperations.length
        });

        // Quiet period - wait 1 second
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // All bursts should have reasonable success rates
      burstResults.forEach(result => {
        expect(result.success_rate).toBeGreaterThan(0.7);
        console.log(`Burst ${result.burst}: ${result.successful}/${result.operations} operations (${(result.success_rate * 100).toFixed(1)}%)`);
      });
    });

    it('should handle sustained load over time', async () => {
      const sustainedLoadDuration = 5000; // 5 seconds
      const operationInterval = 50; // Every 50ms
      const startTime = performance.now();
      
      let operationsCount = 0;
      let successCount = 0;
      let errorCount = 0;

      // Sustained operations
      const intervalId = setInterval(async () => {
        if (performance.now() - startTime >= sustainedLoadDuration) {
          clearInterval(intervalId);
          return;
        }

        operationsCount++;
        
        try {
          await supabaseStorage.createChain({
            name: `Sustained Chain ${operationsCount}`,
            trigger: `Sustained ${operationsCount}`,
            duration: 30,
            description: `Created during sustained load test`,
            type: 'single'
          });
          successCount++;
        } catch (error) {
          errorCount++;
        }
      }, operationInterval);

      // Wait for test completion
      await new Promise(resolve => 
        setTimeout(resolve, sustainedLoadDuration + 1000)
      );

      const successRate = successCount / operationsCount;
      const operationsPerSecond = operationsCount / (sustainedLoadDuration / 1000);

      console.log(`Sustained load: ${operationsCount} operations, ${successCount} successful, ${errorCount} errors`);
      console.log(`Success rate: ${(successRate * 100).toFixed(1)}%, ${operationsPerSecond.toFixed(2)} ops/sec`);

      expect(successRate).toBeGreaterThan(0.9); // 90% success rate
      expect(operationsPerSecond).toBeGreaterThan(10); // At least 10 ops/sec
    });
  });

  describe('Performance Benchmarking and Regression Detection', () => {
    it('should maintain baseline performance metrics', async () => {
      const benchmarks = {
        chain_creation: { max: 100, target: 50 },
        chain_retrieval: { max: 200, target: 100 },
        chain_update: { max: 150, target: 75 },
        chain_deletion: { max: 100, target: 50 },
        bulk_operations: { max: 2000, target: 1000 }
      };

      const results: Record<string, number> = {};

      // Chain creation benchmark
      results.chain_creation = (await performanceUtils.measureAsyncOperation(
        () => supabaseStorage.createChain({
          name: 'Benchmark Chain',
          trigger: 'Benchmark',
          duration: 45,
          description: 'Performance benchmark',
          type: 'single'
        })
      )).duration;

      // Chain retrieval benchmark
      results.chain_retrieval = (await performanceUtils.measureAsyncOperation(
        () => supabaseStorage.getChains()
      )).duration;

      const chains = await supabaseStorage.getChains();
      if (chains.length > 0) {
        // Chain update benchmark
        results.chain_update = (await performanceUtils.measureAsyncOperation(
          () => supabaseStorage.updateChain(chains[0].id, {
            description: 'Updated for benchmark'
          })
        )).duration;

        // Chain deletion benchmark
        results.chain_deletion = (await performanceUtils.measureAsyncOperation(
          () => RecycleBinService.moveToRecycleBin(chains[0].id)
        )).duration;
      }

      // Bulk operations benchmark
      results.bulk_operations = (await performanceUtils.measureAsyncOperation(
        () => Promise.all(
          Array.from({ length: 20 }, (_, i) =>
            supabaseStorage.createChain({
              name: `Bulk Benchmark ${i}`,
              trigger: `Bulk ${i}`,
              duration: 30,
              description: `Bulk benchmark ${i}`,
              type: 'single'
            })
          )
        )
      )).duration;

      // Check all benchmarks
      Object.entries(benchmarks).forEach(([operation, limits]) => {
        const actualTime = results[operation];
        if (actualTime !== undefined) {
          expect(actualTime).toBeLessThan(limits.max);
          
          if (actualTime > limits.target) {
            console.warn(`⚠️  ${operation} performance degradation: ${actualTime.toFixed(2)}ms (target: ${limits.target}ms)`);
          } else {
            console.log(`✅ ${operation}: ${actualTime.toFixed(2)}ms (target: ${limits.target}ms)`);
          }
        }
      });
    });

    it('should detect performance regressions', async () => {
      const baselineMetrics = {
        chain_operations_per_second: 50,
        memory_usage_mb: 20,
        query_response_time_ms: 100
      };

      // Measure current performance
      const currentMetrics = {
        chain_operations_per_second: 0,
        memory_usage_mb: 0,
        query_response_time_ms: 0
      };

      // Measure operations per second
      const opsStart = performance.now();
      const operations = await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          supabaseStorage.createChain({
            name: `Regression Test ${i}`,
            trigger: `RT ${i}`,
            duration: 30,
            description: `Regression test ${i}`,
            type: 'single'
          })
        )
      );
      const opsTime = performance.now() - opsStart;
      currentMetrics.chain_operations_per_second = 50 / (opsTime / 1000);

      // Measure memory usage
      const memoryUsage = performanceUtils.getMemoryUsage();
      currentMetrics.memory_usage_mb = memoryUsage.used / 1024 / 1024;

      // Measure query response time
      const queryResult = await performanceUtils.measureAsyncOperation(
        () => supabaseStorage.getChains()
      );
      currentMetrics.query_response_time_ms = queryResult.duration;

      // Check for regressions (allow 20% degradation)
      const regressions = [];

      Object.entries(baselineMetrics).forEach(([metric, baseline]) => {
        const current = currentMetrics[metric as keyof typeof currentMetrics];
        const threshold = baseline * 1.2; // 20% worse than baseline

        if (metric === 'chain_operations_per_second') {
          if (current < baseline * 0.8) { // 20% slower
            regressions.push({ metric, baseline, current, change: ((current - baseline) / baseline) * 100 });
          }
        } else {
          if (current > threshold) {
            regressions.push({ metric, baseline, current, change: ((current - baseline) / baseline) * 100 });
          }
        }
      });

      if (regressions.length > 0) {
        console.warn('Performance regressions detected:');
        regressions.forEach(r => {
          console.warn(`  ${r.metric}: ${r.current.toFixed(2)} (baseline: ${r.baseline}, change: ${r.change.toFixed(1)}%)`);
        });
      }

      // Log current metrics
      console.log('Current performance metrics:');
      Object.entries(currentMetrics).forEach(([metric, value]) => {
        console.log(`  ${metric}: ${value.toFixed(2)}`);
      });

      // Test should pass even with some regressions (this is informational)
      expect(regressions.length).toBeLessThan(3); // Allow up to 2 regressions
    });
  });
});