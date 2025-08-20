import { supabase } from '../lib/supabase';
import { logger } from './logger';

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface TableInfo {
  table_name: string;
  columns: ColumnInfo[];
}

interface SchemaStatus {
  tablesExist: boolean;
  missingTables: string[];
  missingColumns: Record<string, string[]>;
  extraColumns: Record<string, string[]>;
  migrationStatus: 'complete' | 'partial' | 'missing';
  recommendations: string[];
}

const EXPECTED_SCHEMA = {
  chains: [
    'id', 'name', 'parent_id', 'type', 'sort_order', 'trigger', 'duration', 
    'description', 'current_streak', 'auxiliary_streak', 'total_completions', 
    'total_failures', 'auxiliary_failures', 'exceptions', 'auxiliary_exceptions', 
    'auxiliary_signal', 'auxiliary_duration', 'auxiliary_completion_trigger', 
    'created_at', 'last_completed_at', 'user_id', 'is_durationless', 
    'time_limit_hours', 'time_limit_exceptions', 'group_started_at', 'group_expires_at',
    'deleted_at'
  ],
  scheduled_sessions: [
    'id', 'chain_id', 'scheduled_at', 'expires_at', 'auxiliary_signal', 'user_id'
  ],
  active_sessions: [
    'id', 'chain_id', 'started_at', 'duration', 'is_paused', 'paused_at', 
    'total_paused_time', 'user_id'
  ],
  completion_history: [
    'id', 'chain_id', 'completed_at', 'duration', 'was_successful', 
    'reason_for_failure', 'user_id'
  ],
  rsip_nodes: [
    'id', 'user_id', 'parent_id', 'title', 'rule', 'sort_order', 
    'use_timer', 'timer_minutes', 'created_at'
  ],
  rsip_meta: [
    'user_id', 'last_added_at', 'allow_multiple_per_day'
  ]
};

export class SchemaChecker {
  private schemaCache: Map<string, { result: TableInfo | null; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes cache

  /**
   * Clear schema cache
   */
  clearSchemaCache(): void {
    this.schemaCache.clear();
    logger.info('SCHEMA', '架构缓存已清除');
  }

  async getTableInfo(tableName: string): Promise<TableInfo | null> {
    // Check cache first
    const cached = this.schemaCache.get(tableName);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
      logger.debug('SCHEMA', `使用缓存的表信息: ${tableName}`);
      return cached.result;
    }
    try {
      const { data, error } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_name', tableName)
        .eq('table_schema', 'public');

      if (error) {
        logger.error('SCHEMA', `获取表 ${tableName} 信息失败`, { error: error.message });
        // Cache null result to avoid repeated failed queries
        this.schemaCache.set(tableName, { result: null, timestamp: now });
        return null;
      }

      const result: TableInfo = {
        table_name: tableName,
        columns: data || []
      };
      
      // Cache successful result
      this.schemaCache.set(tableName, { result, timestamp: now });
      
      return result;
    } catch (error) {
      logger.error('SCHEMA', `查询表 ${tableName} 时发生异常`, { error });
      // Cache null result to avoid repeated failed queries
      this.schemaCache.set(tableName, { result: null, timestamp: now });
      return null;
    }
  }

  async checkAllTables(): Promise<Record<string, TableInfo | null>> {
    const results: Record<string, TableInfo | null> = {};
    
    for (const tableName of Object.keys(EXPECTED_SCHEMA)) {
      results[tableName] = await this.getTableInfo(tableName);
    }
    
    return results;
  }

