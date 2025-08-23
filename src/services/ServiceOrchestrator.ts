/**
 * 高性能服务层编排器
 * 
 * 统一管理所有业务服务，实现：
 * - 服务间协调和批处理
 * - 智能资源管理
 * - 跨服务缓存策略
 * - 统一性能监控
 * - 业务逻辑优化
 */

import { highPerformanceDataAccess } from '../utils/highPerformanceDataAccess';
import { smartCache } from '../utils/smartCacheSystem';
import { optimizedRecycleBinService } from './OptimizedRecycleBinService';
import { BatchOperationsManager } from '../utils/BatchOperationsManager';
import { LazyLoadingManager } from '../utils/LazyLoadingManager';
import { logger } from '../utils/logger';
import { Chain, DeletedChain, ActiveSession, CompletionHistory } from '../types';

interface ServiceOrchestrationConfig {
  enableBatchProcessing: boolean;
  enableCrossServiceCaching: boolean;
  enablePreloadingStrategies: boolean;
  maxConcurrentOperations: number;
  batchTimeout: number;
}

interface PerformanceSnapshot {
  timestamp: Date;
  totalOperations: number;
  averageResponseTime: number;
  cacheEfficiency: number;
  memoryUsage: number;
  activeServices: string[];
}

interface ServiceHealth {
  serviceName: string;
  status: 'healthy' | 'warning' | 'error';
  responseTime: number;
  errorRate: number;
  lastActivity: Date;
  issues: string[];
}

interface BatchOperationRequest {
  id: string;
  service: string;
  operation: string;
  parameters: any;
  priority: 'low' | 'normal' | 'high' | 'critical';
  timeout?: number;
}

interface BatchOperationResult {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
}

