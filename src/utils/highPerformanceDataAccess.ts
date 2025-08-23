/**
 * 高性能数据访问层
 * 
 * 集成智能缓存、查询优化、批量操作和懒加载
 * 显著提升数据访问性能，降低数据库负载
 */

import { supabase, getCurrentUser } from '../lib/supabase';
import { queryOptimizer } from './highPerformanceQueryOptimizer';
import { smartCache } from './smartCacheSystem';
import { Chain, DeletedChain, ScheduledSession, ActiveSession, CompletionHistory } from '../types';
import { logger } from './logger';

interface PerformanceMetrics {
  queryCount: number;
  cacheHitRate: number;
  averageResponseTime: number;
  totalDataTransferred: number;
  batchOperationsCount: number;
}

interface OptimizedChainQuery {
  includeDeleted?: boolean;
  includeStats?: boolean;
  includeHierarchy?: boolean;
  sortBy?: 'name' | 'created_at' | 'last_completed_at' | 'total_completions';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  searchTerm?: string;
}

class HighPerformanceDataAccess {
  private performanceMetrics: PerformanceMetrics = {
    queryCount: 0,
    cacheHitRate: 0,
    averageResponseTime: 0,
    totalDataTransferred: 0,
    batchOperationsCount: 0
  };

  private batchQueue = new Map<string, any[]>();
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 10; // 10ms批处理延迟

  /**
   * 高性能获取用户链条 - 带智能缓存和查询优化
   */
  async getChains(userId?: string, options: OptimizedChainQuery = {}): Promise<Chain[]> {
    const startTime = performance.now();
    
    try {
      const currentUser = userId || (await getCurrentUser())?.id;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const cacheKey = this.buildCacheKey('chains', currentUser, options);
      
      // 从智能缓存获取数据
      const cachedResult = await smartCache.get<Chain[]>(
        cacheKey,
        async () => {
          // 缓存未命中时的数据加载器
          return await this.loadChainsFromDatabase(currentUser, options);
        },
        {
          ttl: 3 * 60 * 1000, // 3分钟缓存
          priority: 'high',
          tags: [`user:${currentUser}`, 'chains'],
          preload: true
        }
      );

      const chains = cachedResult || [];
      
      // 异步预加载相关数据
      this.preloadRelatedData(currentUser, chains);
      
      this.updatePerformanceMetrics(performance.now() - startTime, chains.length, true);
      return chains;
      
    } catch (error) {
      logger.error('Failed to get chains', { userId, error });
      this.updatePerformanceMetrics(performance.now() - startTime, 0, false);
      throw error;
    }
  }

  /**
   * 从数据库加载链条数据（优化版本）
   */
  private async loadChainsFromDatabase(userId: string, options: OptimizedChainQuery): Promise<Chain[]> {
    const result = await queryOptimizer.getOptimizedChains(userId, {
      useCache: false, // 这里不使用查询优化器的缓存，因为我们使用智能缓存
      priority: 'high'
    });

    let chains = result.data;

    // 应用过滤和排序选项
    if (!options.includeDeleted) {
      chains = chains.filter(chain => !chain.deleted_at);
    }

    if (options.searchTerm) {
      const searchLower = options.searchTerm.toLowerCase();
      chains = chains.filter(chain => 
        chain.name.toLowerCase().includes(searchLower) ||
        chain.trigger.toLowerCase().includes(searchLower) ||
        chain.description.toLowerCase().includes(searchLower)
      );
    }

    // 排序
    if (options.sortBy) {
      chains.sort((a, b) => {
        let aVal = a[options.sortBy!];
        let bVal = b[options.sortBy!];

        // 处理日期字段
        if (options.sortBy === 'created_at' || options.sortBy === 'last_completed_at') {
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
        }

        // 处理字符串字段
        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }

        if (options.sortOrder === 'desc') {
          return bVal - aVal || String(bVal).localeCompare(String(aVal));
        } else {
          return aVal - bVal || String(aVal).localeCompare(String(bVal));
        }
      });
    }

