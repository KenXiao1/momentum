import { supabase, isSupabaseConfigured, getCurrentUser } from '../lib/supabase';

export interface UserSettings {
  user_id: string;
  gambling_mode_enabled: boolean;
  daily_bet_limit: number | null;
  max_single_bet: number | null;
  settings_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface GamblingSettings {
  gambling_mode_enabled: boolean;
  daily_bet_limit?: number | null;
  max_single_bet?: number | null;
}

export interface UpdateSettingsResult {
  success: boolean;
  message: string;
  settings?: UserSettings;
}

/**
 * 用户设置服务
 * 提供用户偏好设置管理，包括狂赌模式开关和限制设置
 */
export class UserSettingsService {
  /**
   * 检查Supabase是否已配置
   */
  private static ensureSupabaseConfigured(): void {
    if (!isSupabaseConfigured || !supabase) {
      console.warn('[UserSettingsService] Supabase not configured, operating in demo mode');
      // Don't throw error, allow demo mode
    }
  }

  /**
   * 获取用户设置
   * @returns Promise<UserSettings | null> 用户设置信息
   */
  static async getUserSettings(): Promise<UserSettings | null> {
    try {
      console.log('[UserSettingsService] 获取用户设置...');
      this.ensureSupabaseConfigured();

      // Demo mode: return null when Supabase is not configured
      if (!isSupabaseConfigured || !supabase) {
        console.log('[UserSettingsService] Demo mode: returning null settings');
        return null;
      }

      // 获取当前用户
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated. Please log in to access settings.');
      }

      console.log(`[UserSettingsService] 获取用户 ${user.id} 的设置`);

      // 查询用户设置
      const { data, error } = await supabase!
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // 如果记录不存在，这不是错误，返回null
        if (error.code === 'PGRST116') {
          console.log('[UserSettingsService] 用户设置不存在，将创建默认设置');
          return null;
        }
        console.error('[UserSettingsService] 获取设置失败:', error);
        throw new Error(`Failed to get settings: ${error.message}`);
      }

