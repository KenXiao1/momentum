import { supabase, isSupabaseConfigured, getCurrentUser } from '../lib/supabase';

export interface BetPlacementRequest {
  session_id: string;
  bet_amount: number;
}

export interface BetPlacementResult {
  success: boolean;
  message: string;
  bet_id?: string;
  bet_amount?: number;
  potential_payout?: number;
  points_before?: number;
  points_after?: number;
  session_id?: string;
  chain_id?: string;
  error_code?: string;
  max_bet?: number;
  daily_limit?: number;
  daily_spent?: number;
  current_points?: number;
  required_points?: number;
  existing_bet_id?: string;
  existing_bet_amount?: number;
}

export interface BetSettlementResult {
  success: boolean;
  message: string;
  bet_id?: string;
  bet_amount?: number;
  payout?: number;
  task_successful?: boolean;
  points_before?: number;
  points_after?: number;
  bet_status?: string;
  error_code?: string;
  current_status?: string;
}

export interface GamblingStats {
  user_id: string;
  gambling_enabled: boolean;
  current_points: number;
  total_bets: number;
  total_wagered: number;
  total_won: number;
  total_lost: number;
  net_profit: number;
  win_rate: number;
  biggest_win: number;
  biggest_loss: number;
  current_streak: number;
}

export interface BettingHistoryEntry {
  id: string;
  session_id: string;
  chain_id: string;
  chain_name: string;
  bet_amount: number;
  bet_status: 'pending' | 'won' | 'lost' | 'cancelled' | 'refunded';
  potential_payout: number;
  actual_payout: number | null;
  points_before: number;
  points_after: number | null;
  created_at: string;
  settled_at: string | null;
  metadata: Record<string, any>;
}

export interface BettingHistory {
  bets: BettingHistoryEntry[];
  total_count: number;
  page_size: number;
  page_offset: number;
  has_more: boolean;
}

/**
 * 押注服务
 * 提供任务押注、结算和统计功能
 */
