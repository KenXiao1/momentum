import { supabase, getCurrentUser } from '../lib/supabase';
import { queryOptimizer } from './queryOptimizer';
import { Chain, DeletedChain, ScheduledSession, ActiveSession, CompletionHistory, RSIPNode, RSIPMeta } from '../types';
import { logger, measurePerformance } from './logger';

interface SchemaVerificationResult {
  hasAllColumns: boolean;
  missingColumns: string[];
  error?: string;
}

export class SupabaseStorage {
  private schemaCache: Map<string, SchemaVerificationResult> = new Map();
  private lastSchemaCheck: Date | null = null;
  private sessionSchemaVerified: Set<string> = new Set(); // Track tables verified this session
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache
  
  /**
   * Retry a database operation with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry for certain types of errors
        if (error && typeof error === 'object' && 'code' in error) {
          const errorCode = (error as any).code;
          if (['PGRST204', 'PGRST116', '42703', '42P01'].includes(errorCode)) {
            throw lastError;
          }
        }
        
        if (attempt === maxRetries) {
          logger.error('Database operation failed after retries', { maxRetries, error: lastError.message });
          throw lastError;
        }
        
        const delay = baseDelay * Math.pow(2, attempt);
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Operation failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries}):`, lastError.message);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }
  
  /**
   * Clear schema cache to force re-verification
   */
  clearSchemaCache(): void {
    console.log('[SUPABASE_STORAGE] Clearing schema cache');
    this.schemaCache.clear();
    this.lastSchemaCheck = null;
    this.sessionSchemaVerified.clear();
    console.log('[SUPABASE_STORAGE] Schema cache cleared - will re-verify database schema');
  }

  /**
   * Clear all caches (schema cache and any other caches)
   */
  clearCache(): void {
    console.log('[SUPABASE_STORAGE] Clearing all storage-level caches');
    this.clearSchemaCache();
    // Add any other cache clearing here in the future
    console.log('[SUPABASE_STORAGE] All storage-level caches cleared');
  }

  /**
   * Verify that required columns exist in the database schema
   * Uses per-session caching to avoid repeated verification during same session
   */
  async verifySchemaColumns(tableName: string, requiredColumns: string[]): Promise<SchemaVerificationResult> {
    const cacheKey = `${tableName}:${requiredColumns.join(',')}`;
    const now = new Date();
    
    // Skip verification if already verified this session for critical operations
    if (this.sessionSchemaVerified.has(cacheKey)) {
      const cached = this.schemaCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }
    
    // Use cached result if it's less than 10 minutes old
    if (this.lastSchemaCheck && (now.getTime() - this.lastSchemaCheck.getTime()) < this.CACHE_DURATION) {
      const cached = this.schemaCache.get(cacheKey);
      if (cached && process.env.NODE_ENV === 'development') {
        console.log('Using cached schema verification result');
        return cached;
      }
    }
    
    try {
      // Query information_schema to check column existence
      const { data, error } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', tableName)
        .in('column_name', requiredColumns);
        
      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Schema verification failed:', error);
        }
        return { hasAllColumns: false, missingColumns: requiredColumns, error: error.message };
      }
      
      const existingColumns = (data || []).map(row => row.column_name);
      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
      
      const result: SchemaVerificationResult = {
        hasAllColumns: missingColumns.length === 0,
        missingColumns,
      };
      
      // Cache the result
      this.schemaCache.set(cacheKey, result);
      this.lastSchemaCheck = now;
      this.sessionSchemaVerified.add(cacheKey); // Mark as verified for this session
      
