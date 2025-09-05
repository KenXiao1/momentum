import { supabase, isSupabaseConfigured, getCurrentUser } from '../lib/supabase';

export interface ActiveSessionData {
  id?: string;
  chain_id: string;
  started_at?: string;
  duration: number;
  is_paused?: boolean;
  paused_at?: string | null;
  total_paused_time?: number;
  user_id: string;
}

/**
 * 会话服务
 * 管理任务会话的数据库记录
 */
export class SessionService {
  /**
   * 检查Supabase是否已配置
   */
  private static ensureSupabaseConfigured(): void {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase not configured. Check your environment variables.');
    }
  }

  /**
   * 创建新的活动会话记录
   * @param chainId 链条ID
   * @param duration 持续时间（分钟）
   * @returns Promise<string> 新创建的会话ID (UUID)
   */
  static async createActiveSession(chainId: string, duration: number): Promise<string> {
    try {
      console.log('[SessionService] 创建新的活动会话...', { chainId, duration });
      this.ensureSupabaseConfigured();

      // 获取当前用户
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated. Please log in to create sessions.');
      }

      // 创建会话数据
      const sessionData: ActiveSessionData = {
        chain_id: chainId,
        started_at: new Date().toISOString(),
        duration: duration,
        is_paused: false,
        paused_at: null,
        total_paused_time: 0,
        user_id: user.id
      };

      // 插入到数据库
      const { data, error } = await supabase!
        .from('active_sessions')
        .insert(sessionData)
        .select('id')
        .single();

      if (error) {
        console.error('[SessionService] 创建会话失败:', error);
        throw new Error(`Failed to create session: ${error.message}`);
      }

      console.log('[SessionService] 会话创建成功:', data.id);
      return data.id;

    } catch (error) {
      console.error('[SessionService] 创建会话过程中发生错误:', error);
      throw error;
    }
  }

  /**
   * 删除活动会话记录
   * @param sessionId 会话ID
   * @returns Promise<void>
   */
  static async deleteActiveSession(sessionId: string): Promise<void> {
    try {
      console.log('[SessionService] 删除活动会话...', sessionId);
      this.ensureSupabaseConfigured();

      // 获取当前用户
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated.');
      }

      // 删除会话记录
      const { error } = await supabase!
        .from('active_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id); // 确保只能删除自己的会话

      if (error) {
        console.error('[SessionService] 删除会话失败:', error);
        throw new Error(`Failed to delete session: ${error.message}`);
      }

      console.log('[SessionService] 会话删除成功');

    } catch (error) {
      console.error('[SessionService] 删除会话过程中发生错误:', error);
      throw error;
    }
  }

  /**
   * 检查会话是否存在
   * @param sessionId 会话ID
   * @returns Promise<boolean> 会话是否存在
   */
  static async sessionExists(sessionId: string): Promise<boolean> {
    try {
      console.log('[SessionService] 检查会话是否存在...', sessionId);
      this.ensureSupabaseConfigured();

      // 获取当前用户
      const user = await getCurrentUser();
      if (!user) {
        return false;
      }

      // 查询会话
      const { data, error } = await supabase!
        .from('active_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // 记录不存在
          return false;
        }
        console.error('[SessionService] 查询会话失败:', error);
        return false;
      }

      return !!data;

    } catch (error) {
      console.error('[SessionService] 检查会话存在性过程中发生错误:', error);
      return false;
    }
  }

  /**
   * 更新会话状态（暂停/恢复）
   * @param sessionId 会话ID
   * @param isPaused 是否暂停
   * @param totalPausedTime 总暂停时间（秒）
   * @returns Promise<void>
   */
  static async updateSessionStatus(
    sessionId: string, 
    isPaused: boolean, 
    totalPausedTime?: number
  ): Promise<void> {
    try {
      console.log('[SessionService] 更新会话状态...', { sessionId, isPaused, totalPausedTime });
      this.ensureSupabaseConfigured();

      // 获取当前用户
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated.');
      }

      // 构建更新数据
      const updateData: Partial<ActiveSessionData> = {
        is_paused: isPaused,
        paused_at: isPaused ? new Date().toISOString() : null,
      };

      if (totalPausedTime !== undefined) {
        updateData.total_paused_time = totalPausedTime;
      }

      // 更新会话
      const { error } = await supabase!
        .from('active_sessions')
        .update(updateData)
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) {
        console.error('[SessionService] 更新会话状态失败:', error);
        throw new Error(`Failed to update session status: ${error.message}`);
      }

      console.log('[SessionService] 会话状态更新成功');

    } catch (error) {
      console.error('[SessionService] 更新会话状态过程中发生错误:', error);
      throw error;
    }
  }

  /**
   * 获取用户的所有活动会话
   * @returns Promise<ActiveSessionData[]> 活动会话列表
   */
  static async getUserActiveSessions(): Promise<ActiveSessionData[]> {
    try {
      console.log('[SessionService] 获取用户活动会话...');
      this.ensureSupabaseConfigured();

      // 获取当前用户
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated.');
      }

      // 查询用户的活动会话
      const { data, error } = await supabase!
        .from('active_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false });

      if (error) {
        console.error('[SessionService] 获取活动会话失败:', error);
        throw new Error(`Failed to get active sessions: ${error.message}`);
      }

      console.log('[SessionService] 获取活动会话成功:', data.length);
      return data || [];

    } catch (error) {
      console.error('[SessionService] 获取活动会话过程中发生错误:', error);
      return [];
    }
  }

  /**
   * 清理过期的会话记录（可选的维护功能）
   * @param olderThanHours 清理多少小时前的会话，默认24小时
   * @returns Promise<number> 清理的会话数量
   */
  static async cleanupExpiredSessions(olderThanHours: number = 24): Promise<number> {
    try {
      console.log(`[SessionService] 清理 ${olderThanHours} 小时前的过期会话...`);
      this.ensureSupabaseConfigured();

      // 获取当前用户
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated.');
      }

      // 计算过期时间
      const expirationTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

      // 删除过期会话
      const { data, error } = await supabase!
        .from('active_sessions')
        .delete()
        .eq('user_id', user.id)
        .lt('started_at', expirationTime.toISOString())
        .select('id');

      if (error) {
        console.error('[SessionService] 清理过期会话失败:', error);
        throw new Error(`Failed to cleanup expired sessions: ${error.message}`);
      }

      const cleanupCount = data?.length || 0;
      console.log(`[SessionService] 清理完成，删除了 ${cleanupCount} 个过期会话`);
      return cleanupCount;

    } catch (error) {
      console.error('[SessionService] 清理过期会话过程中发生错误:', error);
      return 0;
    }
  }
}

export default SessionService;