  async getSchemaStatus(): Promise<SchemaStatus> {
    logger.info('SCHEMA', '开始检查数据库架构状态');
    
    const tableInfos = await this.checkAllTables();
    const missingTables: string[] = [];
    const missingColumns: Record<string, string[]> = {};
    const extraColumns: Record<string, string[]> = {};
    
    for (const [tableName, expectedColumns] of Object.entries(EXPECTED_SCHEMA)) {
      const tableInfo = tableInfos[tableName];
      
      if (!tableInfo || !tableInfo.columns.length) {
        missingTables.push(tableName);
        logger.warn('SCHEMA', `表 ${tableName} 不存在或无法访问`);
        continue;
      }
      
      const actualColumns = tableInfo.columns.map(col => col.column_name);
      const missing = expectedColumns.filter(col => !actualColumns.includes(col));
      const extra = actualColumns.filter(col => !expectedColumns.includes(col));
      
      if (missing.length > 0) {
        missingColumns[tableName] = missing;
        logger.warn('SCHEMA', `表 ${tableName} 缺少列`, { missingColumns: missing });
      }
      
      if (extra.length > 0) {
        extraColumns[tableName] = extra;
        logger.info('SCHEMA', `表 ${tableName} 有额外列`, { extraColumns: extra });
      }
    }
    
    // Determine migration status
    let migrationStatus: 'complete' | 'partial' | 'missing';
    if (missingTables.length > 0) {
      migrationStatus = 'missing';
    } else if (Object.keys(missingColumns).length > 0) {
      migrationStatus = 'partial';
    } else {
      migrationStatus = 'complete';
    }
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (missingTables.length > 0) {
      recommendations.push(`需要创建以下表: ${missingTables.join(', ')}`);
      recommendations.push('运行基础迁移脚本 20250730021823_winter_flame.sql');
    }
    
    if (missingColumns.chains?.includes('parent_id') || missingColumns.chains?.includes('type')) {
      recommendations.push('运行任务群支持迁移: 20250801160754_peaceful_palace.sql');
    }
    
    if (missingColumns.chains?.includes('time_limit_hours') || missingColumns.chains?.includes('group_expires_at')) {
      recommendations.push('运行时间限制迁移: 20250808000000_add_group_time_limit.sql');
    }
    
    if (missingColumns.chains?.includes('is_durationless')) {
      recommendations.push('运行无时长任务迁移: 20250808001000_add_durationless_flag.sql');
    }
    
    if (missingColumns.chains?.includes('deleted_at')) {
      recommendations.push('运行软删除功能迁移: 20250814000000_add_soft_delete.sql');
    }
    
    if (missingTables.includes('rsip_nodes') || missingTables.includes('rsip_meta')) {
      recommendations.push('运行RSIP功能迁移: 20250810000000_add_rsip_tables.sql');
    }
    
    if (Object.keys(missingColumns).length === 0 && missingTables.length === 0) {
      recommendations.push('数据库架构完整，建议运行性能优化索引脚本以提升查询性能');
    }
    
    const status: SchemaStatus = {
      tablesExist: missingTables.length === 0,
      missingTables,
      missingColumns,
      extraColumns,
      migrationStatus,
      recommendations
    };
    
    logger.info('SCHEMA', '架构检查完成', {
      migrationStatus,
      missingTablesCount: missingTables.length,
      missingColumnsCount: Object.keys(missingColumns).length
    });
    
    return status;
  }

  async generateMigrationReport(): Promise<string> {
    const status = await this.getSchemaStatus();
    
    let report = '# 数据库架构状态报告\n\n';
    report += `生成时间: ${new Date().toISOString()}\n`;
    report += `迁移状态: ${status.migrationStatus}\n\n`;
    
    if (status.missingTables.length > 0) {
      report += '## 缺失的表\n';
      status.missingTables.forEach(table => {
        report += `- ${table}\n`;
      });
      report += '\n';
    }
    
    if (Object.keys(status.missingColumns).length > 0) {
      report += '## 缺失的列\n';
      Object.entries(status.missingColumns).forEach(([table, columns]) => {
        report += `### ${table}\n`;
        columns.forEach(column => {
          report += `- ${column}\n`;
        });
        report += '\n';
      });
    }
    
    if (Object.keys(status.extraColumns).length > 0) {
      report += '## 额外的列\n';
      Object.entries(status.extraColumns).forEach(([table, columns]) => {
        report += `### ${table}\n`;
        columns.forEach(column => {
          report += `- ${column}\n`;
        });
        report += '\n';
      });
    }
    
    if (status.recommendations.length > 0) {
      report += '## 建议的操作\n';
      status.recommendations.forEach((rec, index) => {
        report += `${index + 1}. ${rec}\n`;
      });
      report += '\n';
    }
    
    return report;
  }
}

export const schemaChecker = new SchemaChecker();