      return result;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Schema verification error:', error);
      }
      return { 
        hasAllColumns: false, 
        missingColumns: requiredColumns, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Chains
  async getChains(): Promise<Chain[]> {
    const user = await getCurrentUser();
    if (!user) {
      logger.warn('getChains: User not authenticated');
      return [];
    }

    // Debug log for authenticated user (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log('[DEBUG] getChains - Current user ID:', user.id);
    }

    try {
      const { data, error } = await supabase
        .from('chains')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to get chains data', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          userId: user.id,
          timestamp: new Date().toISOString()
        });
        
        // Return empty array for non-critical errors
        if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Table does not exist or permission issue, returning empty array');
          }
          return [];
        }
        
        throw new Error(`获取链数据失败: ${error.message}`);
      }

      const chainCount = data?.length || 0;
      logger.dbOperation('getChains', true, { chainCount, userId: user.id });
      
      const mappedChains = data.map(chain => ({
      id: chain.id,
      name: chain.name,
      parentId: chain.parent_id || undefined,
      type: chain.type as Chain['type'],
      sortOrder: chain.sort_order,
      trigger: chain.trigger,
      duration: chain.duration,
      description: chain.description,
      currentStreak: chain.current_streak,
      auxiliaryStreak: chain.auxiliary_streak,
      totalCompletions: chain.total_completions,
      totalFailures: chain.total_failures,
      auxiliaryFailures: chain.auxiliary_failures,
      exceptions: Array.isArray(chain.exceptions) ? chain.exceptions as string[] : [],
      auxiliaryExceptions: Array.isArray(chain.auxiliary_exceptions) ? chain.auxiliary_exceptions as string[] : [],
      auxiliarySignal: chain.auxiliary_signal,
      auxiliaryDuration: chain.auxiliary_duration,
      auxiliaryCompletionTrigger: chain.auxiliary_completion_trigger,
      // 兼容：如果后端没有此字段，将为 undefined
      isDurationless: (chain as any).is_durationless ?? false,
      timeLimitHours: (chain as any).time_limit_hours ?? undefined,
      timeLimitExceptions: Array.isArray((chain as any).time_limit_exceptions) ? (chain as any).time_limit_exceptions : [],
      groupStartedAt: (chain as any).group_started_at ? new Date((chain as any).group_started_at) : undefined,
      groupExpiresAt: (chain as any).group_expires_at ? new Date((chain as any).group_expires_at) : undefined,
      deletedAt: (chain as any).deleted_at ? new Date((chain as any).deleted_at) : null,
      createdAt: new Date(chain.created_at || Date.now()),
      lastCompletedAt: chain.last_completed_at ? new Date(chain.last_completed_at) : undefined,
    }));
    
    // Debug logging for development only
    if (process.env.NODE_ENV === 'development') {
      console.log('[DEBUG] getChains - Raw data sample:', data.slice(0, 7).map(c => ({ 
        id: c.id, 
        name: c.name, 
        deleted_at: (c as any).deleted_at,
        deleted_at_type: typeof (c as any).deleted_at
      })));
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[DEBUG] getChains - Mapped data sample:', mappedChains.slice(0, 7).map(c => ({ 
        id: c.id, 
        name: c.name, 
        deletedAt: c.deletedAt,
        deletedAtType: typeof c.deletedAt,
        isDeleted: c.deletedAt != null
      })));
    }
    
    return mappedChains;
    } catch (error) {
      console.error('getChains 操作异常:', {
        error: error instanceof Error ? error.message : error,
        userId: user.id,
        timestamp: new Date().toISOString()
      });
      
      // For network or other critical errors, throw to let caller handle
      if (error instanceof Error && (error.message.includes('fetch') || error.message.includes('network'))) {
        throw error;
      }
      
      return [];
    }
  }

  // 回收箱相关方法
  async getActiveChains(): Promise<Chain[]> {
    const allChains = await this.getChains();
    if (process.env.NODE_ENV === 'development') {
      console.log('[DEBUG] getActiveChains - All chains:', allChains.length, allChains.map(c => ({ 
        id: c.id, 
        name: c.name, 
        deletedAt: c.deletedAt,
        deletedAtType: typeof c.deletedAt,
        isDeleted: c.deletedAt != null
      })));
    }
    
    // 过滤掉已删除的链条（deletedAt不为null且不为undefined）
    const activeChains = allChains.filter(chain => chain.deletedAt == null);
    if (process.env.NODE_ENV === 'development') {
      console.log('[DEBUG] getActiveChains - Active chains:', activeChains.length, activeChains.map(c => ({ 
        id: c.id, 
        name: c.name, 
        deletedAt: c.deletedAt 
      })));
    }
    
    return activeChains;
  }

  async getDeletedChains(): Promise<DeletedChain[]> {
    try {
      const allChains = await this.getChains();
      if (process.env.NODE_ENV === 'development') {
        console.log('[DEBUG] getDeletedChains - All chains:', allChains.length, allChains.map(c => ({ 
          id: c.id, 
          name: c.name, 
          deletedAt: c.deletedAt,
          deletedAtType: typeof c.deletedAt
        })));
      }
      
      const deletedChains = allChains.filter(chain => chain.deletedAt != null);
      if (process.env.NODE_ENV === 'development') {
        console.log('[DEBUG] getDeletedChains - Deleted chains:', deletedChains.length, deletedChains.map(c => ({ 
          id: c.id, 
          name: c.name, 
          deletedAt: c.deletedAt 
        })));
      }
      
      return deletedChains
        .map(chain => ({ ...chain, deletedAt: chain.deletedAt! }))
        .sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
    } catch (error) {
      // 如果获取链条失败，返回空数组
      logger.warn('Failed to get deleted chains, database may not support soft delete', { error });
      return [];
    }
  }

  async softDeleteChain(chainId: string): Promise<void> {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('用户未认证，无法删除链条');
    }

    // 获取所有链条以找到子链条
    const allChains = await this.getChains();
    const chainsToDelete = this.findChainAndChildren(chainId, allChains);
    
    try {
      // 尝试批量软删除
      const { error } = await supabase
        .from('chains')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', chainsToDelete.map(c => c.id))
        .eq('user_id', user.id);

      if (error) {
        // 如果数据库不支持 deleted_at 字段，回退到永久删除
        if (error.code === '42703' || error.message?.includes('deleted_at') || error.code === 'PGRST204') {
          logger.warn('Database does not support soft delete, executing permanent delete');
          await this.permanentlyDeleteChain(chainId);
          return;
        }
        logger.error('Soft delete chain failed', { error });
        throw new Error(`Soft delete chain failed: ${error.message}`);
      }
    } catch (error) {
      // 如果是字段不存在的错误，回退到永久删除
      if (error instanceof Error && (error.message.includes('deleted_at') || error.message.includes('PGRST204'))) {
        logger.warn('Database does not support soft delete, executing permanent delete');
        await this.permanentlyDeleteChain(chainId);
        return;
      }
      throw error;
    }
  }

  async restoreChain(chainId: string): Promise<void> {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('用户未认证，无法恢复链条');
    }

    console.log(`[SUPABASE_STORAGE] Starting restore operation for chain: ${chainId}`);

    try {
      // 获取所有链条以找到子链条
      console.log(`[SUPABASE_STORAGE] Fetching all chains to find children of chain: ${chainId}`);
      const allChains = await this.getChains();
      const chainsToRestore = this.findChainAndChildren(chainId, allChains);
      
      console.log(`[SUPABASE_STORAGE] Found ${chainsToRestore.length} chains to restore:`, chainsToRestore.map(c => ({ id: c.id, name: c.name })));
      
      // Enhanced batch restore with retry mechanism
      const restoreOperation = async () => {
        const { data, error } = await supabase
          .from('chains')
          .update({ deleted_at: null })
          .in('id', chainsToRestore.map(c => c.id))
          .eq('user_id', user.id)
          .select('id, name'); // Select to verify successful updates

        if (error) {
          console.error(`[SUPABASE_STORAGE] Database restore error for chain ${chainId}:`, error);
          
          // 如果数据库不支持 deleted_at 字段，说明链条已经被永久删除，无法恢复
          if (error.code === '42703' || error.message?.includes('deleted_at') || error.code === 'PGRST204') {
            throw new Error('Database does not support soft delete, cannot restore deleted chains');
          }
          logger.error('Restore chain failed', { chainId, error, chainsToRestore: chainsToRestore.map(c => c.id) });
          throw new Error(`Restore chain failed: ${error.message}`);
        }

        // Verify restoration was successful
        const restoredCount = data?.length || 0;
        console.log(`[SUPABASE_STORAGE] Successfully restored ${restoredCount} of ${chainsToRestore.length} chains`);
        
        if (restoredCount !== chainsToRestore.length) {
          console.warn(`[SUPABASE_STORAGE] Partial restore - expected ${chainsToRestore.length} chains but only restored ${restoredCount}`);
        }

        return data;
      };

      // Use retry mechanism for database operation
      const restoredData = await this.retryOperation(restoreOperation, 2, 500);
      
      // ENHANCED: Clear any cached data after successful restore
      this.clearSchemaCache();
      queryOptimizer.onDataChange('chains');
      
      console.log(`[SUPABASE_STORAGE] Chain ${chainId} restore operation completed successfully`);
      
    } catch (error) {
      console.error(`[SUPABASE_STORAGE] Failed to restore chain ${chainId}:`, error);
      
      if (error instanceof Error && (error.message.includes('deleted_at') || error.message.includes('PGRST204'))) {
        throw new Error('Database does not support soft delete, cannot restore deleted chains');
      }
      throw error;
    }
  }

  async permanentlyDeleteChain(chainId: string): Promise<void> {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('用户未认证，无法删除链条');
    }

    // 获取所有链条以找到子链条
    const allChains = await this.getChains();
    const chainsToDelete = this.findChainAndChildren(chainId, allChains);
    
    // 批量永久删除
    const { error } = await supabase
      .from('chains')
      .delete()
      .in('id', chainsToDelete.map(c => c.id))
      .eq('user_id', user.id);

    if (error) {
      logger.error('Permanent delete chain failed', { error });
      throw new Error(`Permanent delete chain failed: ${error.message}`);
    }
  }

  async cleanupExpiredDeletedChains(olderThanDays: number = 30): Promise<number> {
    const user = await getCurrentUser();
    if (!user) {
      return 0;
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // 查找过期的已删除链条
      const { data: expiredChains, error: selectError } = await supabase
        .from('chains')
        .select('id')
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null)
        .lt('deleted_at', cutoffDate.toISOString());

      if (selectError) {
        // 如果数据库没有 deleted_at 字段，直接返回0，不抛出错误
        if (selectError.code === '42703' || selectError.message?.includes('deleted_at does not exist')) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Database does not have deleted_at field, skipping cleanup');
          }
          return 0;
        }
        logger.error('Failed to find expired chains', { error: selectError });
        throw new Error(`Failed to find expired chains: ${selectError.message}`);
      }

      if (!expiredChains || expiredChains.length === 0) {
        return 0;
      }

      // 永久删除过期链条
      const { error: deleteError } = await supabase
        .from('chains')
        .delete()
        .in('id', expiredChains.map(c => c.id))
        .eq('user_id', user.id);

      if (deleteError) {
        logger.error('Failed to cleanup expired chains', { error: deleteError });
        throw new Error(`Failed to cleanup expired chains: ${deleteError.message}`);
      }

      return expiredChains.length;
    } catch (error) {
      // 如果是字段不存在的错误，不抛出异常，只是记录警告
      if (error instanceof Error && error.message.includes('deleted_at does not exist')) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Database schema does not support soft delete, skipping cleanup');
        }
        return 0;
      }
      throw error;
    }
  }

  // 辅助方法：查找链条及其所有子链条
  private findChainAndChildren(chainId: string, allChains: Chain[]): Chain[] {
    const result: Chain[] = [];
    const visited = new Set<string>();

    const findRecursive = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const chain = allChains.find(c => c.id === id);
      if (chain) {
        result.push(chain);
        // 查找所有子链条
        const children = allChains.filter(c => c.parentId === id);
        children.forEach(child => findRecursive(child.id));
      }
    };

    findRecursive(chainId);
    return result;
  }

  async saveChains(chains: Chain[]): Promise<void> {
    const user = await getCurrentUser();
    if (!user) {
      const error = new Error('User not authenticated, cannot save data');
      logger.error('No authenticated user found when trying to save chains');
      throw error;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Saving chains for user:', user.id, 'Chain count:', chains.length);
      console.log('Chain details to save:', chains.map(c => ({ 
        id: c.id, 
        name: c.name, 
        type: c.type,
        parentId: c.parentId,
        sortOrder: c.sortOrder 
      })));
    }

    // Only verify schema once per session, not on every saveChains call
    const newColumns = ['is_durationless', 'time_limit_hours', 'time_limit_exceptions', 'group_started_at', 'group_expires_at', 'deleted_at'];
    const schemaVerificationKey = `chains:${newColumns.join(',')}`;
    
    let schemaCheck: SchemaVerificationResult;
    if (!this.sessionSchemaVerified.has(schemaVerificationKey)) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Performing one-time schema verification for this session');
      }
      schemaCheck = await this.verifySchemaColumns('chains', newColumns);
      
      if (!schemaCheck.hasAllColumns && process.env.NODE_ENV === 'development') {
        console.warn('Database schema check found missing columns:', schemaCheck.missingColumns);
      }
    } else {
      // Use cached result to avoid repeated schema checks
      schemaCheck = this.schemaCache.get(schemaVerificationKey) || { hasAllColumns: false, missingColumns: newColumns };
    }

    // 生成两套数据：完整字段集（包含新列）与基础字段集（兼容旧后端）
    const buildRow = (chain: Chain, includeNewColumns: boolean) => {
      let parentId = chain.parentId || null;
      if (parentId === chain.id) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Detected circular reference: Chain ${chain.name} (${chain.id}) has itself as parent, resetting to null`);
        }
        parentId = null;
      }

      const base: any = {
        id: chain.id,
        name: chain.name,
        parent_id: parentId,
        type: chain.type || 'unit',
        sort_order: chain.sortOrder || Math.floor(Date.now() / 1000),
        trigger: chain.trigger,
        duration: chain.duration,
        description: chain.description,
        current_streak: chain.currentStreak,
        auxiliary_streak: chain.auxiliaryStreak,
        total_completions: chain.totalCompletions,
        total_failures: chain.totalFailures,
        auxiliary_failures: chain.auxiliaryFailures,
        exceptions: chain.exceptions,
        auxiliary_exceptions: chain.auxiliaryExceptions,
        auxiliary_signal: chain.auxiliarySignal,
        auxiliary_duration: chain.auxiliaryDuration,
        auxiliary_completion_trigger: chain.auxiliaryCompletionTrigger,
        created_at: chain.createdAt.toISOString(),
        last_completed_at: chain.lastCompletedAt?.toISOString(),
        user_id: user.id,
      };

      if (!includeNewColumns) return base;

      return {
        ...base,
        // 新增列：后端不支持时将触发回退逻辑
        is_durationless: chain.isDurationless ?? false,
        time_limit_hours: chain.timeLimitHours ?? null,
        time_limit_exceptions: chain.timeLimitExceptions ?? [],
        group_started_at: chain.groupStartedAt ? chain.groupStartedAt.toISOString() : null,
        group_expires_at: chain.groupExpiresAt ? chain.groupExpiresAt.toISOString() : null,
        deleted_at: chain.deletedAt?.toISOString() || null,
      } as any;
    };

    const rowsWithNew = chains.map(c => buildRow(c, true));
    const rowsBase = chains.map(c => buildRow(c, false));

    const isMissingColumnError = (e: any) => {
      if (!e) return false;
      const msg = `${e.message || ''} ${e.details || ''}`.toLowerCase();
      const code = e.code || '';
      
      // Enhanced error detection patterns
      const patterns = [
        /column .* does not exist/,
        /schema cache/,
        /could not find .* column/,
        /relation .* does not exist/,
        /unknown column/,
        /invalid column name/,
        /column .* not found/,
        /undefined column/
      ];
      
      // Check for specific error codes
      const errorCodes = ['PGRST204', 'PGRST116', '42703', '42P01'];
      
      return patterns.some(pattern => pattern.test(msg)) || errorCodes.includes(code);
    };

    // 查询现有ID，用于决定删除哪些已被移除的链
    const { data: existingRows, error: existingErr } = await supabase
      .from('chains')
      .select('id')
      .eq('user_id', user.id);
    if (existingErr) {
      console.error('查询现有链ID失败:', existingErr);
      throw new Error(`查询现有数据失败: ${existingErr.message}`);
    }
    const existingIds = new Set((existingRows || []).map(r => r.id as string));

    // 先尝试使用包含新列的 upsert；若后端缺列，则回退到基础列
    let upsertResultIds: string[] = [];
    const tryUpsert = async (rows: any[]) => {
      const { data, error } = await supabase
        .from('chains')
        .upsert(rows, { onConflict: 'id' })
        .select('id');
      return { data, error } as { data: { id: string }[] | null, error: any };
    };

    let { data: upsertData1, error: upsertErr1 } = await tryUpsert(rowsWithNew);
    if (upsertErr1 && isMissingColumnError(upsertErr1)) {
      console.warn('检测到后端缺少新列，回退到基础字段保存。错误信息:', {
        code: upsertErr1.code,
        message: upsertErr1.message,
        details: upsertErr1.details,
        timestamp: new Date().toISOString()
      });
      
      // Implement retry with exponential backoff for fallback
      let retryCount = 0;
      const maxRetries = 3;
      let fallbackSuccess = false;
      
      while (retryCount < maxRetries && !fallbackSuccess) {
        try {
          const { data: upsertData2, error: upsertErr2 } = await tryUpsert(rowsBase);
          if (upsertErr2) {
            retryCount++;
            if (retryCount >= maxRetries) {
              console.error('回退保存在重试后仍失败:', upsertErr2);
              throw new Error(`保存数据失败 (重试 ${maxRetries} 次后): ${upsertErr2.message}`);
            }
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          } else {
            upsertResultIds = (upsertData2 || []).map(r => r.id);
            fallbackSuccess = true;
            console.log('回退保存成功，使用基础字段集');
          }
        } catch (retryError) {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw retryError;
          }
        }
      }
    } else if (upsertErr1) {
      console.error('保存失败:', {
        code: upsertErr1.code,
        message: upsertErr1.message,
        details: upsertErr1.details,
        timestamp: new Date().toISOString()
      });
      throw new Error(`保存数据失败: ${upsertErr1.message}`);
    } else {
      upsertResultIds = (upsertData1 || []).map(r => r.id);
      console.log('保存成功，使用完整字段集');
    }

    // 仅删除那些不在本次保存集合中的旧链，避免“先删后插”带来的数据丢失
    const newIds = new Set(chains.map(c => c.id));
    const idsToDelete = [...existingIds].filter(id => !newIds.has(id));
    if (idsToDelete.length > 0) {
      const { error: delErr } = await supabase
        .from('chains')
        .delete()
        .in('id', idsToDelete)
        .eq('user_id', user.id);
      if (delErr) {
        console.error('删除多余链失败:', delErr);
        throw new Error(`删除多余数据失败: ${delErr.message}`);
      }
    }

    // 最终确认
    const savedIds = new Set(upsertResultIds);
    const expectedIds = new Set(chains.map(c => c.id));
    const missingSavedIds = [...expectedIds].filter(id => !savedIds.has(id));
    if (missingSavedIds.length > 0) {
      console.warn('部分链条在返回结果中缺失（可能因旧后端未返回所有行）。缺失IDs:', missingSavedIds);
    }

    console.log('所有链数据保存流程完成');
  }

  // Scheduled Sessions
  async getScheduledSessions(): Promise<ScheduledSession[]> {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('scheduled_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('scheduled_at', { ascending: false });

    if (error) {
      console.error('Error fetching scheduled sessions:', error);
      return [];
    }

    return data.map(session => ({
      chainId: session.chain_id,
      scheduledAt: new Date(session.scheduled_at),
      expiresAt: new Date(session.expires_at),
      auxiliarySignal: session.auxiliary_signal,
    }));
  }

  async saveScheduledSessions(sessions: ScheduledSession[]): Promise<void> {
    const user = await getCurrentUser();
    if (!user) return;

    // Delete all existing sessions for this user
    await supabase
      .from('scheduled_sessions')
      .delete()
      .eq('user_id', user.id);

    // Insert new sessions
    if (sessions.length > 0) {
      const { error } = await supabase
        .from('scheduled_sessions')
        .insert(sessions.map(session => ({
          chain_id: session.chainId,
          scheduled_at: session.scheduledAt.toISOString(),
          expires_at: session.expiresAt.toISOString(),
          auxiliary_signal: session.auxiliarySignal,
          user_id: user.id,
        })));

      if (error) {
        console.error('Error saving scheduled sessions:', error);
      }
    }
  }

  // Active Session
  async getActiveSession(): Promise<ActiveSession | null> {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('user_id', user.id)
      .limit(1);

    if (error || !data || data.length === 0) {
      return null;
    }

    const sessionData = data[0];

    return {
      chainId: sessionData.chain_id,
      startedAt: new Date(sessionData.started_at),
      duration: sessionData.duration,
      isPaused: sessionData.is_paused,
      pausedAt: sessionData.paused_at ? new Date(sessionData.paused_at) : undefined,
      totalPausedTime: sessionData.total_paused_time,
      // 新增字段，向后兼容
      isForwardTimer: (sessionData as any).is_forward_timer || false,
      forwardElapsedTime: (sessionData as any).forward_elapsed_time || 0,
    };
  }

  async saveActiveSession(session: ActiveSession | null): Promise<void> {
    const user = await getCurrentUser();
    if (!user) return;

    // Delete existing active session
    await supabase
      .from('active_sessions')
      .delete()
      .eq('user_id', user.id);

    // Insert new session if provided
    if (session) {
      // 尝试使用新字段保存，如果失败则回退到基础字段
      const tryInsertWithNewFields = async () => {
        return await supabase
          .from('active_sessions')
          .insert({
            chain_id: session.chainId,
            started_at: session.startedAt.toISOString(),
            duration: session.duration,
            is_paused: session.isPaused,
            paused_at: session.pausedAt?.toISOString(),
            total_paused_time: session.totalPausedTime,
            is_forward_timer: (session as any).isForwardTimer || false,
            forward_elapsed_time: (session as any).forwardElapsedTime || 0,
            user_id: user.id,
          });
      };

      const tryInsertBasic = async () => {
        return await supabase
          .from('active_sessions')
          .insert({
            chain_id: session.chainId,
            started_at: session.startedAt.toISOString(),
            duration: session.duration,
            is_paused: session.isPaused,
            paused_at: session.pausedAt?.toISOString(),
            total_paused_time: session.totalPausedTime,
            user_id: user.id,
          });
      };

      let { error } = await tryInsertWithNewFields();
      
      if (error && (error.code === '42703' || error.message?.includes('is_forward_timer') || error.message?.includes('forward_elapsed_time'))) {
        console.warn('数据库不支持新的正向计时字段，使用基础字段保存');
        ({ error } = await tryInsertBasic());
      }

      if (error) {
        console.error('Error saving active session:', error);
      }
    }
  }

  // Completion History
  async getCompletionHistory(): Promise<CompletionHistory[]> {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('completion_history')
      .select('*')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false });

    if (error) {
      console.error('Error fetching completion history:', error);
      return [];
    }

    return data.map(history => ({
      chainId: history.chain_id,
      completedAt: new Date(history.completed_at),
      duration: history.duration,
      wasSuccessful: history.was_successful,
      reasonForFailure: history.reason_for_failure || undefined,
      // 新增字段，向后兼容
      actualDuration: (history as any).actual_duration || history.duration,
      isForwardTimed: (history as any).is_forward_timed || false,
      description: (history as any).description || undefined,
      notes: (history as any).notes || undefined,
    }));
  }

  async saveCompletionHistory(history: CompletionHistory[]): Promise<void> {
    const user = await getCurrentUser();
    if (!user) return;

    console.log('[DEBUG] saveCompletionHistory - 输入历史记录数量:', history.length);

    // Get existing history to determine what's new
    const { data: existingHistory } = await supabase
      .from('completion_history')
      .select('chain_id, completed_at')
      .eq('user_id', user.id);

    console.log('[DEBUG] saveCompletionHistory - 数据库中现有记录数量:', existingHistory?.length || 0);

    // Create more robust duplicate detection using timestamp normalization
    const existingKeys = new Set(
      existingHistory?.map(h => {
        // Normalize timestamp to avoid precision issues
        const normalizedTime = new Date(h.completed_at).getTime();
        const key = `${h.chain_id}-${normalizedTime}`;
        console.log('[DEBUG] 现有记录键:', key, '原始时间:', h.completed_at);
        return key;
      }) || []
    );

    const newHistory = history.filter(h => {
      // Use same normalization for comparison
      const normalizedTime = h.completedAt.getTime();
      const key = `${h.chainId}-${normalizedTime}`;
      const isDuplicate = existingKeys.has(key);
      console.log('[DEBUG] 检查记录:', key, '是否重复:', isDuplicate, '原始时间:', h.completedAt.toISOString());
      return !isDuplicate;
    });

    console.log('[DEBUG] saveCompletionHistory - 过滤后新记录数量:', newHistory.length);

    // Insert new history records
    if (newHistory.length > 0) {
      // 尝试使用新字段保存，如果失败则回退到基础字段
      const tryInsertWithNewFields = async () => {
        return await supabase
          .from('completion_history')
          .insert(newHistory.map(h => ({
            chain_id: h.chainId,
            completed_at: h.completedAt.toISOString(),
            duration: h.duration,
            was_successful: h.wasSuccessful,
            reason_for_failure: h.reasonForFailure,
            actual_duration: (h as any).actualDuration || h.duration,
            is_forward_timed: (h as any).isForwardTimed || false,
            description: (h as any).description || null,
            notes: (h as any).notes || null,
            user_id: user.id,
          })));
      };

      const tryInsertBasic = async () => {
        return await supabase
          .from('completion_history')
          .insert(newHistory.map(h => ({
            chain_id: h.chainId,
            completed_at: h.completedAt.toISOString(),
            duration: h.duration,
            was_successful: h.wasSuccessful,
            reason_for_failure: h.reasonForFailure,
            description: (h as any).description || null,
            notes: (h as any).notes || null,
            user_id: user.id,
          })));
      };

      let { error } = await tryInsertWithNewFields();
      
      if (error && (error.code === '42703' || error.message?.includes('actual_duration') || error.message?.includes('is_forward_timed'))) {
        console.warn('数据库不支持新的用时字段，使用基础字段保存');
        ({ error } = await tryInsertBasic());
      }

      if (error) {
        console.error('Error saving completion history:', error);
      }
    }
  }

  // RSIP nodes
  async getRSIPNodes(): Promise<RSIPNode[]> {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('rsip_nodes')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching RSIP nodes:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      parentId: row.parent_id || undefined,
      title: row.title,
      rule: row.rule,
      sortOrder: row.sort_order,
      createdAt: new Date(row.created_at),
      useTimer: (row as any).use_timer ?? false,
      timerMinutes: (row as any).timer_minutes ?? undefined,
    }));
  }

  async saveRSIPNodes(nodes: RSIPNode[]): Promise<void> {
    const user = await getCurrentUser();
    if (!user) return;

    // Upsert all nodes for user
    const rows = nodes.map(n => ({
      id: n.id,
      parent_id: n.parentId || null,
      title: n.title,
      rule: n.rule,
      sort_order: n.sortOrder,
      created_at: n.createdAt.toISOString(),
      use_timer: n.useTimer ?? false,
      timer_minutes: n.timerMinutes ?? null,
      user_id: user.id,
    }));

    // Fetch existing ids to delete removed ones
    const { data: existingRows, error: existingErr } = await supabase
      .from('rsip_nodes')
      .select('id')
      .eq('user_id', user.id);
    if (existingErr) {
      console.error('查询现有RSIP节点失败:', existingErr);
      throw new Error(`查询现有RSIP节点失败: ${existingErr.message}`);
    }
    const existingIds = new Set((existingRows || []).map(r => r.id as string));
    const newIds = new Set(nodes.map(n => n.id));
    const idsToDelete = [...existingIds].filter(id => !newIds.has(id));

    if (idsToDelete.length > 0) {
      const { error: delErr } = await supabase
        .from('rsip_nodes')
        .delete()
        .in('id', idsToDelete)
        .eq('user_id', user.id);
      if (delErr) {
        console.error('删除多余RSIP节点失败:', delErr);
        throw new Error(`删除多余RSIP节点失败: ${delErr.message}`);
      }
    }

    const { error } = await supabase
      .from('rsip_nodes')
      .upsert(rows, { onConflict: 'id' });
    if (error) {
      console.error('Error saving RSIP nodes:', error);
      throw new Error(`保存RSIP节点失败: ${error.message}`);
    }
  }

  async getRSIPMeta(): Promise<RSIPMeta> {
    const user = await getCurrentUser();
    if (!user) return {};
    const { data, error } = await supabase
      .from('rsip_meta')
      .select('*')
      .eq('user_id', user.id)
      .limit(1);
    if (error || !data || data.length === 0) return {};
    const row = data[0];
    return {
      lastAddedAt: row.last_added_at ? new Date(row.last_added_at) : undefined,
      allowMultiplePerDay: !!row.allow_multiple_per_day,
    };
  }

  async saveRSIPMeta(meta: RSIPMeta): Promise<void> {
    const user = await getCurrentUser();
    if (!user) return;
    const { error } = await supabase
      .from('rsip_meta')
      .upsert({
        user_id: user.id,
        last_added_at: meta.lastAddedAt ? meta.lastAddedAt.toISOString() : null,
        allow_multiple_per_day: !!meta.allowMultiplePerDay,
      }, { onConflict: 'user_id' });
    if (error) {
      console.error('保存RSIP元数据失败:', error);
      throw new Error(`保存RSIP元数据失败: ${error.message}`);
    }
  }

  // 任务用时统计相关方法
  async getTaskTimeStats(): Promise<import('../types').TaskTimeStats[]> {
    // 由于Supabase后端可能没有task_time_stats表，我们使用localStorage作为后备
    // 这确保了功能的兼容性
    try {
      const data = localStorage.getItem('momentum_task_time_stats');
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.warn('获取任务用时统计失败，返回空数组:', error);
      return [];
    }
  }

  async saveTaskTimeStats(stats: import('../types').TaskTimeStats[]): Promise<void> {
    // 使用localStorage作为后备存储
    try {
      localStorage.setItem('momentum_task_time_stats', JSON.stringify(stats));
    } catch (error) {
      console.warn('保存任务用时统计失败:', error);
    }
  }

  async getLastCompletionTime(chainId: string): Promise<number | null> {
    const stats = await this.getTaskTimeStats();
    const chainStats = stats.find(s => s.chainId === chainId);
    return chainStats?.lastCompletionTime || null;
  }

  async updateTaskTimeStats(chainId: string, actualDuration: number): Promise<void> {
    const stats = await this.getTaskTimeStats();
    const existingIndex = stats.findIndex(s => s.chainId === chainId);
    
    if (existingIndex >= 0) {
      // 更新现有统计
      const existing = stats[existingIndex];
      const newTotalTime = existing.totalTime + actualDuration;
      const newTotalCompletions = existing.totalCompletions + 1;
      
      stats[existingIndex] = {
        ...existing,
        lastCompletionTime: actualDuration,
        averageCompletionTime: Math.round(newTotalTime / newTotalCompletions),
        totalCompletions: newTotalCompletions,
        totalTime: newTotalTime
      };
    } else {
      // 创建新统计
      stats.push({
        chainId,
        lastCompletionTime: actualDuration,
        averageCompletionTime: actualDuration,
        totalCompletions: 1,
        totalTime: actualDuration
      });
    }
    
    await this.saveTaskTimeStats(stats);
  }

  async getTaskAverageTime(chainId: string): Promise<number | null> {
    const stats = await this.getTaskTimeStats();
    const chainStats = stats.find(s => s.chainId === chainId);
    return chainStats?.averageCompletionTime || null;
  }

  // 向后兼容性：为现有历史记录添加用时数据
  async migrateCompletionHistoryForTiming(): Promise<void> {
    try {
      const history = await this.getCompletionHistory();
      const chains = await this.getChains();
      let hasChanges = false;

      const updatedHistory = history.map(record => {
        // 检查是否需要迁移
        if ((record as any).actualDuration !== undefined && (record as any).isForwardTimed !== undefined) {
          return record; // 已经迁移过
        }

        const chain = chains.find(c => c.id === record.chainId);
        
        // 为记录添加用时相关字段
        const migratedRecord = {
          ...record,
          actualDuration: record.duration, // 使用原计划时长作为实际用时
          isForwardTimed: chain?.isDurationless || false // 根据链条设置判断
        } as any;

        hasChanges = true;
        return migratedRecord;
      });

      if (hasChanges) {
        await this.saveCompletionHistory(updatedHistory);
      }
    } catch (error) {
      console.warn('迁移完成历史记录时出错:', error);
    }
  }
}

export const supabaseStorage = new SupabaseStorage();

// Clear schema cache on module load to ensure fresh schema verification
// Also clear session verification cache to handle hot reloads during development
supabaseStorage.clearSchemaCache();

// Add performance monitoring for frequent operations
// Add query optimizer integration
const originalGetChains = supabaseStorage.getChains.bind(supabaseStorage);
supabaseStorage.getChains = async function() {
  return queryOptimizer.deduplicateQuery("chains:getAll", () => originalGetChains());
};

const originalGetActiveChains = supabaseStorage.getActiveChains.bind(supabaseStorage);
supabaseStorage.getActiveChains = async function() {
  return queryOptimizer.deduplicateQuery("chains:getActive", () => originalGetActiveChains());
};
const originalSaveChains = supabaseStorage.saveChains.bind(supabaseStorage);
supabaseStorage.saveChains = async function(chains: Chain[]) {
  const startTime = performance.now();
  try {
    const result = await originalSaveChains(chains);
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (duration > 1000) { // Log slow operations > 1 second
      console.warn(`[PERFORMANCE] saveChains took ${duration.toFixed(2)}ms for ${chains.length} chains`);
    }
    
    return result;
  } catch (error) {
    const endTime = performance.now();
    console.error(`[PERFORMANCE] saveChains failed after ${(endTime - startTime).toFixed(2)}ms:`, error);
    throw error;
  }
};