      console.log('[UserSettingsService] 获取设置成功:', data);
      return data as UserSettings;

    } catch (error) {
      console.error('[UserSettingsService] 获取设置过程中发生错误:', error);
      throw error;
    }
  }

  /**
   * 创建默认用户设置
   * @returns Promise<UserSettings> 创建的默认设置
   */
  static async createDefaultSettings(): Promise<UserSettings> {
    try {
      console.log('[UserSettingsService] 创建默认用户设置...');
      this.ensureSupabaseConfigured();

      // Demo mode: return mock default settings when Supabase is not configured
      if (!isSupabaseConfigured || !supabase) {
        console.log('[UserSettingsService] Demo mode: returning mock default settings');
        const mockSettings: UserSettings = {
          user_id: 'demo-user',
          gambling_mode_enabled: false,
          daily_bet_limit: null,
          max_single_bet: null,
          settings_data: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        return mockSettings;
      }

      // 获取当前用户
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated. Please log in to create settings.');
      }

      console.log(`[UserSettingsService] 为用户 ${user.id} 创建默认设置`);

      // 创建默认设置
      const defaultSettings = {
        user_id: user.id,
        gambling_mode_enabled: false,
        daily_bet_limit: null,
        max_single_bet: null,
        settings_data: {}
      };

      const { data, error } = await supabase!
        .from('user_settings')
        .insert(defaultSettings)
        .select()
        .single();

      if (error) {
        console.error('[UserSettingsService] 创建默认设置失败:', error);
        throw new Error(`Failed to create default settings: ${error.message}`);
      }

      console.log('[UserSettingsService] 创建默认设置成功:', data);
      return data as UserSettings;

    } catch (error) {
      console.error('[UserSettingsService] 创建默认设置过程中发生错误:', error);
      throw error;
    }
  }

  /**
   * 获取或创建用户设置
   * @returns Promise<UserSettings> 用户设置（存在则返回，不存在则创建默认设置）
   */
  static async getOrCreateUserSettings(): Promise<UserSettings> {
    try {
      let settings = await this.getUserSettings();
      
      if (!settings) {
        // 设置不存在，创建默认设置
        settings = await this.createDefaultSettings();
      }

      return settings;
    } catch (error) {
      console.error('[UserSettingsService] 获取或创建设置失败:', error);
      throw error;
    }
  }

  /**
   * 更新狂赌模式设置
   * @param gamblingSettings 狂赌模式相关设置
   * @returns Promise<UpdateSettingsResult> 更新结果
   */
  static async updateGamblingSettings(gamblingSettings: GamblingSettings): Promise<UpdateSettingsResult> {
    try {
      console.log('[UserSettingsService] 更新狂赌模式设置...', gamblingSettings);
      this.ensureSupabaseConfigured();

      // 获取当前用户
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated. Please log in to update settings.');
      }

      console.log(`[UserSettingsService] 为用户 ${user.id} 更新狂赌模式设置`);

      // 构建更新数据
      const updateData: Partial<UserSettings> = {
        gambling_mode_enabled: gamblingSettings.gambling_mode_enabled
      };

      // 只有在提供的情况下才更新限制
      if (gamblingSettings.daily_bet_limit !== undefined) {
        updateData.daily_bet_limit = gamblingSettings.daily_bet_limit;
      }
      if (gamblingSettings.max_single_bet !== undefined) {
        updateData.max_single_bet = gamblingSettings.max_single_bet;
      }

      // 使用 upsert 操作，如果记录不存在则插入，存在则更新
      const { data, error } = await supabase!
        .from('user_settings')
        .upsert({
          user_id: user.id,
          ...updateData
        })
        .select()
        .single();

      if (error) {
        console.error('[UserSettingsService] 更新狂赌模式设置失败:', error);
        throw new Error(`Failed to update gambling settings: ${error.message}`);
      }

      console.log('[UserSettingsService] 更新狂赌模式设置成功:', data);
      
      return {
        success: true,
        message: 'Gambling settings updated successfully',
        settings: data as UserSettings
      };

    } catch (error) {
      console.error('[UserSettingsService] 更新狂赌模式设置过程中发生错误:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * 切换狂赌模式开关
   * @returns Promise<UpdateSettingsResult> 切换结果
   */
  static async toggleGamblingMode(): Promise<UpdateSettingsResult> {
    try {
      console.log('[UserSettingsService] 切换狂赌模式...');
      
      // 获取当前设置
      const currentSettings = await this.getOrCreateUserSettings();
      
      // 切换狂赌模式状态
      const newGamblingMode = !currentSettings.gambling_mode_enabled;
      
      console.log(`[UserSettingsService] 将狂赌模式从 ${currentSettings.gambling_mode_enabled} 切换为 ${newGamblingMode}`);
      
      // 更新设置
      const result = await this.updateGamblingSettings({
        gambling_mode_enabled: newGamblingMode
      });

      if (result.success) {
        result.message = newGamblingMode 
          ? 'Gambling mode enabled successfully' 
          : 'Gambling mode disabled successfully';
      }

      return result;

    } catch (error) {
      console.error('[UserSettingsService] 切换狂赌模式过程中发生错误:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to toggle gambling mode'
      };
    }
  }

  /**
   * 检查狂赌模式是否启用
   * @returns Promise<boolean> 狂赌模式是否启用
   */
  static async isGamblingModeEnabled(): Promise<boolean> {
    try {
      const settings = await this.getUserSettings();
      return settings?.gambling_mode_enabled ?? false;
    } catch (error) {
      console.error('[UserSettingsService] 检查狂赌模式状态失败:', error);
      // 如果获取失败，默认返回false（关闭状态）
      return false;
    }
  }

  /**
   * 获取狂赌模式相关设置
   * @returns Promise<GamblingSettings> 狂赌模式设置
   */
  static async getGamblingSettings(): Promise<GamblingSettings> {
    try {
      const settings = await this.getOrCreateUserSettings();
      return {
        gambling_mode_enabled: settings.gambling_mode_enabled,
        daily_bet_limit: settings.daily_bet_limit,
        max_single_bet: settings.max_single_bet
      };
    } catch (error) {
      console.error('[UserSettingsService] 获取狂赌模式设置失败:', error);
      // 返回默认设置以避免UI崩溃
      return {
        gambling_mode_enabled: false,
        daily_bet_limit: null,
        max_single_bet: null
      };
    }
  }

  /**
   * 更新用户设置（通用方法）
   * @param settingsUpdate 要更新的设置字段
   * @returns Promise<UpdateSettingsResult> 更新结果
   */
  static async updateSettings(settingsUpdate: Partial<UserSettings>): Promise<UpdateSettingsResult> {
    try {
      console.log('[UserSettingsService] 更新用户设置...', settingsUpdate);
      this.ensureSupabaseConfigured();

      // 获取当前用户
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated. Please log in to update settings.');
      }

      console.log(`[UserSettingsService] 为用户 ${user.id} 更新设置`);

      // 移除不能更新的字段
      const { user_id, created_at, ...updateData } = settingsUpdate;

      // 使用 upsert 操作
      const { data, error } = await supabase!
        .from('user_settings')
        .upsert({
          user_id: user.id,
          ...updateData
        })
        .select()
        .single();

      if (error) {
        console.error('[UserSettingsService] 更新设置失败:', error);
        throw new Error(`Failed to update settings: ${error.message}`);
      }

      console.log('[UserSettingsService] 更新设置成功:', data);
      
      return {
        success: true,
        message: 'Settings updated successfully',
        settings: data as UserSettings
      };

    } catch (error) {
      console.error('[UserSettingsService] 更新设置过程中发生错误:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * 获取Dashboard设置数据（用于UI显示）
   * @returns Promise<{ gamblingSettings: GamblingSettings; isEnabled: boolean }> 完整的设置数据
   */
  static async getSettingsDashboardData(): Promise<{
    gamblingSettings: GamblingSettings;
    isEnabled: boolean;
  }> {
    try {
      console.log('[UserSettingsService] 获取Dashboard设置数据...');
      const gamblingSettings = await this.getGamblingSettings();
      return {
        gamblingSettings,
        isEnabled: gamblingSettings.gambling_mode_enabled
      };
    } catch (error) {
      console.error('[UserSettingsService] 获取Dashboard设置数据失败:', error);
      // 返回默认数据以避免UI崩溃
      return {
        gamblingSettings: {
          gambling_mode_enabled: false,
          daily_bet_limit: null,
          max_single_bet: null
        },
        isEnabled: false
      };
    }
  }
}

export default UserSettingsService;