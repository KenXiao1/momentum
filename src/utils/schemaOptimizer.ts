import { supabase } from '../lib/supabase';
import { logger } from './logger';
import { schemaChecker } from './schemaChecker';

/**
 * Database Schema Optimization Helper
 * 
 * This helper provides utilities for optimizing database performance,
 * managing schema migrations, and monitoring database health.
 */
export class SchemaOptimizer {
  private static instance: SchemaOptimizer;
  private optimizationCache: Map<string, { timestamp: number; result: any }> = new Map();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  public static getInstance(): SchemaOptimizer {
    if (!SchemaOptimizer.instance) {
      SchemaOptimizer.instance = new SchemaOptimizer();
    }
    return SchemaOptimizer.instance;
  }

  /**
   * Run performance optimization checks and apply fixes if needed
   */
  async optimizeDatabase(): Promise<{
    success: boolean;
    optimizations: string[];
    errors: string[];
  }> {
    const optimizations: string[] = [];
    const errors: string[] = [];

    try {
      logger.info('SCHEMA_OPTIMIZER', '开始数据库性能优化检查');

      // 1. Check and create missing indexes
      const indexResults = await this.ensurePerformanceIndexes();
      optimizations.push(...indexResults.created);
      if (indexResults.errors.length > 0) {
        errors.push(...indexResults.errors);
      }

      // 2. Analyze table statistics for query optimizer
      const analyzeResults = await this.updateTableStatistics();
      if (analyzeResults.success) {
        optimizations.push('已更新数据库统计信息以优化查询计划');
      } else {
        errors.push(analyzeResults.error || '更新统计信息失败');
      }

      // 3. Check for performance bottlenecks
      const bottleneckResults = await this.checkPerformanceBottlenecks();
      if (bottleneckResults.recommendations.length > 0) {
        optimizations.push(...bottleneckResults.recommendations);
      }

      logger.info('SCHEMA_OPTIMIZER', '数据库优化完成', {
        optimizationsCount: optimizations.length,
        errorsCount: errors.length
      });

      return {
        success: errors.length === 0,
        optimizations,
        errors
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      logger.error('SCHEMA_OPTIMIZER', '数据库优化过程中发生异常', { error: errorMsg });
      errors.push(`优化过程异常: ${errorMsg}`);
      
      return {
        success: false,
        optimizations,
        errors
      };
    }
  }

  /**
   * Ensure all performance indexes exist
   */
  private async ensurePerformanceIndexes(): Promise<{
    created: string[];
    errors: string[];
  }> {
    const created: string[] = [];
    const errors: string[] = [];
    
    const performanceIndexes = [
      {
        name: 'idx_chains_user_active_performance',
        table: 'chains',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chains_user_active_performance ON chains(user_id) WHERE deleted_at IS NULL',
        description: '用户活跃链条查询索引'
      },
      {
        name: 'idx_chains_parent_hierarchy_performance',
        table: 'chains',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chains_parent_hierarchy_performance ON chains(parent_id, sort_order) WHERE deleted_at IS NULL',
        description: '链条层次结构索引'
      },
      {
        name: 'idx_completion_history_recent_performance',
        table: 'completion_history',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_completion_history_recent_performance ON completion_history(user_id, completed_at DESC)',
        description: '用户完成历史时间排序索引'
      }
    ];

    for (const index of performanceIndexes) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: index.definition });
        
        if (error) {
          if (!error.message?.includes('already exists')) {
            errors.push(`创建索引 ${index.name} 失败: ${error.message}`);
          }
        } else {
          created.push(`创建性能索引: ${index.description}`);
        }
      } catch (error) {
        errors.push(`创建索引 ${index.name} 异常: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }

    return { created, errors };
  }

  /**
   * Update table statistics for query optimizer
   */
  private async updateTableStatistics(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const tables = ['chains', 'scheduled_sessions', 'active_sessions', 'completion_history', 'rsip_nodes', 'rsip_meta'];
      
      for (const table of tables) {
        const { error } = await supabase.rpc('exec_sql', { 
          sql: `ANALYZE ${table}` 
        });
        
        if (error && !error.message?.includes('does not exist')) {
          console.warn(`更新表 ${table} 统计信息时警告:`, error.message);
        }
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * Check for performance bottlenecks and provide recommendations
   */
  private async checkPerformanceBottlenecks(): Promise<{
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    
    try {
      // Check schema status
      const schemaStatus = await schemaChecker.getSchemaStatus();
      
      if (schemaStatus.migrationStatus !== 'complete') {
        recommendations.push('数据库架构不完整，建议运行完整的架构迁移');
      }
      
      // Check for missing columns that affect performance
      if (schemaStatus.missingColumns.chains?.includes('deleted_at')) {
        recommendations.push('缺少 deleted_at 字段会影响软删除查询性能');
      }
      
      if (schemaStatus.missingColumns.chains?.includes('is_durationless')) {
        recommendations.push('缺少 is_durationless 字段会影响任务类型查询性能');
      }

      // General performance recommendations
      if (recommendations.length === 0) {
        recommendations.push('数据库架构完整，建议定期运行 VACUUM ANALYZE 以维护性能');
      }
      
    } catch (error) {
      recommendations.push('无法检查性能瓶颈，建议手动检查数据库状态');
    }
    
    return { recommendations };
  }

  /**
   * Get cached optimization status
   */
  async getOptimizationStatus(forceRefresh: boolean = false): Promise<{
    isOptimized: boolean;
    lastOptimized?: Date;
    issues: string[];
    recommendations: string[];
  }> {
    const cacheKey = 'optimization_status';
    const now = Date.now();
    
    if (!forceRefresh) {
      const cached = this.optimizationCache.get(cacheKey);
      if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
        return cached.result;
      }
    }

    try {
      const schemaStatus = await schemaChecker.getSchemaStatus();
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Check for critical issues
      if (schemaStatus.missingTables.length > 0) {
        issues.push(`缺少数据表: ${schemaStatus.missingTables.join(', ')}`);
        recommendations.push('运行基础架构迁移脚本');
      }

      if (Object.keys(schemaStatus.missingColumns).length > 0) {
        Object.entries(schemaStatus.missingColumns).forEach(([table, columns]) => {
          issues.push(`表 ${table} 缺少字段: ${columns.join(', ')}`);
        });
        recommendations.push('运行架构更新迁移脚本');
      }

      const result = {
        isOptimized: issues.length === 0,
        lastOptimized: issues.length === 0 ? new Date() : undefined,
        issues,
        recommendations: recommendations.length > 0 ? recommendations : schemaStatus.recommendations
      };

      // Cache the result
      this.optimizationCache.set(cacheKey, {
        timestamp: now,
        result
      });

      return result;
    } catch (error) {
      const errorResult = {
        isOptimized: false,
        issues: [`检查优化状态失败: ${error instanceof Error ? error.message : '未知错误'}`],
        recommendations: ['手动检查数据库连接和权限设置']
      };

      return errorResult;
    }
  }

  /**
   * Clear optimization cache
   */
  clearCache(): void {
    this.optimizationCache.clear();
    logger.info('SCHEMA_OPTIMIZER', '已清除优化状态缓存');
  }
}

export const schemaOptimizer = SchemaOptimizer.getInstance();