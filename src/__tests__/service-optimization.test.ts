/**
 * 服务层优化验证测试
 */

import { describe, it, expect } from 'vitest';

// Test that we can import the optimized services
describe('Service Layer Optimization Tests', () => {
  it('should be able to import OptimizedRecycleBinService', async () => {
    const module = await import('../services/OptimizedRecycleBinService');
    expect(module.optimizedRecycleBinService).toBeDefined();
    expect(module.RecycleBinServiceOptimized).toBeDefined();
  });

  it('should be able to import BatchOperationsManager', async () => {
    const module = await import('../utils/BatchOperationsManager');
    expect(module.BatchOperationsManager).toBeDefined();
    const batchManager = module.BatchOperationsManager.getInstance();
    expect(typeof batchManager.addOperation).toBe('function');
    expect(typeof batchManager.getQueueStatus).toBe('function');
    expect(typeof batchManager.getMetrics).toBe('function');
  });

  it('should be able to import MemoryOptimizer', async () => {
    const module = await import('../utils/memoryOptimizer');
    expect(module.MemoryOptimizer).toBeDefined();
    expect(module.memoryOptimizer).toBeDefined();
    const memoryOpt = module.MemoryOptimizer.getInstance();
    expect(typeof memoryOpt.getCurrentMemoryStats).toBe('function');
    expect(typeof memoryOpt.getMemoryReport).toBe('function');
  });

  it('should be able to import ResourceManager', async () => {
    const module = await import('../utils/resourceManager');
    expect(module.ResourceManager).toBeDefined();
    expect(module.resourceManager).toBeDefined();
    const resMgr = module.ResourceManager.getInstance();
    expect(typeof resMgr.createManagedRequest).toBe('function');
    expect(typeof resMgr.getResourceMetrics).toBe('function');
  });

  it('should be able to import ResponseTimeMonitor', async () => {
    const module = await import('../utils/responseTimeMonitor');
    expect(module.ResponseTimeMonitor).toBeDefined();
    expect(module.responseTimeMonitor).toBeDefined();
    const monitor = module.ResponseTimeMonitor.getInstance();
    expect(typeof monitor.measureAPIRequest).toBe('function');
    expect(typeof monitor.generatePerformanceReport).toBe('function');
  });

  it('should be able to import LazyLoadingManager', async () => {
    const module = await import('../utils/LazyLoadingManager');
    expect(module.LazyLoadingManager).toBeDefined();
    const lazyLoader = module.LazyLoadingManager.getInstance();
    expect(typeof lazyLoader.preloadItem).toBe('function');
    expect(typeof lazyLoader.schedulePreload).toBe('function');
    expect(typeof lazyLoader.getStats).toBe('function');
    expect(typeof lazyLoader.startPredictivePreload).toBe('function');
  });

  it('should be able to import ServiceOrchestrator', async () => {
    const module = await import('../services/ServiceOrchestrator');
    expect(module.serviceOrchestrator).toBeDefined();
  });

  it('should be able to import BusinessLogicManager', async () => {
    const module = await import('../services/BusinessLogicManager');
    expect(module.businessLogicManager).toBeDefined();
  });

  it('should be able to import HighPerformanceDataAccess', async () => {
    const module = await import('../utils/highPerformanceDataAccess');
    expect(module.highPerformanceDataAccess).toBeDefined();
    expect(module.supabaseStorage).toBeDefined(); // Backward compatibility
  });

  it('should be able to import SmartCacheSystem', async () => {
    const module = await import('../utils/smartCacheSystem');
    expect(module.smartCache).toBeDefined();
  });

  it('should provide backward compatibility', async () => {
    // Test that the new high-performance data access is available as supabaseStorage
    const { supabaseStorage } = await import('../utils/highPerformanceDataAccess');
    expect(supabaseStorage).toBeDefined();
    expect(typeof supabaseStorage.getChains).toBe('function');
    expect(typeof supabaseStorage.createChain).toBe('function');
    expect(typeof supabaseStorage.getPerformanceMetrics).toBe('function');
  });

  it('should have performance monitoring capabilities', async () => {
    const { optimizedRecycleBinService } = await import('../services/OptimizedRecycleBinService');
    const { serviceOrchestrator } = await import('../services/ServiceOrchestrator');
    const { businessLogicManager } = await import('../services/BusinessLogicManager');
    const { highPerformanceDataAccess } = await import('../utils/highPerformanceDataAccess');
    const { smartCache } = await import('../utils/smartCacheSystem');

    // All services should have performance monitoring methods
    expect(typeof optimizedRecycleBinService.getPerformanceMetrics).toBe('function');
    expect(typeof highPerformanceDataAccess.getPerformanceMetrics).toBe('function');
    expect(typeof smartCache.getMetrics).toBe('function');
    expect(typeof businessLogicManager.getBusinessRuleStats).toBe('function');
  });

  it('should have comprehensive optimization capabilities', async () => {
    // Test all optimization systems are available
    const { highPerformanceDataAccess } = await import('../utils/highPerformanceDataAccess');
    const { smartCache } = await import('../utils/smartCacheSystem');
    const { BatchOperationsManager } = await import('../utils/BatchOperationsManager');
    const { LazyLoadingManager } = await import('../utils/LazyLoadingManager');
    const { memoryOptimizer } = await import('../utils/memoryOptimizer');
    const { resourceManager } = await import('../utils/resourceManager');
    const { responseTimeMonitor } = await import('../utils/responseTimeMonitor');
    
    // Verify all optimization systems have proper interfaces
    expect(typeof highPerformanceDataAccess.getPerformanceMetrics).toBe('function');
    expect(typeof smartCache.getMetrics).toBe('function');
    expect(typeof BatchOperationsManager.getInstance().getMetrics).toBe('function');
    expect(typeof LazyLoadingManager.getInstance().getStats).toBe('function');
    expect(typeof memoryOptimizer.getMemoryReport).toBe('function');
    expect(typeof resourceManager.getResourceReport).toBe('function');
    expect(typeof responseTimeMonitor.getLatestReport).toBe('function');
  });

  it('should have integrated batch and lazy loading capabilities', async () => {
    const { serviceOrchestrator } = await import('../services/ServiceOrchestrator');
    
    // Test integrated batch processing functionality
    expect(typeof serviceOrchestrator.executeBatchOperations).toBe('function');
    
    // Test integrated intelligent preloading functionality
    expect(typeof serviceOrchestrator.intelligentPreloadUserData).toBe('function');
    
    // Test comprehensive health status functionality
    expect(typeof serviceOrchestrator.getComprehensiveHealthStatus).toBe('function');
  });

  it('should have proper method signatures for core operations', async () => {
    const { optimizedRecycleBinService } = await import('../services/OptimizedRecycleBinService');

    // Test method signatures exist
    expect(typeof optimizedRecycleBinService.getDeletedChains).toBe('function');
    expect(typeof optimizedRecycleBinService.moveToRecycleBin).toBe('function');
    expect(typeof optimizedRecycleBinService.restoreChain).toBe('function');
    expect(typeof optimizedRecycleBinService.bulkRestore).toBe('function');
    expect(typeof optimizedRecycleBinService.bulkPermanentDelete).toBe('function');
    expect(typeof optimizedRecycleBinService.getRecycleBinStats).toBe('function');
    expect(typeof optimizedRecycleBinService.getHealthStatus).toBe('function');
  });
});