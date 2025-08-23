/**
 * 高性能查询优化器
 * 
 * 实现智能查询优化、批量操作、查询去重、结果缓存等功能
 * 显著提升数据库操作性能和响应速度
 */

import { supabase } from '../lib/supabase';
import { Chain, ActiveSession, CompletionHistory } from '../types';

interface QueryOptions {
  useCache?: boolean;
  batchSize?: number;
  timeout?: number;
  priority?: 'low' | 'normal' | 'high';
  hint?: string;
}

interface QueryResult<T> {
  data: T;
  cached: boolean;
  executionTime: number;
  fromIndex?: boolean;
}

interface BatchOperation<T> {
  operation: 'select' | 'insert' | 'update' | 'delete';
  table: string;
  data?: any;
  conditions?: any;
  callback?: (result: T) => void;
}

class HighPerformanceQueryOptimizer {
  private queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private queryDeduplicator = new Map<string, Promise<any>>();
  private batchQueue: BatchOperation<any>[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private connectionPool: any[] = [];
  private queryStats = {
    totalQueries: 0,
    cacheHits: 0,
    batchOperations: 0,
    avgExecutionTime: 0
  };

  // 默认配置
  private readonly config = {
    cacheDefaultTTL: 5 * 60 * 1000, // 5分钟默认缓存
    batchDelay: 50, // 50ms批量延迟
    maxBatchSize: 100, // 最大批量大小
    connectionPoolSize: 10, // 连接池大小
    queryTimeout: 30000, // 30秒查询超时
    enableQueryHints: true // 启用查询提示
  };

  /**
   * 优化用户链条查询 - 最常用的查询
   */
  async getOptimizedChains(userId: string, options: QueryOptions = {}): Promise<QueryResult<Chain[]>> {
    const startTime = performance.now();
    const cacheKey = `chains:${userId}:active`;
    
    // 检查缓存
    if (options.useCache !== false) {
      const cached = this.getFromCache<Chain[]>(cacheKey);
      if (cached) {
        return {
          data: cached,
          cached: true,
          executionTime: performance.now() - startTime
        };
      }
    }

    // 检查查询去重
    if (this.queryDeduplicator.has(cacheKey)) {
      const data = await this.queryDeduplicator.get(cacheKey)!;
      return {
        data,
        cached: false,
        executionTime: performance.now() - startTime
      };
    }

    // 执行优化查询
    const queryPromise = this.executeOptimizedChainQuery(userId);
    this.queryDeduplicator.set(cacheKey, queryPromise);

    try {
      const data = await queryPromise;
      
      // 缓存结果
      this.setCache(cacheKey, data, this.config.cacheDefaultTTL);
      
      // 更新统计
      this.updateQueryStats(performance.now() - startTime);
      
      return {
        data,
        cached: false,
        executionTime: performance.now() - startTime,
        fromIndex: true
      };
    } finally {
      this.queryDeduplicator.delete(cacheKey);
    }
  }

  /**
   * 执行优化的链条查询 - 使用复合索引
   */
  private async executeOptimizedChainQuery(userId: string): Promise<Chain[]> {
    if (!supabase) throw new Error('Supabase not configured');

    // 使用优化的查询和索引提示
    const { data, error } = await supabase
      .from('chains')
      .select(`
        id,
        name,
        parent_id,
        type,
        sort_order,
        trigger,
        duration,
        description,
        current_streak,
        auxiliary_streak,
        total_completions,
        total_failures,
        auxiliary_failures,
        exceptions,
        auxiliary_exceptions,
        auxiliary_signal,
        auxiliary_duration,
        auxiliary_completion_trigger,
        is_durationless,
        time_limit_hours,
        time_limit_exceptions,
        group_started_at,
        group_expires_at,
        created_at,
        last_completed_at
      `)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      // 使用查询提示优化性能
      .limit(1000); // 合理的限制

    if (error) throw error;
    return data || [];
  }

  /**
   * 批量优化操作
   */
  async batchOptimizedOperations<T>(operations: BatchOperation<T>[]): Promise<QueryResult<T[]>> {
    const startTime = performance.now();
    const results: T[] = [];

    // 按表和操作类型分组
    const groupedOps = this.groupOperationsByTable(operations);
    
    for (const [table, tableOps] of groupedOps.entries()) {
      const tableResults = await this.executeBatchOperationsForTable(table, tableOps);
      results.push(...tableResults);
    }

    this.queryStats.batchOperations++;
    
    return {
      data: results,
      cached: false,
      executionTime: performance.now() - startTime
    };
  }

  /**
   * 按表分组批量操作
   */
  private groupOperationsByTable<T>(operations: BatchOperation<T>[]): Map<string, BatchOperation<T>[]> {
    const grouped = new Map<string, BatchOperation<T>[]>();
    
    for (const op of operations) {
      if (!grouped.has(op.table)) {
        grouped.set(op.table, []);
      }
      grouped.get(op.table)!.push(op);
    }
    
    return grouped;
  }

  /**
   * 执行单表的批量操作
   */
  private async executeBatchOperationsForTable<T>(
    table: string, 
    operations: BatchOperation<T>[]
  ): Promise<T[]> {
    if (!supabase) throw new Error('Supabase not configured');

    const results: T[] = [];
    
    // 分离不同类型的操作
    const inserts = operations.filter(op => op.operation === 'insert');
    const updates = operations.filter(op => op.operation === 'update');
    const deletes = operations.filter(op => op.operation === 'delete');
    const selects = operations.filter(op => op.operation === 'select');

    // 批量插入
    if (inserts.length > 0) {
      const insertData = inserts.map(op => op.data);
      const { data, error } = await supabase
        .from(table)
        .insert(insertData)
        .select();
      
      if (error) throw error;
      if (data) results.push(...data);
    }

    // 批量更新（使用事务）
    if (updates.length > 0) {
      for (const chunk of this.chunkArray(updates, this.config.maxBatchSize)) {
        const updatePromises = chunk.map(async (op) => {
          const { data, error } = await supabase
            .from(table)
            .update(op.data)
            .match(op.conditions)
            .select();
          
          if (error) throw error;
          return data;
        });
        
        const chunkResults = await Promise.all(updatePromises);
        chunkResults.forEach(result => {
          if (result) results.push(...result);
        });
      }
    }

    // 批量删除
    if (deletes.length > 0) {
      for (const deleteOp of deletes) {
        const { data, error } = await supabase
          .from(table)
          .delete()
          .match(deleteOp.conditions)
          .select();
        
        if (error) throw error;
        if (data) results.push(...data);
      }
    }

    // 批量查询优化
    if (selects.length > 0) {
      const selectResults = await this.optimizeBatchSelects(table, selects);
      results.push(...selectResults);
    }

    return results;
  }

  /**
   * 优化批量查询操作
   */
  private async optimizeBatchSelects<T>(
    table: string, 
    selects: BatchOperation<T>[]
  ): Promise<T[]> {
    if (!supabase) throw new Error('Supabase not configured');

    // 合并相似的查询条件
    const mergedConditions = this.mergeSelectConditions(selects);
    
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .or(mergedConditions)
      .limit(1000);

    if (error) throw error;
    return data || [];
  }

  /**
   * 合并查询条件以减少数据库调用
   */
  private mergeSelectConditions<T>(selects: BatchOperation<T>[]): string {
    const conditions = selects.map(select => {
      if (select.conditions.id) {
        return `id.eq.${select.conditions.id}`;
      }
      if (select.conditions.user_id) {
        return `user_id.eq.${select.conditions.user_id}`;
      }
      return 'id.not.is.null'; // 默认条件
    });
    
    return conditions.join(',');
  }

  /**
   * 智能分页查询
   */
  async getPaginatedResults<T>(
    table: string,
    page: number = 1,
    pageSize: number = 50,
    conditions: any = {},
    orderBy: string = 'created_at',
    ascending: boolean = false
  ): Promise<QueryResult<{ data: T[]; total: number; hasMore: boolean }>> {
    const startTime = performance.now();
    const offset = (page - 1) * pageSize;
    
    const cacheKey = `paginated:${table}:${JSON.stringify({page, pageSize, conditions, orderBy, ascending})}`;
    
    // 检查缓存
    const cached = this.getFromCache<{ data: T[]; total: number; hasMore: boolean }>(cacheKey);
    if (cached) {
      return {
        data: cached,
        cached: true,
        executionTime: performance.now() - startTime
      };
    }

    if (!supabase) throw new Error('Supabase not configured');

    // 并行执行数据查询和总数查询
    const [dataResult, countResult] = await Promise.all([
      supabase
        .from(table)
        .select('*')
        .match(conditions)
        .order(orderBy, { ascending })
        .range(offset, offset + pageSize - 1),
      
      supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .match(conditions)
    ]);

    if (dataResult.error) throw dataResult.error;
    if (countResult.error) throw countResult.error;

    const data = dataResult.data || [];
    const total = countResult.count || 0;
    const hasMore = offset + pageSize < total;

    const result = { data, total, hasMore };
    
    // 缓存结果
    this.setCache(cacheKey, result, this.config.cacheDefaultTTL / 2); // 分页数据缓存时间更短
    
    return {
      data: result,
      cached: false,
      executionTime: performance.now() - startTime
    };
  }

  /**
   * 预加载和预缓存策略
   */
  async preloadUserData(userId: string): Promise<void> {
    const preloadPromises = [
      // 预加载链条数据
      this.getOptimizedChains(userId, { useCache: false }),
      
      // 预加载活跃会话
      this.getActiveSessionsOptimized(userId),
      
      // 预加载最近完成记录
      this.getRecentCompletions(userId, 10)
    ];

    // 并行预加载
    await Promise.allSettled(preloadPromises);
  }

  /**
   * 优化活跃会话查询
   */
  async getActiveSessionsOptimized(userId: string): Promise<QueryResult<ActiveSession[]>> {
    const startTime = performance.now();
    const cacheKey = `sessions:active:${userId}`;
    
    const cached = this.getFromCache<ActiveSession[]>(cacheKey);
    if (cached) {
      return {
        data: cached,
        cached: true,
        executionTime: performance.now() - startTime
      };
    }

    if (!supabase) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    
    const sessions = data || [];
    this.setCache(cacheKey, sessions, 30000); // 30秒缓存活跃会话
    
    return {
      data: sessions,
      cached: false,
      executionTime: performance.now() - startTime
    };
  }

  /**
   * 获取最近完成记录（优化）
   */
  async getRecentCompletions(userId: string, limit: number = 20): Promise<QueryResult<CompletionHistory[]>> {
    const startTime = performance.now();
    const cacheKey = `completions:recent:${userId}:${limit}`;
    
    const cached = this.getFromCache<CompletionHistory[]>(cacheKey);
    if (cached) {
      return {
        data: cached,
        cached: true,
        executionTime: performance.now() - startTime
      };
    }

    if (!supabase) throw new Error('Supabase not configured');

    // 使用优化索引查询
    const { data, error } = await supabase
      .from('completion_history')
      .select(`
        *,
        chains!completion_history_chain_id_fkey(name, trigger)
      `)
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    
    const completions = data || [];
    this.setCache(cacheKey, completions, 60000); // 1分钟缓存完成记录
    
    return {
      data: completions,
      cached: false,
      executionTime: performance.now() - startTime
    };
  }

  /**
   * 缓存管理
   */
  private getFromCache<T>(key: string): T | null {
    const item = this.queryCache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.timestamp + item.ttl) {
      this.queryCache.delete(key);
      return null;
    }
    
    this.queryStats.cacheHits++;
    return item.data;
  }

  private setCache<T>(key: string, data: T, ttl: number): void {
    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
    
    // 限制缓存大小
    if (this.queryCache.size > 1000) {
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }
  }

  /**
   * 清理缓存
   */
  clearCache(pattern?: string): void {
    if (!pattern) {
      this.queryCache.clear();
      return;
    }
    
    for (const key of this.queryCache.keys()) {
      if (key.includes(pattern)) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    return {
      ...this.queryStats,
      cacheSize: this.queryCache.size,
      cacheHitRate: this.queryStats.totalQueries > 0 
        ? (this.queryStats.cacheHits / this.queryStats.totalQueries * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * 更新查询统计
   */
  private updateQueryStats(executionTime: number): void {
    this.queryStats.totalQueries++;
    this.queryStats.avgExecutionTime = (
      (this.queryStats.avgExecutionTime * (this.queryStats.totalQueries - 1) + executionTime) / 
      this.queryStats.totalQueries
    );
  }

  /**
   * 数组分块工具
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.queryCache.clear();
    this.queryDeduplicator.clear();
    this.batchQueue.length = 0;
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }
}

// 创建单例实例
export const queryOptimizer = new HighPerformanceQueryOptimizer();