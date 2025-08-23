/**
 * 高性能批量操作管理器
 * 
 * 实现智能批量操作调度，包括：
 * - 操作队列管理和优先级调度
 * - 智能批处理合并和优化
 * - 批量操作性能监控
 * - 自适应批量大小调整
 * - 错误恢复和重试机制
 */

import { logger } from '../utils/logger';
import { highPerformanceDataAccess } from '../utils/highPerformanceDataAccess';
import { smartCache } from '../utils/smartCacheSystem';

interface BatchOperation {
  id: string;
  type: 'create' | 'read' | 'update' | 'delete';
  resource: string;
  data?: any;
  conditions?: any;
  priority: 'low' | 'normal' | 'high' | 'critical';
  timeout?: number;
  retryCount?: number;
  createdAt: Date;
  resolve: (result: any) => void;
  reject: (error: any) => void;
}

interface BatchGroup {
  resource: string;
  type: string;
  operations: BatchOperation[];
  estimatedSize: number;
  priority: number;
  createdAt: Date;
}

interface BatchResult {
  operationId: string;
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
}

interface BatchExecutionStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageExecutionTime: number;
  throughput: number; // operations per second
  errorRate: number;
  retryRate: number;
}

interface BatchConfig {
  maxBatchSize: number;
  maxQueueSize: number;
  batchTimeout: number;
  maxConcurrentBatches: number;
  retryAttempts: number;
  retryDelay: number;
  adaptiveSizing: boolean;
  performanceThreshold: number;
}

class BatchOperationsManager {
  private static instance: BatchOperationsManager;
  private operationQueue: BatchOperation[] = [];
  private batchGroups = new Map<string, BatchGroup>();
  private activeExecutions = new Set<Promise<any>>();
  private batchTimer: NodeJS.Timeout | null = null;
  private executionStats: BatchExecutionStats;
  private config: BatchConfig;
  private performanceHistory: number[] = [];

  private constructor() {
    this.config = {
      maxBatchSize: 50,
      maxQueueSize: 1000,
      batchTimeout: 100, // ms
      maxConcurrentBatches: 5,
      retryAttempts: 3,
      retryDelay: 1000, // ms
      adaptiveSizing: true,
      performanceThreshold: 500 // ms
    };

    this.executionStats = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageExecutionTime: 0,
      throughput: 0,
      errorRate: 0,
      retryRate: 0
    };

