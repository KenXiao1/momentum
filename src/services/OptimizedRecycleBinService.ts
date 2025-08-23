/**
 * 优化回收箱服务
 * 
 * 集成高性能数据访问层，实现：
 * - 批量操作优化
 * - 智能缓存管理
 * - 并发安全处理
 * - 性能监控
 */

import { Chain, DeletedChain } from '../types';
import { storage as localStorageUtils } from '../utils/storage';
import { highPerformanceDataAccess } from '../utils/highPerformanceDataAccess';
import { smartCache } from '../utils/smartCacheSystem';
import { isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';

interface RecycleBinStats {
  totalDeleted: number;
  expiringSoon: number;
  diskUsage: number;
  oldestDeletionDate?: Date;
  mostRecentDeletionDate?: Date;
}

interface BatchOperationResult {
  successful: string[];
  failed: Array<{ id: string; error: string }>;
  totalProcessed: number;
  processingTime: number;
}

export class OptimizedRecycleBinService {
  private static instance: OptimizedRecycleBinService;
  private performanceMetrics = {
    operationsCount: 0,
    averageResponseTime: 0,
    cacheHitRate: 0,
    batchOperationsCount: 0
  };

  private constructor() {}

  /**
   * 单例模式获取实例
   */
  static getInstance(): OptimizedRecycleBinService {
    if (!this.instance) {
      this.instance = new OptimizedRecycleBinService();
    }
    return this.instance;
  }

  /**
   * 获取当前使用的存储实例
   */
  private getStorage() {
    return isSupabaseConfigured ? highPerformanceDataAccess : localStorageUtils;
  }

  /**
   * 获取所有已删除的链条（优化版本）
   */
  async getDeletedChains(): Promise<DeletedChain[]> {
    const startTime = performance.now();
    
    try {
      logger.info('[OptimizedRecycleBin] 开始获取已删除链条...');
      
      if (isSupabaseConfigured) {
        // 使用高性能数据访问层
        const deletedChains = await highPerformanceDataAccess.getDeletedChains();
        
        // 异步预加载相关统计数据
        this.preloadRecycleBinStats();
        
        this.updatePerformanceMetrics(performance.now() - startTime);
        
        logger.info(`[OptimizedRecycleBin] 获取到 ${deletedChains.length} 条已删除的链条`, {
          count: deletedChains.length,
          responseTime: performance.now() - startTime
        });
        
        return deletedChains;
      } else {
        // 回退到本地存储
        const storage = localStorageUtils;
        const deletedChains = await storage.getDeletedChains();
        
        this.updatePerformanceMetrics(performance.now() - startTime);
        return deletedChains;
      }
    } catch (error) {
      logger.error('[OptimizedRecycleBin] 获取已删除链条失败:', error);
      throw new Error('获取已删除链条失败');
    }
  }

  /**
   * 将链条移动到回收箱（优化软删除）
   */
  async moveToRecycleBin(chainId: string): Promise<void> {
    const startTime = performance.now();
    
    try {
      logger.info(`[OptimizedRecycleBin] 将链条 ${chainId} 移动到回收箱`);
      
      if (isSupabaseConfigured) {
        // 使用高性能批量操作
        const result = await highPerformanceDataAccess.batchChainOperations([{
          operation: 'delete',
          chainId: chainId
        }]);

        // 智能缓存失效
        await this.invalidateRelatedCache(chainId);
        
        logger.info(`[OptimizedRecycleBin] 链条 ${chainId} 已成功移动到回收箱`);
      } else {
        const storage = this.getStorage();
        await storage.softDeleteChain(chainId);
      }
      
      this.updatePerformanceMetrics(performance.now() - startTime);
    } catch (error) {
      logger.error(`[OptimizedRecycleBin] 移动链条 ${chainId} 到回收箱失败:`, error);
      throw new Error(`移动链条到回收箱失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 从回收箱恢复链条（优化版本）
   */
  async restoreChain(chainId: string): Promise<void> {
    const startTime = performance.now();
    
    try {
      logger.info(`[OptimizedRecycleBin] 恢复链条 ${chainId}`);
      
      if (isSupabaseConfigured) {
        // 先获取链条信息用于智能缓存预热
        const chainToRestore = await highPerformanceDataAccess.getChainById(chainId);
        
        if (!chainToRestore) {
          throw new Error(`链条 ${chainId} 不存在`);
        }

        // 执行恢复操作
        const result = await highPerformanceDataAccess.updateChain(chainId, {
          deletedAt: null
        } as any);

        // 预热相关缓存
        await this.preheatCacheAfterRestore(chainToRestore);
        
        // 智能缓存更新
        await this.invalidateRelatedCache(chainId);
        
        logger.info(`[OptimizedRecycleBin] 链条 ${chainId} 已成功恢复`);
      } else {
        const storage = this.getStorage();
        await storage.restoreChain(chainId);
      }
      
      this.updatePerformanceMetrics(performance.now() - startTime);
    } catch (error) {
      logger.error(`[OptimizedRecycleBin] 恢复链条 ${chainId} 失败:`, error);
      throw new Error(`恢复链条失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 永久删除链条（优化版本）
   */
  async permanentlyDelete(chainId: string): Promise<void> {
    const startTime = performance.now();
    
    try {
      logger.info(`[OptimizedRecycleBin] 永久删除链条 ${chainId}`);
      
      if (isSupabaseConfigured) {
        // 使用批量操作进行永久删除
        await highPerformanceDataAccess.batchChainOperations([{
          operation: 'delete',
          chainId: chainId
        }]);

        // 清理所有相关缓存
        await this.cleanupCacheForChain(chainId);
      } else {
        const storage = this.getStorage();
        await storage.permanentlyDeleteChain(chainId);
      }
      
      this.updatePerformanceMetrics(performance.now() - startTime);
      logger.info(`[OptimizedRecycleBin] 链条 ${chainId} 已永久删除`);
    } catch (error) {
      logger.error(`[OptimizedRecycleBin] 永久删除链条 ${chainId} 失败:`, error);
      throw new Error(`永久删除链条失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 批量恢复链条（高性能批处理）
   */
  async bulkRestore(chainIds: string[]): Promise<BatchOperationResult> {
    const startTime = performance.now();
    const successful: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];
    
    try {
      logger.info(`[OptimizedRecycleBin] 批量恢复 ${chainIds.length} 条链条:`, chainIds);
      
      if (isSupabaseConfigured) {
        // 使用高性能批量操作
        const batchOps = chainIds.map(chainId => ({
          operation: 'update' as const,
          chainId,
          data: { deletedAt: null }
        }));

        try {
          const results = await highPerformanceDataAccess.batchChainOperations(batchOps);
          
          // 所有操作成功
          successful.push(...chainIds);
          
          // 批量清理缓存
          await this.batchInvalidateCache(chainIds);
          
          this.performanceMetrics.batchOperationsCount++;
          
        } catch (error) {
          // 如果批量操作失败，回退到逐个处理
          logger.warn('[OptimizedRecycleBin] 批量操作失败，回退到逐个处理');
          
          for (const chainId of chainIds) {
            try {
              await this.restoreChain(chainId);
              successful.push(chainId);
            } catch (err) {
              failed.push({
                id: chainId,
                error: err instanceof Error ? err.message : '未知错误'
              });
            }
          }
        }
      } else {
        // 本地存储逐个处理
        const storage = this.getStorage();
        for (const chainId of chainIds) {
          try {
            await storage.restoreChain(chainId);
            successful.push(chainId);
          } catch (error) {
            failed.push({
              id: chainId,
              error: error instanceof Error ? error.message : '未知错误'
            });
          }
        }
      }

      const processingTime = performance.now() - startTime;
      
      logger.info(`[OptimizedRecycleBin] 批量恢复完成: ${successful.length} 成功, ${failed.length} 失败`, {
        processingTime,
        successRate: (successful.length / chainIds.length * 100).toFixed(2) + '%'
      });

      this.updatePerformanceMetrics(processingTime);

      return {
        successful,
        failed,
        totalProcessed: chainIds.length,
        processingTime
      };
      
    } catch (error) {
      logger.error('[OptimizedRecycleBin] 批量恢复链条失败:', error);
      throw new Error(`批量恢复链条失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 批量永久删除链条（高性能批处理）
   */
  async bulkPermanentDelete(chainIds: string[]): Promise<BatchOperationResult> {
    const startTime = performance.now();
    const successful: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];
    
    try {
      logger.info(`[OptimizedRecycleBin] 批量永久删除 ${chainIds.length} 条链条:`, chainIds);
      
      if (isSupabaseConfigured) {
        // 使用高性能批量操作
        const batchOps = chainIds.map(chainId => ({
          operation: 'delete' as const,
          chainId
        }));

        try {
          await highPerformanceDataAccess.batchChainOperations(batchOps);
          
          // 所有操作成功
          successful.push(...chainIds);
          
          // 批量清理缓存
          await this.batchCleanupCache(chainIds);
          
          this.performanceMetrics.batchOperationsCount++;
          
        } catch (error) {
          // 如果批量操作失败，回退到逐个处理
          logger.warn('[OptimizedRecycleBin] 批量删除失败，回退到逐个处理');
          
          for (const chainId of chainIds) {
            try {
              await this.permanentlyDelete(chainId);
              successful.push(chainId);
            } catch (err) {
              failed.push({
                id: chainId,
                error: err instanceof Error ? err.message : '未知错误'
              });
            }
          }
        }
      } else {
        // 本地存储逐个处理
        const storage = this.getStorage();
        for (const chainId of chainIds) {
          try {
            await storage.permanentlyDeleteChain(chainId);
            successful.push(chainId);
          } catch (error) {
            failed.push({
              id: chainId,
              error: error instanceof Error ? error.message : '未知错误'
            });
          }
        }
      }

      const processingTime = performance.now() - startTime;
      
      logger.info(`[OptimizedRecycleBin] 批量永久删除完成: ${successful.length} 成功, ${failed.length} 失败`, {
        processingTime,
        successRate: (successful.length / chainIds.length * 100).toFixed(2) + '%'
      });

      this.updatePerformanceMetrics(processingTime);

      return {
        successful,
        failed,
        totalProcessed: chainIds.length,
        processingTime
      };
      
    } catch (error) {
      logger.error('[OptimizedRecycleBin] 批量永久删除链条失败:', error);
      throw new Error(`批量永久删除链条失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 清理过期的已删除链条（优化版本）
   */
  async cleanupExpiredChains(olderThanDays: number = 30): Promise<number> {
    const startTime = performance.now();
    
    try {
      logger.info(`[OptimizedRecycleBin] 开始清理超过 ${olderThanDays} 天的已删除链条`);
      
      let deletedCount = 0;
      
      if (isSupabaseConfigured) {
        // 先获取过期的链条列表
        const deletedChains = await this.getDeletedChains();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
        
        const expiredChains = deletedChains.filter(chain => 
          chain.deletedAt < cutoffDate
        );

        if (expiredChains.length > 0) {
          // 使用批量删除
          const result = await this.bulkPermanentDelete(expiredChains.map(c => c.id));
          deletedCount = result.successful.length;
        }
      } else {
        const storage = this.getStorage();
        deletedCount = await storage.cleanupExpiredDeletedChains(olderThanDays);
      }
      
      this.updatePerformanceMetrics(performance.now() - startTime);
      
      logger.info(`[OptimizedRecycleBin] 清理完成，共删除 ${deletedCount} 条过期链条`);
      return deletedCount;
    } catch (error) {
      logger.error('[OptimizedRecycleBin] 清理过期链条失败:', error);
      throw new Error(`清理过期链条失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取回收箱统计信息（增强版本）
   */
  async getRecycleBinStats(): Promise<RecycleBinStats> {
    const startTime = performance.now();
    
    try {
      const cacheKey = 'recycle_bin_stats';
      
      // 先尝试从缓存获取
      const cached = await smartCache.get<RecycleBinStats>(cacheKey);
      if (cached) {
        this.performanceMetrics.cacheHitRate++;
        return cached;
      }

      const deletedChains = await this.getDeletedChains();
      
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const expiringSoon = deletedChains.filter(chain => 
        chain.deletedAt < sevenDaysFromNow && chain.deletedAt > thirtyDaysAgo
      ).length;

      // 计算磁盘使用情况（估算）
      const diskUsage = deletedChains.reduce((total, chain) => {
        // 粗略估算：每个链条约 2KB
        return total + 2048;
      }, 0);

      // 获取最旧和最新的删除时间
      const deletionDates = deletedChains.map(c => c.deletedAt).sort((a, b) => a.getTime() - b.getTime());
      const oldestDeletionDate = deletionDates[0];
      const mostRecentDeletionDate = deletionDates[deletionDates.length - 1];

      const stats: RecycleBinStats = {
        totalDeleted: deletedChains.length,
        expiringSoon,
        diskUsage,
        oldestDeletionDate,
        mostRecentDeletionDate
      };

      // 缓存统计信息（5分钟）
      await smartCache.set(cacheKey, stats, {
        ttl: 5 * 60 * 1000,
        priority: 'normal',
        tags: ['recycle_bin', 'stats']
      });

      this.updatePerformanceMetrics(performance.now() - startTime);
      
      return stats;
    } catch (error) {
      logger.error('[OptimizedRecycleBin] 获取回收箱统计信息失败:', error);
      return { 
        totalDeleted: 0, 
        expiringSoon: 0,
        diskUsage: 0
      };
    }
  }

  /**
   * 预加载回收箱统计信息
   */
  private async preloadRecycleBinStats(): Promise<void> {
    setTimeout(() => {
      this.getRecycleBinStats().catch(error => {
        logger.error('[OptimizedRecycleBin] 预加载统计信息失败:', error);
      });
    }, 0);
  }

  /**
   * 恢复后预热缓存
   */
  private async preheatCacheAfterRestore(chain: Chain): Promise<void> {
    setTimeout(async () => {
      try {
        // 预热用户的活跃链条缓存
        if (isSupabaseConfigured && chain.user_id) {
          await highPerformanceDataAccess.getChains(chain.user_id);
        }
      } catch (error) {
        logger.error('[OptimizedRecycleBin] 预热缓存失败:', error);
      }
    }, 0);
  }

  /**
   * 智能缓存失效
   */
  private async invalidateRelatedCache(chainId: string): Promise<void> {
    try {
      // 清理相关标签的缓存
      smartCache.invalidateByTag('chains');
      smartCache.invalidateByTag('recycle_bin');
      smartCache.invalidateByTag(`chain:${chainId}`);
      
      // 清理统计信息缓存
      smartCache.delete('recycle_bin_stats');
    } catch (error) {
      logger.error('[OptimizedRecycleBin] 缓存失效失败:', error);
    }
  }

  /**
   * 批量缓存失效
   */
  private async batchInvalidateCache(chainIds: string[]): Promise<void> {
    try {
      smartCache.invalidateByTag('chains');
      smartCache.invalidateByTag('recycle_bin');
      
      chainIds.forEach(chainId => {
        smartCache.invalidateByTag(`chain:${chainId}`);
      });
      
      smartCache.delete('recycle_bin_stats');
    } catch (error) {
      logger.error('[OptimizedRecycleBin] 批量缓存失效失败:', error);
    }
  }

  /**
   * 清理链条相关缓存
   */
  private async cleanupCacheForChain(chainId: string): Promise<void> {
    try {
      smartCache.delete(`chain:${chainId}`);
      smartCache.invalidateByTag(`chain:${chainId}`);
      smartCache.invalidateByTag('chains');
      smartCache.invalidateByTag('recycle_bin');
      smartCache.delete('recycle_bin_stats');
    } catch (error) {
      logger.error('[OptimizedRecycleBin] 清理链条缓存失败:', error);
    }
  }

  /**
   * 批量清理缓存
   */
  private async batchCleanupCache(chainIds: string[]): Promise<void> {
    try {
      chainIds.forEach(chainId => {
        smartCache.delete(`chain:${chainId}`);
        smartCache.invalidateByTag(`chain:${chainId}`);
      });
      
      smartCache.invalidateByTag('chains');
      smartCache.invalidateByTag('recycle_bin');
      smartCache.delete('recycle_bin_stats');
    } catch (error) {
      logger.error('[OptimizedRecycleBin] 批量清理缓存失败:', error);
    }
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(responseTime: number): void {
    this.performanceMetrics.operationsCount++;
    this.performanceMetrics.averageResponseTime = 
      (this.performanceMetrics.averageResponseTime * (this.performanceMetrics.operationsCount - 1) + responseTime) / 
      this.performanceMetrics.operationsCount;
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      highPerformanceDataAccessMetrics: isSupabaseConfigured 
        ? highPerformanceDataAccess.getPerformanceMetrics()
        : null,
      cacheMetrics: smartCache.getMetrics()
    };
  }

  /**
   * 获取系统健康状态
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'error';
    deletedChainsCount: number;
    expiringSoon: number;
    lastCleanupAt?: Date;
    issues: string[];
  }> {
    try {
      const stats = await this.getRecycleBinStats();
      const issues: string[] = [];
      let status: 'healthy' | 'warning' | 'error' = 'healthy';

      // 检查删除链条过多
      if (stats.totalDeleted > 1000) {
        issues.push(`回收箱中有 ${stats.totalDeleted} 条已删除链条，建议清理`);
        status = 'warning';
      }

      // 检查即将过期的链条
      if (stats.expiringSoon > 50) {
        issues.push(`有 ${stats.expiringSoon} 条链条即将被自动删除`);
        if (status !== 'error') status = 'warning';
      }

      // 检查磁盘使用
      if (stats.diskUsage > 100 * 1024 * 1024) { // 100MB
        issues.push(`回收箱占用磁盘空间超过 ${(stats.diskUsage / 1024 / 1024).toFixed(2)}MB`);
        status = 'error';
      }

      return {
        status,
        deletedChainsCount: stats.totalDeleted,
        expiringSoon: stats.expiringSoon,
        issues
      };
    } catch (error) {
      return {
        status: 'error',
        deletedChainsCount: 0,
        expiringSoon: 0,
        issues: ['无法获取回收箱健康状态: ' + (error instanceof Error ? error.message : '未知错误')]
      };
    }
  }
}

// 创建全局优化实例
export const optimizedRecycleBinService = OptimizedRecycleBinService.getInstance();

// 为了向后兼容，导出静态方法版本
export class RecycleBinServiceOptimized {
  static async getDeletedChains(): Promise<DeletedChain[]> {
    return optimizedRecycleBinService.getDeletedChains();
  }

  static async moveToRecycleBin(chainId: string): Promise<void> {
    return optimizedRecycleBinService.moveToRecycleBin(chainId);
  }

  static async restoreChain(chainId: string): Promise<void> {
    return optimizedRecycleBinService.restoreChain(chainId);
  }

  static async permanentlyDelete(chainId: string): Promise<void> {
    return optimizedRecycleBinService.permanentlyDelete(chainId);
  }

  static async bulkRestore(chainIds: string[]): Promise<BatchOperationResult> {
    return optimizedRecycleBinService.bulkRestore(chainIds);
  }

  static async bulkPermanentDelete(chainIds: string[]): Promise<BatchOperationResult> {
    return optimizedRecycleBinService.bulkPermanentDelete(chainIds);
  }

  static async cleanupExpiredChains(olderThanDays: number = 30): Promise<number> {
    return optimizedRecycleBinService.cleanupExpiredChains(olderThanDays);
  }

  static async getRecycleBinStats(): Promise<RecycleBinStats> {
    return optimizedRecycleBinService.getRecycleBinStats();
  }

  static getPerformanceMetrics() {
    return optimizedRecycleBinService.getPerformanceMetrics();
  }

  static async getHealthStatus() {
    return optimizedRecycleBinService.getHealthStatus();
  }
}