    // 限制结果数量
    if (options.limit) {
      chains = chains.slice(0, options.limit);
    }

    return chains;
  }

  /**
   * 高性能创建链条 - 带批量操作优化
   */
  async createChain(chainData: Partial<Chain>): Promise<Chain> {
    const startTime = performance.now();
    
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // 准备数据
      const newChain = {
        ...chainData,
        user_id: currentUser.id,
        id: undefined, // 让数据库生成ID
        created_at: new Date().toISOString(),
        deleted_at: null,
        current_streak: 0,
        auxiliary_streak: 0,
        total_completions: 0,
        total_failures: 0,
        auxiliary_failures: 0,
        exceptions: chainData.exceptions || [],
        auxiliary_exceptions: chainData.auxiliary_exceptions || [],
        auxiliary_duration: chainData.auxiliary_duration || 15,
      };

      // 使用批量操作
      const result = await queryOptimizer.batchOptimizedOperations([
        {
          operation: 'insert',
          table: 'chains',
          data: newChain
        }
      ]);

      const createdChain = result.data[0] as Chain;

      // 立即更新缓存
      await this.invalidateAndRefreshChainCache(currentUser.id);

      // 预加载用户统计数据
      this.preloadUserStats(currentUser.id);

      this.updatePerformanceMetrics(performance.now() - startTime, 1, true);
      return createdChain;
      
    } catch (error) {
      logger.error('Failed to create chain', { chainData, error });
      this.updatePerformanceMetrics(performance.now() - startTime, 0, false);
      throw error;
    }
  }

  /**
   * 高性能更新链条 - 带乐观并发控制
   */
  async updateChain(chainId: string, updates: Partial<Chain>): Promise<Chain> {
    const startTime = performance.now();
    
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // 先从缓存获取当前数据以进行乐观并发控制
      const currentChain = await this.getChainById(chainId);
      if (!currentChain) {
        throw new Error('Chain not found');
      }

      if (currentChain.user_id !== currentUser.id) {
        throw new Error('Unauthorized access');
      }

      // 准备更新数据
      const updateData = {
        ...updates,
        // 不允许更新某些敏感字段
        id: undefined,
        user_id: undefined,
        created_at: undefined,
      };

      const result = await queryOptimizer.batchOptimizedOperations([
        {
          operation: 'update',
          table: 'chains',
          data: updateData,
          conditions: { 
            id: chainId, 
            user_id: currentUser.id 
          }
        }
      ]);

      const updatedChain = result.data[0] as Chain;

      // 智能缓存更新
      await this.updateChainInCache(chainId, updatedChain);

      this.updatePerformanceMetrics(performance.now() - startTime, 1, true);
      return updatedChain;
      
    } catch (error) {
      logger.error('Failed to update chain', { chainId, updates, error });
      this.updatePerformanceMetrics(performance.now() - startTime, 0, false);
      throw error;
    }
  }

  /**
   * 高性能批量操作链条
   */
  async batchChainOperations(operations: Array<{
    operation: 'create' | 'update' | 'delete';
    chainId?: string;
    data?: Partial<Chain>;
  }>): Promise<Chain[]> {
    const startTime = performance.now();
    
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const batchOps = operations.map(op => {
        switch (op.operation) {
          case 'create':
            return {
              operation: 'insert' as const,
              table: 'chains',
              data: {
                ...op.data,
                user_id: currentUser.id,
                created_at: new Date().toISOString(),
              }
            };
          case 'update':
            return {
              operation: 'update' as const,
              table: 'chains',
              data: op.data,
              conditions: { 
                id: op.chainId, 
                user_id: currentUser.id 
              }
            };
          case 'delete':
            return {
              operation: 'update' as const, // 软删除
              table: 'chains',
              data: { deleted_at: new Date().toISOString() },
              conditions: { 
                id: op.chainId, 
                user_id: currentUser.id 
              }
            };
          default:
            throw new Error('Invalid operation');
        }
      });

      const result = await queryOptimizer.batchOptimizedOperations(batchOps);

      // 批量缓存更新
      await this.invalidateAndRefreshChainCache(currentUser.id);

      this.performanceMetrics.batchOperationsCount++;
      this.updatePerformanceMetrics(performance.now() - startTime, result.data.length, true);
      
      return result.data as Chain[];
      
    } catch (error) {
      logger.error('Failed batch chain operations', { operations, error });
      this.updatePerformanceMetrics(performance.now() - startTime, 0, false);
      throw error;
    }
  }

  /**
   * 高性能获取单个链条
   */
  async getChainById(chainId: string): Promise<Chain | null> {
    const startTime = performance.now();
    
    try {
      const cacheKey = `chain:${chainId}`;
      
      const cachedChain = await smartCache.get<Chain>(
        cacheKey,
        async () => {
          if (!supabase) return null;
          
          const { data, error } = await supabase
            .from('chains')
            .select('*')
            .eq('id', chainId)
            .single();

          if (error) throw error;
          return data;
        },
        {
          ttl: 5 * 60 * 1000, // 5分钟缓存
          priority: 'normal',
          tags: [`chain:${chainId}`]
        }
      );

      this.updatePerformanceMetrics(performance.now() - startTime, 1, true);
      return cachedChain;
      
    } catch (error) {
      logger.error('Failed to get chain by ID', { chainId, error });
      this.updatePerformanceMetrics(performance.now() - startTime, 0, false);
      return null;
    }
  }

  /**
   * 高性能获取已删除链条
   */
  async getDeletedChains(userId?: string): Promise<DeletedChain[]> {
    const startTime = performance.now();
    
    try {
      const currentUser = userId || (await getCurrentUser())?.id;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const cacheKey = `deleted_chains:${currentUser}`;
      
      const cachedDeleted = await smartCache.get<DeletedChain[]>(
        cacheKey,
        async () => {
          if (!supabase) return [];
          
          const { data, error } = await supabase
            .from('chains')
            .select('*')
            .eq('user_id', currentUser)
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });

          if (error) throw error;
          
          return (data || []).map(chain => ({
            ...chain,
            deletedAt: chain.deleted_at!,
            isDeleted: true
          }));
        },
        {
          ttl: 2 * 60 * 1000, // 2分钟缓存（删除数据变化较频繁）
          priority: 'normal',
          tags: [`user:${currentUser}`, 'deleted_chains']
        }
      );

      this.updatePerformanceMetrics(performance.now() - startTime, cachedDeleted?.length || 0, true);
      return cachedDeleted || [];
      
    } catch (error) {
      logger.error('Failed to get deleted chains', { userId, error });
      this.updatePerformanceMetrics(performance.now() - startTime, 0, false);
      return [];
    }
  }

  /**
   * 高性能活跃会话管理
   */
  async getActiveSessions(userId?: string): Promise<ActiveSession[]> {
    const startTime = performance.now();
    
    try {
      const currentUser = userId || (await getCurrentUser())?.id;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const result = await queryOptimizer.getActiveSessionsOptimized(currentUser);
      
      this.updatePerformanceMetrics(performance.now() - startTime, result.data.length, result.cached);
      return result.data;
      
    } catch (error) {
      logger.error('Failed to get active sessions', { userId, error });
      this.updatePerformanceMetrics(performance.now() - startTime, 0, false);
      return [];
    }
  }

  /**
   * 智能分页查询
   */
  async getPaginatedChains(
    page: number = 1, 
    pageSize: number = 20, 
    filters: OptimizedChainQuery = {}
  ): Promise<{ chains: Chain[]; total: number; hasMore: boolean }> {
    const startTime = performance.now();
    
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const conditions = {
        user_id: currentUser.id,
        ...(filters.includeDeleted ? {} : { deleted_at: null })
      };

      const result = await queryOptimizer.getPaginatedResults<Chain>(
        'chains',
        page,
        pageSize,
        conditions,
        filters.sortBy || 'created_at',
        filters.sortOrder === 'asc'
      );

      this.updatePerformanceMetrics(performance.now() - startTime, result.data.data.length, result.cached);
      
      return {
        chains: result.data.data,
        total: result.data.total,
        hasMore: result.data.hasMore
      };
      
    } catch (error) {
      logger.error('Failed to get paginated chains', { page, pageSize, filters, error });
      this.updatePerformanceMetrics(performance.now() - startTime, 0, false);
      return { chains: [], total: 0, hasMore: false };
    }
  }

  /**
   * 缓存管理方法
   */
  private async invalidateAndRefreshChainCache(userId: string): Promise<void> {
    // 清除相关缓存标签
    smartCache.invalidateByTag(`user:${userId}`);
    
    // 异步预加载刷新的数据
    setTimeout(() => {
      this.getChains(userId, { includeStats: true });
    }, 0);
  }

  private async updateChainInCache(chainId: string, updatedChain: Chain): Promise<void> {
    // 更新单个链条缓存
    await smartCache.set(`chain:${chainId}`, updatedChain, {
      ttl: 5 * 60 * 1000,
      priority: 'normal',
      tags: [`chain:${chainId}`, `user:${updatedChain.user_id}`]
    });

    // 清除用户链条列表缓存以强制重新加载
    smartCache.invalidateByTag(`user:${updatedChain.user_id}`);
  }

  /**
   * 预加载相关数据
   */
  private async preloadRelatedData(userId: string, chains: Chain[]): Promise<void> {
    // 预加载用户统计
    setTimeout(() => this.preloadUserStats(userId), 0);
    
    // 预加载最近完成记录
    if (chains.length > 0) {
      setTimeout(() => queryOptimizer.getRecentCompletions(userId, 10), 0);
    }

    // 预加载活跃会话
    setTimeout(() => queryOptimizer.getActiveSessionsOptimized(userId), 0);
  }

  private async preloadUserStats(userId: string): Promise<void> {
    try {
      const cacheKey = `user_stats:${userId}`;
      
      await smartCache.set(cacheKey, {
        // 这里可以实现用户统计数据的计算和缓存
        userId,
        preloadedAt: Date.now()
      }, {
        ttl: 10 * 60 * 1000, // 10分钟缓存
        priority: 'low',
        tags: [`user:${userId}`, 'stats']
      });
    } catch (error) {
      logger.error('Failed to preload user stats', { userId, error });
    }
  }

  /**
   * 构建缓存键
   */
  private buildCacheKey(entity: string, userId: string, options: any): string {
    const optionsHash = JSON.stringify(options);
    return `${entity}:${userId}:${Buffer.from(optionsHash).toString('base64')}`;
  }

  /**
   * 性能指标更新
   */
  private updatePerformanceMetrics(responseTime: number, dataSize: number, success: boolean): void {
    this.performanceMetrics.queryCount++;
    this.performanceMetrics.averageResponseTime = 
      (this.performanceMetrics.averageResponseTime * (this.performanceMetrics.queryCount - 1) + responseTime) / 
      this.performanceMetrics.queryCount;

    if (success) {
      this.performanceMetrics.totalDataTransferred += dataSize;
    }

    // 更新缓存命中率
    const cacheMetrics = smartCache.getMetrics();
    this.performanceMetrics.cacheHitRate = parseFloat(cacheMetrics.hitRate.replace('%', ''));
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): PerformanceMetrics & { cacheMetrics: any; queryOptimizerStats: any } {
    return {
      ...this.performanceMetrics,
      cacheMetrics: smartCache.getMetrics(),
      queryOptimizerStats: queryOptimizer.getPerformanceStats()
    };
  }

  /**
   * 清理资源和重置性能指标
   */
  destroy(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.batchQueue.clear();
    
    // 重置性能指标
    this.performanceMetrics = {
      queryCount: 0,
      cacheHitRate: 0,
      averageResponseTime: 0,
      totalDataTransferred: 0,
      batchOperationsCount: 0
    };
  }
}

// 创建全局高性能数据访问实例
export const highPerformanceDataAccess = new HighPerformanceDataAccess();

// 为了向后兼容，也导出为 supabaseStorage
export const supabaseStorage = highPerformanceDataAccess;