class ServiceOrchestrator {
  private static instance: ServiceOrchestrator;
  private config: ServiceOrchestrationConfig;
  private performanceHistory: PerformanceSnapshot[] = [];
  private batchQueue: BatchOperationRequest[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private serviceHealthCache = new Map<string, ServiceHealth>();
  private batchOperations: BatchOperationsManager;
  private lazyLoader: LazyLoadingManager;

  private constructor() {
    this.config = {
      enableBatchProcessing: true,
      enableCrossServiceCaching: true,
      enablePreloadingStrategies: true,
      maxConcurrentOperations: 10,
      batchTimeout: 100 // ms
    };
    
    // 初始化批处理和懒加载管理器
    this.batchOperations = BatchOperationsManager.getInstance();
    this.lazyLoader = LazyLoadingManager.getInstance();
    
    this.initializePerformanceMonitoring();
  }

  static getInstance(): ServiceOrchestrator {
    if (!this.instance) {
      this.instance = new ServiceOrchestrator();
    }
    return this.instance;
  }

  /**
   * 初始化性能监控
   */
  private initializePerformanceMonitoring(): void {
    // 每分钟记录性能快照
    setInterval(() => {
      this.capturePerformanceSnapshot();
    }, 60000);

    // 每5分钟清理过期的性能历史
    setInterval(() => {
      this.cleanupPerformanceHistory();
    }, 5 * 60000);
  }

  /**
   * 智能预加载用户数据
   * 使用LazyLoadingManager进行智能预加载和预测性加载
   */
  async intelligentPreloadUserData(userId: string, context?: 'app_start' | 'user_action' | 'background'): Promise<void> {
    if (!this.config.enablePreloadingStrategies) return;

    try {
      const preloadStartTime = performance.now();
      
      // 使用懒加载管理器进行智能预加载
      const preloadItems = [
        { 
          key: `chains:${userId}`, 
          loader: () => highPerformanceDataAccess.getChains(userId, { includeStats: true, limit: 50 }), 
          priority: 'high' as const 
        },
        { 
          key: `sessions:${userId}`, 
          loader: () => highPerformanceDataAccess.getActiveSessions(userId), 
          priority: 'medium' as const 
        }
      ];
      
      // 根据上下文添加更多预加载项
      if (context === 'app_start') {
        preloadItems.push(
          { 
            key: `recycle:${userId}`, 
            loader: () => optimizedRecycleBinService.getDeletedChains(), 
            priority: 'low' as const 
          },
          { 
            key: `completions:${userId}`, 
            loader: () => this.getRecentCompletionHistory(userId, 10), 
            priority: 'low' as const 
          }
        );
      }
      
      // 执行预加载
      for (const item of preloadItems) {
        if (context === 'app_start' || item.priority === 'high') {
          await this.lazyLoader.preloadItem(item.key, item.loader, { priority: item.priority });
        } else {
          this.lazyLoader.schedulePreload(item.key, item.loader, { priority: item.priority });
        }
      }
      
      // 启动预测性预加载
      if (context !== 'background') {
        this.lazyLoader.startPredictivePreload();
      }

      const preloadTime = performance.now() - preloadStartTime;
      logger.info(`[ServiceOrchestrator] 智能预加载完成`, {
        userId,
        context,
        preloadTime: preloadTime.toFixed(2) + 'ms',
        itemCount: preloadItems.length
      });

    } catch (error) {
      logger.error('[ServiceOrchestrator] 智能预加载失败:', error);
    }
  }

  /**
   * 基于模式的预测性预加载
   */
  private async predictivePreloadBasedOnPatterns(userId: string): Promise<void> {
    try {
      // 分析用户的访问模式（这里简化实现）
      const userPatterns = await this.analyzeUserAccessPatterns(userId);
      
      if (userPatterns.frequentlyAccessesRecycleBin) {
        setTimeout(() => {
          optimizedRecycleBinService.getDeletedChains();
        }, 500);
      }

      if (userPatterns.oftenViewsCompletionHistory) {
        setTimeout(() => {
          this.getRecentCompletionHistory(userId, 20);
        }, 1000);
      }

      if (userPatterns.activeSessionUser) {
        // 对于活跃用户，预加载更多会话相关数据
        setTimeout(() => {
          highPerformanceDataAccess.getActiveSessions(userId);
        }, 1500);
      }

    } catch (error) {
      logger.error('[ServiceOrchestrator] 预测性预加载失败:', error);
    }
  }

  /**
   * 优化的批量操作管理
   * 使用BatchOperationsManager处理批量操作
   */
  async executeBatchOperations<T>(operations: Array<{
    type: 'create' | 'read' | 'update' | 'delete';
    resource: string;
    data?: any;
    conditions?: any;
    priority?: 'low' | 'normal' | 'high' | 'critical';
  }>): Promise<Array<{ success: boolean; result?: T; error?: string }>> {
    const batchStartTime = performance.now();
    
    try {
      const batchPromises = operations.map(async (op, index) => {
        const result = await this.batchOperations.addOperation<T>(
          op.type,
          op.resource,
          op.data,
          op.conditions,
          {
            priority: op.priority || 'normal',
            timeout: 30000,
            retryCount: 2
          }
        );
        return { success: true, result, originalIndex: index };
      });
      
      const results = await Promise.allSettled(batchPromises);
      const processedResults = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return { success: true, result: result.value.result };
        } else {
          return { success: false, error: result.reason?.message || 'Operation failed' };
        }
      });
      
      const batchTime = performance.now() - batchStartTime;
      logger.info(`[ServiceOrchestrator] 批量操作完成`, {
        operationCount: operations.length,
        batchTime: batchTime.toFixed(2) + 'ms',
        successCount: processedResults.filter(r => r.success).length
      });
      
