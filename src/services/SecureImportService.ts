/**
 * 安全导入服务 - 面向所有用户的数据导入功能
 * 
 * 特性：
 * - 会话管理：30分钟有效期的导入会话
 * - 数据隔离：所有导入数据自动归属到当前用户
 * - ID重写：防止ID冲突，自动生成新的UUID
 * - 错误处理：详细的错误报告和恢复机制
 */

import { supabase } from '../lib/supabase';
import { Chain, CompletionHistory } from '../types';

export interface ImportSession {
  session_token: string;
  expires_at: string;
  success: boolean;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  imported_count: number;
  id_mapping: Record<string, string>;
  errors: string[];
  error?: string;
}

export interface SecureImportOptions {
  preserveStatistics?: boolean; // 是否保留统计数据（默认false，重置为0）
  preserveTimestamps?: boolean; // 是否保留时间戳（默认false，使用当前时间）
  importCompletionHistory?: boolean; // 是否导入完成历史（默认true）
}

export class SecureImportService {
  private static instance: SecureImportService;
  private currentSession: ImportSession | null = null;

  static getInstance(): SecureImportService {
    if (!SecureImportService.instance) {
      SecureImportService.instance = new SecureImportService();
    }
    return SecureImportService.instance;
  }

  /**
   * 创建新的导入会话
   */
  async createImportSession(): Promise<ImportSession> {
    try {
      const { data, error } = await supabase.rpc('create_import_session');

      if (error) {
        throw new Error(`Failed to create import session: ${error.message}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Unknown error creating import session');
      }

      this.currentSession = data;
      console.log('[SECURE_IMPORT] Created import session:', data.session_token);
      
      return data;
    } catch (error) {
      console.error('[SECURE_IMPORT] Failed to create session:', error);
      throw error;
    }
  }

  /**
   * 安全导入链条数据
   */
  async importChains(
    chains: Chain[], 
    options: SecureImportOptions = {}
  ): Promise<ImportResult> {
    try {
      // 确保有有效的导入会话
      if (!this.currentSession) {
        await this.createImportSession();
      }

      if (!this.currentSession) {
        throw new Error('Failed to create import session');
      }

      // 预处理链条数据
      const processedChains = this.preprocessChains(chains, options);

      console.log('[SECURE_IMPORT] Importing chains:', {
        sessionToken: this.currentSession.session_token,
        chainCount: processedChains.length,
        options
      });

      // 调用安全导入函数
      const { data, error } = await supabase.rpc('secure_import_chains', {
        p_session_token: this.currentSession.session_token,
        chains_data: processedChains
      });

      if (error) {
        throw new Error(`Import failed: ${error.message}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Unknown import error');
      }

      console.log('[SECURE_IMPORT] Import completed:', {
        imported: data.imported_count,
        errors: data.errors?.length || 0
      });

      return data;

    } catch (error) {
      console.error('[SECURE_IMPORT] Import failed:', error);
      throw error;
    }
  }

  /**
   * 预处理链条数据
   */
  private preprocessChains(chains: Chain[], options: SecureImportOptions): any[] {
    return chains.map(chain => {
      // 基础数据清理
      const processed: any = {
        id: chain.id, // 原始ID，函数内部会重新分配
        name: String(chain.name || '未命名链条').substring(0, 255),
        parent_id: chain.parentId || null,
        type: ['unit', 'group'].includes(chain.type) ? chain.type : 'unit',
        sort_order: chain.sortOrder || Math.floor(Date.now() / 1000),
        trigger: String(chain.trigger || '').substring(0, 500),
        duration: Math.max(1, Math.min(480, chain.duration || 45)), // 1-480分钟
        description: String(chain.description || '').substring(0, 1000),
        
        // 统计数据处理
        current_streak: options.preserveStatistics ? (chain.currentStreak || 0) : 0,
        auxiliary_streak: options.preserveStatistics ? (chain.auxiliaryStreak || 0) : 0,
        total_completions: options.preserveStatistics ? (chain.totalCompletions || 0) : 0,
        total_failures: options.preserveStatistics ? (chain.totalFailures || 0) : 0,
        auxiliary_failures: options.preserveStatistics ? (chain.auxiliaryFailures || 0) : 0,
        
        // 例外规则
        exceptions: Array.isArray(chain.exceptions) ? chain.exceptions : [],
        auxiliary_exceptions: Array.isArray(chain.auxiliaryExceptions) ? chain.auxiliaryExceptions : [],
        
        // 辅助任务配置
        auxiliary_signal: chain.auxiliarySignal || null,
        auxiliary_duration: Math.max(1, Math.min(120, chain.auxiliaryDuration || 15)),
        auxiliary_completion_trigger: chain.auxiliaryCompletionTrigger || null,
        
        // 时间戳处理
        created_at: options.preserveTimestamps && chain.createdAt 
          ? chain.createdAt.toISOString() 
          : new Date().toISOString(),
        last_completed_at: options.preserveTimestamps && chain.lastCompletedAt
          ? chain.lastCompletedAt.toISOString()
          : null,
        
        // 高级功能
        is_durationless: Boolean(chain.isDurationless),
        time_limit_hours: chain.timeLimitHours ? Math.max(1, Math.min(168, chain.timeLimitHours)) : null,
        time_limit_exceptions: Array.isArray(chain.timeLimitExceptions) ? chain.timeLimitExceptions : [],
        
        // 组时间（通常重置）
        group_started_at: null,
        group_expires_at: null,
        
        // 确保导入的数据不是删除状态
        deleted_at: null
      };

      return processed;
    });
  }

  /**
   * 导入完成历史记录（使用ID映射更新链条引用）
   */
  async importCompletionHistory(
    history: CompletionHistory[],
    idMapping: Record<string, string>
  ): Promise<void> {
    if (!history || history.length === 0) {
      return;
    }

    try {
      // 处理历史记录，更新链条ID引用
      const processedHistory = history
        .filter(h => h.chainId && idMapping[h.chainId]) // 只保留有效映射的记录
        .map(h => ({
          id: crypto.randomUUID ? crypto.randomUUID() : `history_${Date.now()}_${Math.random()}`,
          chain_id: idMapping[h.chainId], // 使用新的链条ID
          completed_at: h.completedAt.toISOString(),
          duration: Math.max(1, h.duration || 45),
          was_successful: Boolean(h.wasSuccessful),
          reason_for_failure: h.reasonForFailure || null,
          description: h.description?.substring(0, 500) || null,
          notes: h.notes?.substring(0, 1000) || null,
          actual_duration: Math.max(1, (h as any).actualDuration || h.duration || 45),
          is_forward_timed: Boolean((h as any).isForwardTimed)
        }));

      if (processedHistory.length === 0) {
        console.log('[SECURE_IMPORT] No valid history records to import');
        return;
      }

      // 使用标准的Supabase插入（受现有RLS策略保护）
      const { error } = await supabase
        .from('completion_history')
        .insert(processedHistory);

      if (error) {
        console.warn('[SECURE_IMPORT] Failed to import completion history:', error);
        // 不抛出错误，历史记录导入失败不应该影响主要的链条导入
      } else {
        console.log(`[SECURE_IMPORT] Imported ${processedHistory.length} history records`);
      }

    } catch (error) {
      console.warn('[SECURE_IMPORT] Completion history import failed:', error);
      // 不抛出错误，保持导入流程的健壮性
    }
  }

  /**
   * 完成导入会话
   */
  async completeSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    try {
      const { error } = await supabase.rpc('complete_import_session', {
        p_session_token: this.currentSession.session_token
      });

      if (error) {
        console.warn('[SECURE_IMPORT] Failed to complete session:', error);
      }

    } catch (error) {
      console.warn('[SECURE_IMPORT] Session completion failed:', error);
    } finally {
      this.currentSession = null;
    }
  }

  /**
   * 检查会话是否过期
   */
  isSessionExpired(): boolean {
    if (!this.currentSession) {
      return true;
    }

    const expiresAt = new Date(this.currentSession.expires_at);
    return expiresAt <= new Date();
  }

  /**
   * 获取当前会话信息
   */
  getCurrentSession(): ImportSession | null {
    return this.currentSession;
  }

  /**
   * 清理当前会话
   */
  clearSession(): void {
    this.currentSession = null;
  }
}

export const secureImportService = SecureImportService.getInstance();