import { supabase, isSupabaseConfigured, getCurrentUser } from '../lib/supabase';

export interface CheckinStats {
  user_id: string;
  total_points: number;
  total_checkins: number;
  current_streak: number;
  longest_streak: number;
  last_checkin_date: string | null;
  has_checked_in_today: boolean;
}

export interface CheckinResult {
  success: boolean;
  message: string;
  already_checked_in: boolean;
  checkin_date: string;
  points_earned: number;
  consecutive_days: number;
  total_points?: number;
  checkin_id?: string;
}

export interface CheckinHistory {
  checkins: Array<{
    id: string;
    checkin_date: string;
    points_earned: number;
    consecutive_days: number;
    created_at: string;
  }>;
  total_count: number;
  page_size: number;
  page_offset: number;
  has_more: boolean;
}

/**
 * 每日签到服务
 * 提供用户签到、积分管理和统计功能
 */
export class CheckinService {
  /**
   * 检查Supabase是否已配置
   */
  private static ensureSupabaseConfigured(): void {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase not configured. Check your environment variables.');
    }
  }

  /**
   * 执行每日签到
   * @returns Promise<CheckinResult> 签到结果
   */
  static async performDailyCheckin(): Promise<CheckinResult> {
    try {
      console.log('[CheckinService] 开始执行每日签到...');
      this.ensureSupabaseConfigured();

      // 获取当前用户
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated. Please log in to check in.');
      }

      console.log(`[CheckinService] 为用户 ${user.id} 执行签到`);

      // 调用数据库函数执行签到
      const { data, error } = await supabase!.rpc('perform_daily_checkin', {
        target_user_id: user.id
      });

      if (error) {
        console.error('[CheckinService] 签到失败:', error);
        throw new Error(`Check-in failed: ${error.message}`);
      }

      console.log('[CheckinService] 签到成功:', data);
      return data as CheckinResult;

    } catch (error) {
      console.error('[CheckinService] 签到过程中发生错误:', error);
      throw error;
    }
  }

  /**
   * 获取用户签到统计信息
   * @returns Promise<CheckinStats> 用户签到统计
   */
  static async getUserStats(): Promise<CheckinStats> {
    try {
      console.log('[CheckinService] 获取用户签到统计...');
      this.ensureSupabaseConfigured();

      // 获取当前用户
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated. Please log in to view stats.');
      }

      console.log(`[CheckinService] 获取用户 ${user.id} 的统计信息`);

      // 调用数据库函数获取统计
      const { data, error } = await supabase!.rpc('get_user_checkin_stats', {
        target_user_id: user.id
      });

      if (error) {
        console.error('[CheckinService] 获取统计失败:', error);
        throw new Error(`Failed to get stats: ${error.message}`);
      }

      console.log('[CheckinService] 获取统计成功:', data);
      return data as CheckinStats;

    } catch (error) {
      console.error('[CheckinService] 获取统计过程中发生错误:', error);
      throw error;
    }
  }

  /**
   * 获取用户签到历史记录（分页）
   * @param pageSize 每页数量，默认20
   * @param pageOffset 偏移量，默认0
   * @returns Promise<CheckinHistory> 签到历史记录
   */
  static async getCheckinHistory(pageSize: number = 20, pageOffset: number = 0): Promise<CheckinHistory> {
    try {
      console.log(`[CheckinService] 获取签到历史 (pageSize: ${pageSize}, pageOffset: ${pageOffset})...`);
      this.ensureSupabaseConfigured();

      // 获取当前用户
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated. Please log in to view history.');
      }

      console.log(`[CheckinService] 获取用户 ${user.id} 的签到历史`);

      // 调用数据库函数获取历史记录
      const { data, error } = await supabase!.rpc('get_user_checkin_history', {
        target_user_id: user.id,
        page_size: pageSize,
        page_offset: pageOffset
      });

      if (error) {
        console.error('[CheckinService] 获取历史记录失败:', error);
        throw new Error(`Failed to get history: ${error.message}`);
      }

      console.log('[CheckinService] 获取历史记录成功:', data);
      return data as CheckinHistory;

    } catch (error) {
      console.error('[CheckinService] 获取历史记录过程中发生错误:', error);
      throw error;
    }
  }

  /**
   * 检查用户今天是否已经签到
   * @returns Promise<boolean> 今天是否已签到
   */
  static async hasCheckedInToday(): Promise<boolean> {
    try {
      const stats = await this.getUserStats();
      return stats.has_checked_in_today;
    } catch (error) {
      console.error('[CheckinService] 检查今日签到状态失败:', error);
      // 如果获取统计失败，默认返回false，允许用户尝试签到
      return false;
    }
  }

  /**
   * 获取用户当前积分
   * @returns Promise<number> 用户当前总积分
   */
  static async getUserPoints(): Promise<number> {
    try {
      const stats = await this.getUserStats();
      return stats.total_points;
    } catch (error) {
      console.error('[CheckinService] 获取用户积分失败:', error);
      // 如果获取统计失败，返回0
      return 0;
    }
  }

  /**
   * 获取用户当前连续签到天数
   * @returns Promise<number> 连续签到天数
   */
  static async getCurrentStreak(): Promise<number> {
    try {
      const stats = await this.getUserStats();
      return stats.current_streak;
    } catch (error) {
      console.error('[CheckinService] 获取连续签到天数失败:', error);
      // 如果获取统计失败，返回0
      return 0;
    }
  }

  /**
   * 批量获取签到相关的所有数据（用于Dashboard显示）
   * @returns Promise<{ stats: CheckinStats; hasCheckedInToday: boolean }> 完整的签到数据
   */
  static async getCheckinDashboardData(): Promise<{ 
    stats: CheckinStats; 
    hasCheckedInToday: boolean;
  }> {
    try {
      console.log('[CheckinService] 获取Dashboard签到数据...');
      const stats = await this.getUserStats();
      return {
        stats,
        hasCheckedInToday: stats.has_checked_in_today
      };
    } catch (error) {
      console.error('[CheckinService] 获取Dashboard数据失败:', error);
      // 返回默认数据以避免UI崩溃
      const user = await getCurrentUser();
      return {
        stats: {
          user_id: user?.id || '',
          total_points: 0,
          total_checkins: 0,
          current_streak: 0,
          longest_streak: 0,
          last_checkin_date: null,
          has_checked_in_today: false
        },
        hasCheckedInToday: false
      };
    }
  }
}

export default CheckinService;