      return processedResults;
    } catch (error) {
      logger.error('[ServiceOrchestrator] 批量操作失败:', error);
      return operations.map(() => ({ success: false, error: 'Batch operation failed' }));
    }
  }

  /**
   * 获取综合健康状态
   * 包含所有子系统的健康信息
   */
  async getComprehensiveHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'error';
    services: Record<string, any>;
    metrics: {
      performance: any;
      cache: any;
      batch: any;
      lazyLoading: any;
    };
    recommendations: string[];
  }> {
    const serviceHealth = await this.getServiceHealth();
    const batchStatus = this.batchOperations.getQueueStatus();
    const lazyLoadingStats = this.lazyLoader.getStats();
    const cacheMetrics = smartCache.getMetrics();
    
    // 计算综合健康状态
    let overallStatus: 'healthy' | 'warning' | 'error' = 'healthy';
    const recommendations: string[] = [];
    
    // 检查各服务状态
    const errorServices = serviceHealth.filter(s => s.status === 'error');
    const warningServices = serviceHealth.filter(s => s.status === 'warning');
    
    if (errorServices.length > 0) {
      overallStatus = 'error';
      recommendations.push(`有 ${errorServices.length} 个服务处于错误状态`);
    } else if (warningServices.length > 0) {
      overallStatus = 'warning';
      recommendations.push(`有 ${warningServices.length} 个服务需要关注`);
    }
    
    // 检查批处理队列状态
    if (!batchStatus.isHealthy) {
      if (overallStatus === 'healthy') overallStatus = 'warning';
      recommendations.push('批处理队列存在积压，建议检查处理能力');
    }
    
    // 检查懒加载性能
    if (!lazyLoadingStats.isHealthy) {
      if (overallStatus === 'healthy') overallStatus = 'warning';
      recommendations.push('懒加载性能下降，建议优化预加载策略');
    }
    
    // 检查缓存性能
    const hitRate = parseFloat(cacheMetrics.hitRate.replace('%', ''));
    if (hitRate < 70) {
      if (overallStatus === 'healthy') overallStatus = 'warning';
      recommendations.push(`缓存命中率较低 (${cacheMetrics.hitRate})，建议优化缓存策略`);
    }
    
    return {
      status: overallStatus,
      services: {
        dataAccess: 'active',
        recycleBin: 'active',
        caching: 'active',
        batchOperations: batchStatus.isHealthy ? 'active' : 'degraded',
        lazyLoading: lazyLoadingStats.isHealthy ? 'active' : 'degraded'
      },
      metrics: {
        performance: this.getPerformanceReport(),
        cache: cacheMetrics,
        batch: this.batchOperations.getMetrics(),
        lazyLoading: lazyLoadingStats
      },
      recommendations
    };
  }

  /**
   * 分析用户访问模式
   */
  private async analyzeUserAccessPatterns(userId: string): Promise<{
    frequentlyAccessesRecycleBin: boolean;
    oftenViewsCompletionHistory: boolean;
    activeSessionUser: boolean;
  }> {
    try {
      // 从缓存中获取用户行为数据
      const cacheKey = `user_patterns:${userId}`;
      const cached = await smartCache.get<any>(cacheKey);
      
      if (cached) {
        return cached;
      }

      // 简化的模式分析（实际项目中可能需要更复杂的分析）
      const patterns = {
        frequentlyAccessesRecycleBin: Math.random() > 0.7, // 示例逻辑
        oftenViewsCompletionHistory: Math.random() > 0.6,
        activeSessionUser: Math.random() > 0.5
      };

      // 缓存分析结果
      await smartCache.set(cacheKey, patterns, {
        ttl: 30 * 60 * 1000, // 30分钟
        priority: 'low',
        tags: [`user:${userId}`, 'patterns']
      });

      return patterns;
    } catch (error) {
      // 默认模式
      return {
        frequentlyAccessesRecycleBin: false,
        oftenViewsCompletionHistory: false,
        activeSessionUser: false
      };
    }
  }

  /**
   * 优化的最近完成历史获取
   */
  async getRecentCompletionHistory(userId: string, limit: number = 20): Promise<CompletionHistory[]> {
    const cacheKey = `recent_completions:${userId}:${limit}`;
    
    try {
      return await smartCache.get(cacheKey, async () => {
        // 这里需要实现具体的完成历史获取逻辑
        // 由于原始代码中没有直接的方法，我们创建一个占位符
        return []; // 实际实现时需要调用相应的数据访问方法
      }, {
        ttl: 2 * 60 * 1000, // 2分钟缓存
        priority: 'normal',
        tags: [`user:${userId}`, 'completions']
      }) || [];
    } catch (error) {
      logger.error('[ServiceOrchestrator] 获取完成历史失败:', error);
      return [];
    }
  }

  /**
   * 批处理操作管理
   */
  async addToBatch(request: BatchOperationRequest): Promise<Promise<BatchOperationResult>> {
    return new Promise((resolve) => {
      // 为请求添加解析器
      (request as any).resolve = resolve;
      
      this.batchQueue.push(request);
      
      // 启动批处理定时器
      if (!this.batchTimer && this.config.enableBatchProcessing) {
        this.batchTimer = setTimeout(() => {
          this.processBatch();
        }, this.config.batchTimeout);
      }
    });
  }

  /**
   * 处理批量操作
   */
  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) {
      this.batchTimer = null;
      return;
    }

    const batch = [...this.batchQueue];
    this.batchQueue = [];
    this.batchTimer = null;

    const batchStartTime = performance.now();
    
    try {
      // 按优先级和服务类型分组
      const groupedRequests = this.groupBatchRequests(batch);
      
      // 并行处理不同服务的批次
      const processingPromises = Array.from(groupedRequests.entries()).map(
        async ([serviceType, requests]) => {
          return this.processServiceBatch(serviceType, requests);
        }
      );

      await Promise.all(processingPromises);

      const processingTime = performance.now() - batchStartTime;
      logger.info(`[ServiceOrchestrator] 批处理完成`, {
        batchSize: batch.length,
        processingTime: processingTime.toFixed(2) + 'ms',
        averagePerOperation: (processingTime / batch.length).toFixed(2) + 'ms'
      });

    } catch (error) {
      logger.error('[ServiceOrchestrator] 批处理失败:', error);
      
      // 为失败的请求返回错误结果
      batch.forEach(request => {
        const result: BatchOperationResult = {
          id: request.id,
          success: false,
          error: 'Batch processing failed',
          executionTime: 0
        };
        (request as any).resolve?.(result);
      });
    }
  }

  /**
   * 分组批处理请求
   */
  private groupBatchRequests(requests: BatchOperationRequest[]): Map<string, BatchOperationRequest[]> {
    const grouped = new Map<string, BatchOperationRequest[]>();
    
    // 按优先级排序
    requests.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    requests.forEach(request => {
      if (!grouped.has(request.service)) {
        grouped.set(request.service, []);
      }
      grouped.get(request.service)!.push(request);
    });
    
    return grouped;
  }

  /**
   * 处理特定服务的批次
   */
  private async processServiceBatch(serviceType: string, requests: BatchOperationRequest[]): Promise<void> {
    const concurrentLimit = Math.min(requests.length, this.config.maxConcurrentOperations);
    
    // 将请求分块处理以避免过载
    for (let i = 0; i < requests.length; i += concurrentLimit) {
      const chunk = requests.slice(i, i + concurrentLimit);
      
      const chunkPromises = chunk.map(async (request) => {
        const operationStartTime = performance.now();
        
        try {
          let result: any;
          
          // 根据服务类型执行相应操作
          switch (serviceType) {
            case 'recycle_bin':
              result = await this.executeRecycleBinOperation(request);
              break;
            case 'chain_management':
              result = await this.executeChainOperation(request);
              break;
            case 'session_management':
              result = await this.executeSessionOperation(request);
              break;
            default:
              throw new Error(`Unknown service type: ${serviceType}`);
          }
          
          const executionTime = performance.now() - operationStartTime;
          const batchResult: BatchOperationResult = {
            id: request.id,
            success: true,
            result,
            executionTime
          };
          
          (request as any).resolve?.(batchResult);
          
        } catch (error) {
          const executionTime = performance.now() - operationStartTime;
          const batchResult: BatchOperationResult = {
            id: request.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            executionTime
          };
          
          (request as any).resolve?.(batchResult);
        }
      });
      
      await Promise.all(chunkPromises);
    }
  }

  /**
   * 执行回收箱操作
   */
  private async executeRecycleBinOperation(request: BatchOperationRequest): Promise<any> {
    const { operation, parameters } = request;
    
    switch (operation) {
      case 'getDeletedChains':
        return await optimizedRecycleBinService.getDeletedChains();
      case 'moveToRecycleBin':
        return await optimizedRecycleBinService.moveToRecycleBin(parameters.chainId);
      case 'restoreChain':
        return await optimizedRecycleBinService.restoreChain(parameters.chainId);
      case 'bulkRestore':
        return await optimizedRecycleBinService.bulkRestore(parameters.chainIds);
      case 'getStats':
        return await optimizedRecycleBinService.getRecycleBinStats();
      default:
        throw new Error(`Unknown recycle bin operation: ${operation}`);
    }
  }

  /**
   * 执行链条管理操作
   */
  private async executeChainOperation(request: BatchOperationRequest): Promise<any> {
    const { operation, parameters } = request;
    
    switch (operation) {
      case 'getChains':
        return await highPerformanceDataAccess.getChains(parameters.userId, parameters.options);
      case 'createChain':
        return await highPerformanceDataAccess.createChain(parameters.chainData);
      case 'updateChain':
        return await highPerformanceDataAccess.updateChain(parameters.chainId, parameters.updates);
      case 'batchOperations':
        return await highPerformanceDataAccess.batchChainOperations(parameters.operations);
      default:
        throw new Error(`Unknown chain operation: ${operation}`);
    }
  }

  /**
   * 执行会话管理操作
   */
  private async executeSessionOperation(request: BatchOperationRequest): Promise<any> {
    const { operation, parameters } = request;
    
    switch (operation) {
      case 'getActiveSessions':
        return await highPerformanceDataAccess.getActiveSessions(parameters.userId);
      default:
        throw new Error(`Unknown session operation: ${operation}`);
    }
  }

  /**
   * 跨服务缓存管理
   */
  async invalidateCrossServiceCache(tags: string[]): Promise<void> {
    if (!this.config.enableCrossServiceCaching) return;
    
    try {
      for (const tag of tags) {
        smartCache.invalidateByTag(tag);
      }
      
      logger.debug('[ServiceOrchestrator] 跨服务缓存失效完成', { tags });
    } catch (error) {
      logger.error('[ServiceOrchestrator] 跨服务缓存失效失败:', error);
    }
  }

  /**
   * 捕获性能快照
   */
  private capturePerformanceSnapshot(): void {
    try {
      const dataAccessMetrics = highPerformanceDataAccess.getPerformanceMetrics();
      const recycleBinMetrics = optimizedRecycleBinService.getPerformanceMetrics();
      const cacheMetrics = smartCache.getMetrics();
      
      const snapshot: PerformanceSnapshot = {
        timestamp: new Date(),
        totalOperations: dataAccessMetrics.queryCount + recycleBinMetrics.operationsCount,
        averageResponseTime: (dataAccessMetrics.averageResponseTime + recycleBinMetrics.averageResponseTime) / 2,
        cacheEfficiency: parseFloat(cacheMetrics.hitRate.replace('%', '')),
        memoryUsage: dataAccessMetrics.totalDataTransferred,
        activeServices: ['highPerformanceDataAccess', 'optimizedRecycleBinService', 'smartCache']
      };
      
      this.performanceHistory.push(snapshot);
      
      // 保持最近24小时的数据
      if (this.performanceHistory.length > 24 * 60) {
        this.performanceHistory = this.performanceHistory.slice(-24 * 60);
      }
      
    } catch (error) {
      logger.error('[ServiceOrchestrator] 性能快照捕获失败:', error);
    }
  }

  /**
   * 清理性能历史
   */
  private cleanupPerformanceHistory(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24小时前
    this.performanceHistory = this.performanceHistory.filter(
      snapshot => snapshot.timestamp > cutoffTime
    );
  }

  /**
   * 获取服务健康状态
   */
  async getServiceHealth(): Promise<ServiceHealth[]> {
    const healthPromises = [
      this.checkDataAccessHealth(),
      this.checkRecycleBinHealth(),
      this.checkCacheHealth()
    ];
    
    const healthResults = await Promise.allSettled(healthPromises);
    
    return healthResults
      .filter((result): result is PromiseFulfilledResult<ServiceHealth> => result.status === 'fulfilled')
      .map(result => result.value);
  }

  /**
   * 检查数据访问层健康状态
   */
  private async checkDataAccessHealth(): Promise<ServiceHealth> {
    const startTime = performance.now();
    
    try {
      const metrics = highPerformanceDataAccess.getPerformanceMetrics();
      const responseTime = performance.now() - startTime;
      
      const issues: string[] = [];
      let status: 'healthy' | 'warning' | 'error' = 'healthy';
      
      if (metrics.averageResponseTime > 1000) {
        issues.push('平均响应时间过长');
        status = 'warning';
      }
      
      if (parseFloat(metrics.cacheMetrics.hitRate.replace('%', '')) < 50) {
        issues.push('缓存命中率较低');
        if (status !== 'error') status = 'warning';
      }
      
      return {
        serviceName: 'HighPerformanceDataAccess',
        status,
        responseTime,
        errorRate: 0, // 需要实现错误率计算
        lastActivity: new Date(),
        issues
      };
    } catch (error) {
      return {
        serviceName: 'HighPerformanceDataAccess',
        status: 'error',
        responseTime: performance.now() - startTime,
        errorRate: 100,
        lastActivity: new Date(),
        issues: ['健康检查失败: ' + (error instanceof Error ? error.message : '未知错误')]
      };
    }
  }

  /**
   * 检查回收箱服务健康状态
   */
  private async checkRecycleBinHealth(): Promise<ServiceHealth> {
    const startTime = performance.now();
    
    try {
      const healthStatus = await optimizedRecycleBinService.getHealthStatus();
      const responseTime = performance.now() - startTime;
      
      return {
        serviceName: 'OptimizedRecycleBinService',
        status: healthStatus.status,
        responseTime,
        errorRate: 0,
        lastActivity: new Date(),
        issues: healthStatus.issues
      };
    } catch (error) {
      return {
        serviceName: 'OptimizedRecycleBinService',
        status: 'error',
        responseTime: performance.now() - startTime,
        errorRate: 100,
        lastActivity: new Date(),
        issues: ['健康检查失败: ' + (error instanceof Error ? error.message : '未知错误')]
      };
    }
  }

  /**
   * 检查缓存系统健康状态
   */
  private async checkCacheHealth(): Promise<ServiceHealth> {
    const startTime = performance.now();
    
    try {
      const metrics = smartCache.getMetrics();
      const responseTime = performance.now() - startTime;
      
      const issues: string[] = [];
      let status: 'healthy' | 'warning' | 'error' = 'healthy';
      
      const hitRate = parseFloat(metrics.hitRate.replace('%', ''));
      if (hitRate < 70) {
        issues.push(`缓存命中率较低: ${metrics.hitRate}`);
        status = 'warning';
      }
      
      if (metrics.evictions > metrics.sets * 0.5) {
        issues.push('缓存驱逐率过高');
        if (status !== 'error') status = 'warning';
      }
      
      return {
        serviceName: 'SmartCacheSystem',
        status,
        responseTime,
        errorRate: 0,
        lastActivity: new Date(),
        issues
      };
    } catch (error) {
      return {
        serviceName: 'SmartCacheSystem',
        status: 'error',
        responseTime: performance.now() - startTime,
        errorRate: 100,
        lastActivity: new Date(),
        issues: ['健康检查失败: ' + (error instanceof Error ? error.message : '未知错误')]
      };
    }
  }

  /**
   * 获取综合性能报告
   */
  getPerformanceReport(): {
    currentSnapshot: PerformanceSnapshot | null;
    historicalData: PerformanceSnapshot[];
    trends: {
      responseTimeGrowth: number;
      cacheEfficiencyTrend: number;
      operationsGrowth: number;
    };
    recommendations: string[];
  } {
    const currentSnapshot = this.performanceHistory[this.performanceHistory.length - 1] || null;
    const recommendations: string[] = [];
    
    // 计算趋势
    let responseTimeGrowth = 0;
    let cacheEfficiencyTrend = 0;
    let operationsGrowth = 0;
    
    if (this.performanceHistory.length >= 2) {
      const recent = this.performanceHistory.slice(-10); // 最近10个快照
      const older = this.performanceHistory.slice(-20, -10); // 之前10个快照
      
      if (older.length > 0) {
        const recentAvgResponseTime = recent.reduce((sum, s) => sum + s.averageResponseTime, 0) / recent.length;
        const olderAvgResponseTime = older.reduce((sum, s) => sum + s.averageResponseTime, 0) / older.length;
        responseTimeGrowth = ((recentAvgResponseTime - olderAvgResponseTime) / olderAvgResponseTime) * 100;
        
        const recentAvgCacheEfficiency = recent.reduce((sum, s) => sum + s.cacheEfficiency, 0) / recent.length;
        const olderAvgCacheEfficiency = older.reduce((sum, s) => sum + s.cacheEfficiency, 0) / older.length;
        cacheEfficiencyTrend = recentAvgCacheEfficiency - olderAvgCacheEfficiency;
        
        const recentAvgOperations = recent.reduce((sum, s) => sum + s.totalOperations, 0) / recent.length;
        const olderAvgOperations = older.reduce((sum, s) => sum + s.totalOperations, 0) / older.length;
        operationsGrowth = ((recentAvgOperations - olderAvgOperations) / olderAvgOperations) * 100;
      }
    }
    
    // 生成建议
    if (currentSnapshot) {
      if (currentSnapshot.averageResponseTime > 500) {
        recommendations.push('考虑优化数据库查询或增加缓存策略');
      }
      
      if (currentSnapshot.cacheEfficiency < 70) {
        recommendations.push('调整缓存策略以提高命中率');
      }
      
      if (responseTimeGrowth > 20) {
        recommendations.push('响应时间增长过快，建议进行性能优化');
      }
      
      if (cacheEfficiencyTrend < -5) {
        recommendations.push('缓存效率下降，建议检查缓存配置');
      }
    }
    
    return {
      currentSnapshot,
      historicalData: this.performanceHistory.slice(-100), // 最近100个快照
      trends: {
        responseTimeGrowth,
        cacheEfficiencyTrend,
        operationsGrowth
      },
      recommendations
    };
  }

  /**
   * 更新配置
   */
  updateConfiguration(newConfig: Partial<ServiceOrchestrationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('[ServiceOrchestrator] 配置已更新', { newConfig });
  }

  /**
   * 获取当前配置
   */
  getConfiguration(): ServiceOrchestrationConfig {
    return { ...this.config };
  }

  /**
   * 清理资源
   */
  destroy(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    // 清理批处理和懒加载管理器
    this.batchOperations.shutdown();
    this.lazyLoader.cleanup();
    
    this.batchQueue = [];
    this.performanceHistory = [];
    this.serviceHealthCache.clear();
    
    logger.info('[ServiceOrchestrator] 资源清理完成');
  }
}

// 创建全局实例
export const serviceOrchestrator = ServiceOrchestrator.getInstance();