export class BettingService {
  /**
   * 检查Supabase是否已配置
   */
  private static ensureSupabaseConfigured(): void {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase not configured. Check your environment variables.');
    }
  }

  /**
   * 在任务会话上下注
   * @param betRequest 下注请求
   * @returns Promise<BetPlacementResult> 下注结果
   */
  static async placeBet(betRequest: BetPlacementRequest): Promise<BetPlacementResult> {
    try {
      console.log('[BettingService] 开始下注...', betRequest);
      this.ensureSupabaseConfigured();

      // 获取当前用户
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated. Please log in to place bets.');
      }

      console.log(`[BettingService] 为用户 ${user.id} 在会话 ${betRequest.session_id} 上下注 ${betRequest.bet_amount} 积分`);

      // 验证下注金额
      if (betRequest.bet_amount <= 0) {
        return {
          success: false,
          message: 'Bet amount must be greater than 0',
          error_code: 'INVALID_BET_AMOUNT'
        };
      }

      // 调用数据库函数下注
      const { data, error } = await supabase!.rpc('place_task_bet', {
        target_user_id: user.id,
        target_session_id: betRequest.session_id,
        bet_amount: betRequest.bet_amount
      });

      if (error) {
        console.error('[BettingService] 下注失败:', error);
        throw new Error(`Bet placement failed: ${error.message}`);
      }

      console.log('[BettingService] 下注成功:', data);
      return data as BetPlacementResult;

    } catch (error) {
      console.error('[BettingService] 下注过程中发生错误:', error);
      throw error;
    }
  }

  /**
   * 获取用户押注统计信息
   * @returns Promise<GamblingStats> 用户押注统计
   */
  static async getGamblingStats(): Promise<GamblingStats> {
    try {
      console.log('[BettingService] 获取用户押注统计...');
      this.ensureSupabaseConfigured();

      // 获取当前用户
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated. Please log in to view stats.');
      }

      console.log(`[BettingService] 获取用户 ${user.id} 的押注统计信息`);

      // 调用数据库函数获取统计
      const { data, error } = await supabase!.rpc('get_user_gambling_stats', {
        target_user_id: user.id
      });

      if (error) {
        console.error('[BettingService] 获取统计失败:', error);
        throw new Error(`Failed to get gambling stats: ${error.message}`);
      }

      console.log('[BettingService] 获取统计成功:', data);
      return data as GamblingStats;

    } catch (error) {
      console.error('[BettingService] 获取统计过程中发生错误:', error);
      throw error;
    }
  }

  /**
   * 获取用户押注历史记录（分页）
   * @param pageSize 每页数量，默认20
   * @param pageOffset 偏移量，默认0
   * @returns Promise<BettingHistory> 押注历史记录
   */
  static async getBettingHistory(pageSize: number = 20, pageOffset: number = 0): Promise<BettingHistory> {
    try {
      console.log(`[BettingService] 获取押注历史 (pageSize: ${pageSize}, pageOffset: ${pageOffset})...`);
      this.ensureSupabaseConfigured();

      // 获取当前用户
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated. Please log in to view betting history.');
      }

      console.log(`[BettingService] 获取用户 ${user.id} 的押注历史`);

      // 调用数据库函数获取历史记录
      const { data, error } = await supabase!.rpc('get_user_betting_history', {
        target_user_id: user.id,
        page_size: pageSize,
        page_offset: pageOffset
      });

      if (error) {
        console.error('[BettingService] 获取历史记录失败:', error);
        throw new Error(`Failed to get betting history: ${error.message}`);
      }

      console.log('[BettingService] 获取历史记录成功:', data);
      return data as BettingHistory;

    } catch (error) {
      console.error('[BettingService] 获取历史记录过程中发生错误:', error);
      throw error;
    }
  }

  /**
   * 检查用户是否可以在指定会话上下注
   * @param sessionId 会话ID
   * @returns Promise<{ canBet: boolean; reason?: string; existingBet?: any }> 检查结果
   */
  static async canPlaceBet(sessionId: string): Promise<{ canBet: boolean; reason?: string; existingBet?: any }> {
    try {
      console.log(`[BettingService] 检查是否可以在会话 ${sessionId} 上下注`);
      this.ensureSupabaseConfigured();

      // 获取当前用户
      const user = await getCurrentUser();
      if (!user) {
        return {
          canBet: false,
          reason: 'User not authenticated'
        };
      }

      // 检查是否已存在押注
      const { data: existingBets, error } = await supabase!
        .from('task_bets')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_id', sessionId);

      if (error) {
        console.error('[BettingService] 检查现有押注失败:', error);
        return {
          canBet: false,
          reason: 'Failed to check existing bets'
        };
      }

      if (existingBets && existingBets.length > 0) {
        console.log('[BettingService] 会话已存在押注:', existingBets[0]);
        return {
          canBet: false,
          reason: 'Bet already placed on this session',
          existingBet: existingBets[0]
        };
      }

      // 检查狂赌模式是否启用 - 这里需要导入UserSettingsService
      // 为了避免循环依赖，我们直接查询数据库
      const { data: settings, error: settingsError } = await supabase!
        .from('user_settings')
        .select('gambling_mode_enabled')
        .eq('user_id', user.id)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('[BettingService] 检查狂赌模式状态失败:', settingsError);
        return {
          canBet: false,
          reason: 'Failed to check gambling mode status'
        };
      }

      const gamblingEnabled = settings?.gambling_mode_enabled ?? false;
      if (!gamblingEnabled) {
        return {
          canBet: false,
          reason: 'Gambling mode is not enabled'
        };
      }

      console.log('[BettingService] 可以下注');
      return {
        canBet: true
      };

    } catch (error) {
      console.error('[BettingService] 检查是否可以下注时发生错误:', error);
      return {
        canBet: false,
        reason: 'Error checking bet eligibility'
      };
    }
  }

  /**
   * 获取用户当前可用积分（用于下注）
   * @returns Promise<number> 用户当前积分
   */
  static async getUserAvailablePoints(): Promise<number> {
    try {
      console.log('[BettingService] 获取用户可用积分...');
      this.ensureSupabaseConfigured();

      // 获取当前用户
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // 查询用户积分
      const { data, error } = await supabase!
        .from('user_points')
        .select('total_points')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // 记录不存在，返回0
          return 0;
        }
        console.error('[BettingService] 获取用户积分失败:', error);
        throw new Error(`Failed to get user points: ${error.message}`);
      }

      return data?.total_points ?? 0;

    } catch (error) {
      console.error('[BettingService] 获取用户积分过程中发生错误:', error);
      return 0;
    }
  }

  /**
   * 获取用户今日已下注金额
   * @returns Promise<number> 今日已下注金额
   */
  static async getTodayBetAmount(): Promise<number> {
    try {
      console.log('[BettingService] 获取今日已下注金额...');
      this.ensureSupabaseConfigured();

      // 获取当前用户
      const user = await getCurrentUser();
      if (!user) {
        return 0;
      }

      // 计算今日已下注金额
      const today = new Date().toISOString().split('T')[0]; // 获取今日日期 YYYY-MM-DD
      
      const { data, error } = await supabase!
        .from('task_bets')
        .select('bet_amount')
        .eq('user_id', user.id)
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lt('created_at', `${today}T23:59:59.999Z`)
        .not('bet_status', 'in', '(cancelled,refunded)');

      if (error) {
        console.error('[BettingService] 获取今日下注金额失败:', error);
        return 0;
      }

      const totalBetToday = data?.reduce((sum, bet) => sum + bet.bet_amount, 0) ?? 0;
      console.log(`[BettingService] 今日已下注: ${totalBetToday}`);
      
      return totalBetToday;

    } catch (error) {
      console.error('[BettingService] 获取今日下注金额过程中发生错误:', error);
      return 0;
    }
  }

  /**
   * 验证下注金额是否合法
   * @param betAmount 下注金额
   * @param sessionId 会话ID
   * @returns Promise<{ isValid: boolean; reason?: string; details?: any }> 验证结果
   */
  static async validateBetAmount(betAmount: number, sessionId: string): Promise<{ 
    isValid: boolean; 
    reason?: string; 
    details?: any 
  }> {
    try {
      console.log(`[BettingService] 验证下注金额 ${betAmount} 对会话 ${sessionId}`);

      // 基本验证
      if (betAmount <= 0) {
        return {
          isValid: false,
          reason: 'Bet amount must be greater than 0'
        };
      }

      // 检查用户可用积分
      const availablePoints = await this.getUserAvailablePoints();
      if (betAmount > availablePoints) {
        return {
          isValid: false,
          reason: 'Insufficient points for bet',
          details: {
            available_points: availablePoints,
            required_points: betAmount
          }
        };
      }

      // 检查是否可以下注（包括重复下注检查）
      const eligibility = await this.canPlaceBet(sessionId);
      if (!eligibility.canBet) {
        return {
          isValid: false,
          reason: eligibility.reason,
          details: eligibility.existingBet
        };
      }

      // 获取用户设置以检查限制
      const user = await getCurrentUser();
      if (!user) {
        return {
          isValid: false,
          reason: 'User not authenticated'
        };
      }

      const { data: settings } = await supabase!
        .from('user_settings')
        .select('max_single_bet, daily_bet_limit')
        .eq('user_id', user.id)
        .single();

      // 检查单次下注限制
      if (settings?.max_single_bet && betAmount > settings.max_single_bet) {
        return {
          isValid: false,
          reason: 'Bet amount exceeds maximum single bet limit',
          details: {
            max_bet: settings.max_single_bet
          }
        };
      }

      // 检查日限制
      if (settings?.daily_bet_limit) {
        const todayBetAmount = await this.getTodayBetAmount();
        if (todayBetAmount + betAmount > settings.daily_bet_limit) {
          return {
            isValid: false,
            reason: 'Daily betting limit would be exceeded',
            details: {
              daily_limit: settings.daily_bet_limit,
              daily_spent: todayBetAmount
            }
          };
        }
      }

      console.log('[BettingService] 下注金额验证通过');
      return {
        isValid: true
      };

    } catch (error) {
      console.error('[BettingService] 验证下注金额时发生错误:', error);
      return {
        isValid: false,
        reason: 'Error validating bet amount'
      };
    }
  }

  /**
   * 获取押注Dashboard数据（用于UI显示）
   * @returns Promise<{ stats: GamblingStats; canBet: boolean }> 完整的押注数据
   */
  static async getBettingDashboardData(): Promise<{
    stats: GamblingStats | null;
    availablePoints: number;
    todayBetAmount: number;
  }> {
    try {
      console.log('[BettingService] 获取Dashboard押注数据...');
      
      const [stats, availablePoints, todayBetAmount] = await Promise.all([
        this.getGamblingStats().catch(() => null),
        this.getUserAvailablePoints().catch(() => 0),
        this.getTodayBetAmount().catch(() => 0)
      ]);

      return {
        stats,
        availablePoints,
        todayBetAmount
      };

    } catch (error) {
      console.error('[BettingService] 获取Dashboard押注数据失败:', error);
      // 返回默认数据以避免UI崩溃
      return {
        stats: null,
        availablePoints: 0,
        todayBetAmount: 0
      };
    }
  }

  /**
   * 手动结算押注（通常由系统自动处理，但提供手动接口用于管理）
   * 注意：这个方法通常不应该由前端直接调用，因为结算应该通过数据库触发器自动完成
   * @param betId 押注ID
   * @param taskSuccessful 任务是否成功完成
   * @param completionNotes 完成备注
   * @returns Promise<BetSettlementResult> 结算结果
   */
  static async settleBet(betId: string, taskSuccessful: boolean, completionNotes?: string): Promise<BetSettlementResult> {
    try {
      console.log(`[BettingService] 手动结算押注 ${betId}, 成功: ${taskSuccessful}`);
      this.ensureSupabaseConfigured();

      // 调用数据库函数结算押注
      const { data, error } = await supabase!.rpc('settle_task_bet', {
        bet_id: betId,
        task_successful: taskSuccessful,
        completion_notes: completionNotes
      });

      if (error) {
        console.error('[BettingService] 结算押注失败:', error);
        throw new Error(`Bet settlement failed: ${error.message}`);
      }

      console.log('[BettingService] 结算押注成功:', data);
      return data as BetSettlementResult;

    } catch (error) {
      console.error('[BettingService] 结算押注过程中发生错误:', error);
      throw error;
    }
  }
}

export default BettingService;