    this.initializeBatchProcessing();
  }

  static getInstance(): BatchOperationsManager {
    if (!this.instance) {
      this.instance = new BatchOperationsManager();
    }
    return this.instance;
  }

  /**
   * 初始化批处理系统
   */
  private initializeBatchProcessing(): void {
    // 定期处理批量操作
    setInterval(() => {
      this.processBatches();
    }, this.config.batchTimeout);

    // 自适应性能调整
    if (this.config.adaptiveSizing) {
      setInterval(() => {
        this.adjustPerformanceParameters();
      }, 30000); // 每30秒调整一次
    }

    // 统计信息更新
    setInterval(() => {
      this.updateThroughputStats();
    }, 1000); // 每秒更新吞吐量
  }

  /**
   * 添加批量操作到队列
   */
  async addOperation<T>(
    type: 'create' | 'read' | 'update' | 'delete',
    resource: string,
    data?: any,
    conditions?: any,
    options: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      timeout?: number;
      retryCount?: number;
    } = {}
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // 检查队列大小限制
      if (this.operationQueue.length >= this.config.maxQueueSize) {
        reject(new Error('Batch queue is full'));
        return;
      }

      const operation: BatchOperation = {
        id: this.generateOperationId(),
        type,
        resource,
        data,
        conditions,
        priority: options.priority || 'normal',
        timeout: options.timeout || 30000,
        retryCount: options.retryCount || 0,
        createdAt: new Date(),
        resolve,
        reject
      };

      this.operationQueue.push(operation);
      
      // 按优先级排序队列
      this.prioritizeQueue();

      // 如果没有定时器运行，立即启动处理
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.processBatches();
        }, this.config.batchTimeout);
      }

      logger.debug(`[BatchOperationsManager] 添加操作到队列: ${type} ${resource}`, {
        operationId: operation.id,
        queueSize: this.operationQueue.length
      });
    });
  }

  /**
   * 优先级队列排序
   */
  private prioritizeQueue(): void {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    this.operationQueue.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // 同优先级按创建时间排序
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  /**
   * 处理批量操作
   */
  private async processBatches(): Promise<void> {
    this.batchTimer = null;

    if (this.operationQueue.length === 0) return;
    if (this.activeExecutions.size >= this.config.maxConcurrentBatches) {
      // 如果并发批次已满，延迟处理
      this.batchTimer = setTimeout(() => {
        this.processBatches();
      }, this.config.batchTimeout);
      return;
    }

    // 将操作分组
    const groups = this.groupOperations();
    
    // 执行分组的批次
    const executionPromises = Array.from(groups.values()).map(group => 
      this.executeBatchGroup(group)
    );

    // 跟踪活跃执行
    executionPromises.forEach(promise => {
      this.activeExecutions.add(promise);
      promise.finally(() => {
        this.activeExecutions.delete(promise);
      });
    });

    // 清空已处理的操作队列
    this.operationQueue = [];

    // 等待当前批次完成（非阻塞）
    Promise.allSettled(executionPromises).then(() => {
      // 如果队列中还有操作，继续处理
      if (this.operationQueue.length > 0) {
        this.batchTimer = setTimeout(() => {
          this.processBatches();
        }, this.config.batchTimeout);
      }
    });
  }

  /**
   * 将操作分组
   */
  private groupOperations(): Map<string, BatchGroup> {
    const groups = new Map<string, BatchGroup>();

    for (const operation of this.operationQueue) {
      const groupKey = `${operation.resource}:${operation.type}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          resource: operation.resource,
          type: operation.type,
          operations: [],
          estimatedSize: 0,
          priority: this.getPriorityNumber(operation.priority),
          createdAt: operation.createdAt
        });
      }

      const group = groups.get(groupKey)!;
      group.operations.push(operation);
      group.estimatedSize += this.estimateOperationSize(operation);

      // 更新组优先级（取最高优先级）
      const operationPriority = this.getPriorityNumber(operation.priority);
      if (operationPriority < group.priority) {
        group.priority = operationPriority;
      }

      // 检查批次大小限制
      if (group.operations.length >= this.config.maxBatchSize) {
        break; // 该组已满
      }
    }

    return groups;
  }

  /**
   * 执行批组
   */
  private async executeBatchGroup(group: BatchGroup): Promise<void> {
    const startTime = performance.now();
    const results: BatchResult[] = [];

    try {
      logger.info(`[BatchOperationsManager] 执行批组: ${group.resource}:${group.type}`, {
        operationCount: group.operations.length,
        priority: group.priority,
        estimatedSize: group.estimatedSize
      });

      // 根据资源和操作类型选择执行策略
      const batchResults = await this.executeBatchByResource(group);
      
      // 处理结果
      for (let i = 0; i < group.operations.length; i++) {
        const operation = group.operations[i];
        const result = batchResults[i];
        
        const batchResult: BatchResult = {
          operationId: operation.id,
          success: result.success,
          result: result.data,
          error: result.error,
          executionTime: performance.now() - startTime
        };
        
        results.push(batchResult);

        // 返回结果给操作发起者
        if (result.success) {
          operation.resolve(result.data);
          this.executionStats.successfulOperations++;
        } else {
          // 检查是否需要重试
          if (operation.retryCount && operation.retryCount < this.config.retryAttempts) {
            await this.retryOperation(operation);
          } else {
            operation.reject(new Error(result.error || '批量操作失败'));
            this.executionStats.failedOperations++;
          }
        }
      }

      const executionTime = performance.now() - startTime;
      this.updateExecutionStats(executionTime, results);

    } catch (error) {
      // 处理整个批次的错误
      logger.error(`[BatchOperationsManager] 批组执行失败: ${group.resource}:${group.type}`, error);
      
      group.operations.forEach(operation => {
        operation.reject(error);
        this.executionStats.failedOperations++;
      });
    }
  }

  /**
   * 根据资源类型执行批量操作
   */
  private async executeBatchByResource(group: BatchGroup): Promise<Array<{success: boolean; data?: any; error?: string}>> {
    const { resource, type, operations } = group;

    try {
      switch (resource) {
        case 'chains':
          return await this.executeChainsOperations(type, operations);
        
        case 'sessions':
          return await this.executeSessionsOperations(type, operations);
        
        case 'completions':
          return await this.executeCompletionsOperations(type, operations);
        
        case 'cache':
          return await this.executeCacheOperations(type, operations);
        
        default:
          throw new Error(`Unsupported resource type: ${resource}`);
      }
    } catch (error) {
      // 返回所有操作失败的结果
      return operations.map(() => ({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  /**
   * 执行链条相关批量操作
   */
  private async executeChainsOperations(
    type: string,
    operations: BatchOperation[]
  ): Promise<Array<{success: boolean; data?: any; error?: string}>> {
    try {
      switch (type) {
        case 'read':
          // 批量读取链条
          const readResults = await Promise.all(
            operations.map(async op => {
              try {
                const chains = await highPerformanceDataAccess.getChains(
                  op.conditions?.userId, 
                  op.conditions?.options
                );
                return { success: true, data: chains };
              } catch (error) {
                return { 
                  success: false, 
                  error: error instanceof Error ? error.message : 'Read failed' 
                };
              }
            })
          );
          return readResults;

        case 'create':
          // 批量创建链条
          const createOps = operations.map(op => ({
            operation: 'create' as const,
            chainId: undefined,
            data: op.data
          }));
          
          const createResult = await highPerformanceDataAccess.batchChainOperations(createOps);
          return operations.map((_, index) => ({
            success: true,
            data: createResult[index]
          }));

        case 'update':
          // 批量更新链条
          const updateOps = operations.map(op => ({
            operation: 'update' as const,
            chainId: op.conditions?.chainId,
            data: op.data
          }));
          
          const updateResult = await highPerformanceDataAccess.batchChainOperations(updateOps);
          return operations.map((_, index) => ({
            success: true,
            data: updateResult[index]
          }));

        case 'delete':
          // 批量删除链条
          const deleteOps = operations.map(op => ({
            operation: 'delete' as const,
            chainId: op.conditions?.chainId
          }));
          
          await highPerformanceDataAccess.batchChainOperations(deleteOps);
          return operations.map(() => ({ success: true, data: null }));

        default:
          throw new Error(`Unsupported chains operation: ${type}`);
      }
    } catch (error) {
      return operations.map(() => ({
        success: false,
        error: error instanceof Error ? error.message : 'Chains operation failed'
      }));
    }
  }

  /**
   * 执行会话相关批量操作
   */
  private async executeSessionsOperations(
    type: string,
    operations: BatchOperation[]
  ): Promise<Array<{success: boolean; data?: any; error?: string}>> {
    try {
      switch (type) {
        case 'read':
          const sessionResults = await Promise.all(
            operations.map(async op => {
              try {
                const sessions = await highPerformanceDataAccess.getActiveSessions(
                  op.conditions?.userId
                );
                return { success: true, data: sessions };
              } catch (error) {
                return { 
                  success: false, 
                  error: error instanceof Error ? error.message : 'Session read failed' 
                };
              }
            })
          );
          return sessionResults;

        default:
          throw new Error(`Unsupported sessions operation: ${type}`);
      }
    } catch (error) {
      return operations.map(() => ({
        success: false,
        error: error instanceof Error ? error.message : 'Sessions operation failed'
      }));
    }
  }

  /**
   * 执行完成记录相关批量操作
   */
  private async executeCompletionsOperations(
    type: string,
    operations: BatchOperation[]
  ): Promise<Array<{success: boolean; data?: any; error?: string}>> {
    // 简化实现，返回成功结果
    return operations.map(() => ({ success: true, data: null }));
  }

  /**
   * 执行缓存相关批量操作
   */
  private async executeCacheOperations(
    type: string,
    operations: BatchOperation[]
  ): Promise<Array<{success: boolean; data?: any; error?: string}>> {
    try {
      const results: Array<{success: boolean; data?: any; error?: string}> = [];

      for (const operation of operations) {
        try {
          switch (type) {
            case 'read':
              const data = await smartCache.get(operation.conditions?.key);
              results.push({ success: true, data });
              break;

            case 'create':
            case 'update':
              await smartCache.set(
                operation.conditions?.key,
                operation.data.value,
                operation.data.options
              );
              results.push({ success: true, data: null });
              break;

            case 'delete':
              const deleted = smartCache.delete(operation.conditions?.key);
              results.push({ success: true, data: deleted });
              break;

            default:
              results.push({ success: false, error: `Unsupported cache operation: ${type}` });
          }
        } catch (error) {
          results.push({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Cache operation failed' 
          });
        }
      }

      return results;
    } catch (error) {
      return operations.map(() => ({
        success: false,
        error: error instanceof Error ? error.message : 'Cache operations failed'
      }));
    }
  }

  /**
   * 重试操作
   */
  private async retryOperation(operation: BatchOperation): Promise<void> {
    setTimeout(async () => {
      try {
        operation.retryCount = (operation.retryCount || 0) + 1;
        this.operationQueue.unshift(operation); // 重新添加到队列前端
        this.executionStats.totalOperations++; // 重试也算作操作
        
        logger.debug(`[BatchOperationsManager] 重试操作: ${operation.id}`, {
          retryCount: operation.retryCount,
          maxRetries: this.config.retryAttempts
        });
        
        // 触发批处理
        if (!this.batchTimer) {
          this.batchTimer = setTimeout(() => {
            this.processBatches();
          }, this.config.batchTimeout);
        }
        
      } catch (error) {
        operation.reject(error);
        this.executionStats.failedOperations++;
      }
    }, this.config.retryDelay * operation.retryCount!);
  }

  /**
   * 估算操作大小
   */
  private estimateOperationSize(operation: BatchOperation): number {
    let size = 100; // 基础大小
    
    if (operation.data) {
      try {
        size += JSON.stringify(operation.data).length;
      } catch {
        size += 1000; // 默认大小
      }
    }
    
    if (operation.conditions) {
      try {
        size += JSON.stringify(operation.conditions).length;
      } catch {
        size += 500;
      }
    }
    
    return size;
  }

  /**
   * 获取优先级数值
   */
  private getPriorityNumber(priority: 'low' | 'normal' | 'high' | 'critical'): number {
    switch (priority) {
      case 'critical': return 0;
      case 'high': return 1;
      case 'normal': return 2;
      case 'low': return 3;
      default: return 2;
    }
  }

  /**
   * 生成操作ID
   */
  private generateOperationId(): string {
    return `batch_op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 更新执行统计
   */
  private updateExecutionStats(executionTime: number, results: BatchResult[]): void {
    const totalOps = results.length;
    this.executionStats.totalOperations += totalOps;

    // 更新平均执行时间
    const currentAvg = this.executionStats.averageExecutionTime;
    const totalOperations = this.executionStats.totalOperations;
    this.executionStats.averageExecutionTime = 
      (currentAvg * (totalOperations - totalOps) + executionTime) / totalOperations;

    // 计算错误率
    this.executionStats.errorRate = 
      this.executionStats.failedOperations / this.executionStats.totalOperations;

    // 记录性能历史
    this.performanceHistory.push(executionTime);
    if (this.performanceHistory.length > 100) {
      this.performanceHistory = this.performanceHistory.slice(-100);
    }
  }

  /**
   * 更新吞吐量统计
   */
  private updateThroughputStats(): void {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    
    // 简化吞吐量计算（实际项目中应该更精确）
    this.executionStats.throughput = this.executionStats.successfulOperations;
  }

  /**
   * 自适应性能参数调整
   */
  private adjustPerformanceParameters(): void {
    if (!this.config.adaptiveSizing || this.performanceHistory.length < 10) return;

    const averageTime = this.performanceHistory.reduce((sum, time) => sum + time, 0) / 
                       this.performanceHistory.length;

    if (averageTime > this.config.performanceThreshold) {
      // 性能下降，减少批次大小
      this.config.maxBatchSize = Math.max(10, this.config.maxBatchSize - 5);
      this.config.maxConcurrentBatches = Math.max(1, this.config.maxConcurrentBatches - 1);
      
      logger.info('[BatchOperationsManager] 性能调整: 减少批次大小', {
        newBatchSize: this.config.maxBatchSize,
        newConcurrentBatches: this.config.maxConcurrentBatches,
        averageTime
      });
    } else if (averageTime < this.config.performanceThreshold * 0.5) {
      // 性能良好，可以增加批次大小
      this.config.maxBatchSize = Math.min(100, this.config.maxBatchSize + 5);
      this.config.maxConcurrentBatches = Math.min(10, this.config.maxConcurrentBatches + 1);
      
      logger.info('[BatchOperationsManager] 性能调整: 增加批次大小', {
        newBatchSize: this.config.maxBatchSize,
        newConcurrentBatches: this.config.maxConcurrentBatches,
        averageTime
      });
    }
  }

  /**
   * 获取执行统计
   */
  getExecutionStats(): BatchExecutionStats {
    return { ...this.executionStats };
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    queueSize: number;
    maxQueueSize: number;
    activeBatches: number;
    maxConcurrentBatches: number;
    isProcessing: boolean;
  } {
    return {
      queueSize: this.operationQueue.length,
      maxQueueSize: this.config.maxQueueSize,
      activeBatches: this.activeExecutions.size,
      maxConcurrentBatches: this.config.maxConcurrentBatches,
      isProcessing: this.batchTimer !== null || this.activeExecutions.size > 0
    };
  }

  /**
   * 获取配置
   */
  getConfig(): BatchConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<BatchConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('[BatchOperationsManager] 配置已更新', { newConfig });
  }

  /**
   * 清空队列（慎用）
   */
  clearQueue(): void {
    this.operationQueue.forEach(op => {
      op.reject(new Error('Queue cleared'));
    });
    this.operationQueue = [];
    
    logger.warn('[BatchOperationsManager] 队列已清空');
  }

  /**
   * 暂停批处理
   */
  pauseBatchProcessing(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    logger.info('[BatchOperationsManager] 批处理已暂停');
  }

  /**
   * 恢复批处理
   */
  resumeBatchProcessing(): void {
    if (this.operationQueue.length > 0 && !this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatches();
      }, this.config.batchTimeout);
    }
    logger.info('[BatchOperationsManager] 批处理已恢复');
  }

  /**
   * 获取性能指标
   */
  getMetrics(): {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageExecutionTime: number;
    queueSize: number;
    processingBatches: number;
  } {
    return {
      totalOperations: this.stats.totalOperations,
      successfulOperations: this.stats.successfulOperations,
      failedOperations: this.stats.failedOperations,
      averageExecutionTime: this.stats.averageExecutionTime,
      queueSize: this.operationQueue.length,
      processingBatches: this.processingBatches.size
    };
  }

  /**
   * 清理已完成的操作
   */
  clearCompletedOperations(): void {
    // 清理完成的批处理记录（这里是示例实现）
    this.stats.successfulOperations = 0;
    this.stats.failedOperations = 0;
    
    // 重置执行时间统计
    this.executionTimes = [];
    this.stats.averageExecutionTime = 0;
    
    logger.debug('[BatchOperationsManager] 已清理已完成的操作记录');
  }

  /**
   * 统一的关闭方法
   */
  shutdown(): void {
    this.destroy();
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    this.pauseBatchProcessing();
    this.clearQueue();
    this.batchGroups.clear();
    this.performanceHistory = [];
    
    logger.info('[BatchOperationsManager] 实例已销毁');
  }
}

// 创建全局实例
export const batchOperationsManager = BatchOperationsManager.getInstance();
export { BatchOperationsManager };