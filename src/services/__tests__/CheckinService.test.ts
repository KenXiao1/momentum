import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase before importing CheckinService
vi.mock('../../lib/supabase', () => {
  const mockSupabase = {
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn()
    }
  };

  const mockGetCurrentUser = vi.fn();

  return {
    supabase: mockSupabase,
    isSupabaseConfigured: true,
    getCurrentUser: mockGetCurrentUser
  };
});

import { CheckinService } from '../CheckinService';
import { supabase, getCurrentUser } from '../../lib/supabase';

describe('CheckinService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('performDailyCheckin', () => {
    it('should successfully perform daily checkin', async () => {
      const mockUser = { id: 'test-user-123' };
      const mockCheckinResult = {
        success: true,
        message: 'Check-in successful!',
        already_checked_in: false,
        checkin_date: '2025-01-17',
        points_earned: 10,
        consecutive_days: 1,
        total_points: 10,
        checkin_id: 'checkin-123'
      };

      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(supabase!.rpc).mockResolvedValue({ data: mockCheckinResult, error: null });

      const result = await CheckinService.performDailyCheckin();

      expect(supabase!.rpc).toHaveBeenCalledWith('perform_daily_checkin', {
        target_user_id: mockUser.id
      });
      expect(result).toEqual(mockCheckinResult);
    });

    it('should handle already checked in today', async () => {
      const mockUser = { id: 'test-user-123' };
      const mockCheckinResult = {
        success: false,
        message: 'Already checked in today',
        already_checked_in: true,
        checkin_date: '2025-01-17',
        points_earned: 0,
        consecutive_days: 5
      };

      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(supabase!.rpc).mockResolvedValue({ data: mockCheckinResult, error: null });

      const result = await CheckinService.performDailyCheckin();

      expect(result).toEqual(mockCheckinResult);
      expect(result.already_checked_in).toBe(true);
      expect(result.points_earned).toBe(0);
    });

    it('should throw error when user not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      await expect(CheckinService.performDailyCheckin())
        .rejects
        .toThrow('User not authenticated. Please log in to check in.');
    });

    it('should handle database errors', async () => {
      const mockUser = { id: 'test-user-123' };
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(supabase!.rpc).mockResolvedValue({ 
        data: null, 
        error: { message: 'Database connection failed' } 
      });

      await expect(CheckinService.performDailyCheckin())
        .rejects
        .toThrow('Check-in failed: Database connection failed');
    });
  });

  describe('getUserStats', () => {
    it('should return user checkin statistics', async () => {
      const mockUser = { id: 'test-user-123' };
      const mockStats = {
        user_id: mockUser.id,
        total_points: 100,
        total_checkins: 10,
        current_streak: 5,
        longest_streak: 7,
        last_checkin_date: '2025-01-17',
        has_checked_in_today: true
      };

      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(supabase!.rpc).mockResolvedValue({ data: mockStats, error: null });

      const result = await CheckinService.getUserStats();

      expect(supabase!.rpc).toHaveBeenCalledWith('get_user_checkin_stats', {
        target_user_id: mockUser.id
      });
      expect(result).toEqual(mockStats);
    });

    it('should throw error when user not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      await expect(CheckinService.getUserStats())
        .rejects
        .toThrow('User not authenticated. Please log in to view stats.');
    });
  });

  describe('getCheckinHistory', () => {
    it('should return paginated checkin history', async () => {
      const mockUser = { id: 'test-user-123' };
      const mockHistory = {
        checkins: [
          {
            id: 'checkin-1',
            checkin_date: '2025-01-17',
            points_earned: 10,
            consecutive_days: 1,
            created_at: '2025-01-17T08:00:00Z'
          }
        ],
        total_count: 1,
        page_size: 20,
        page_offset: 0,
        has_more: false
      };

      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(supabase!.rpc).mockResolvedValue({ data: mockHistory, error: null });

      const result = await CheckinService.getCheckinHistory();

      expect(supabase!.rpc).toHaveBeenCalledWith('get_user_checkin_history', {
        target_user_id: mockUser.id,
        page_size: 20,
        page_offset: 0
      });
      expect(result).toEqual(mockHistory);
    });

    it('should handle custom pagination parameters', async () => {
      const mockUser = { id: 'test-user-123' };
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(supabase!.rpc).mockResolvedValue({ data: {}, error: null });

      await CheckinService.getCheckinHistory(10, 20);

      expect(supabase!.rpc).toHaveBeenCalledWith('get_user_checkin_history', {
        target_user_id: mockUser.id,
        page_size: 10,
        page_offset: 20
      });
    });
  });

  describe('convenience methods', () => {
    const mockStats = {
      user_id: 'test-user-123',
      total_points: 100,
      total_checkins: 10,
      current_streak: 5,
      longest_streak: 7,
      last_checkin_date: '2025-01-17',
      has_checked_in_today: true
    };

    beforeEach(() => {
      const mockUser = { id: 'test-user-123' };
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(supabase!.rpc).mockResolvedValue({ data: mockStats, error: null });
    });

    it('should return correct hasCheckedInToday value', async () => {
      const result = await CheckinService.hasCheckedInToday();
      expect(result).toBe(true);
    });

    it('should return correct user points', async () => {
      const result = await CheckinService.getUserPoints();
      expect(result).toBe(100);
    });

    it('should return correct current streak', async () => {
      const result = await CheckinService.getCurrentStreak();
      expect(result).toBe(5);
    });

    it('should return complete dashboard data', async () => {
      const result = await CheckinService.getCheckinDashboardData();
      expect(result).toEqual({
        stats: mockStats,
        hasCheckedInToday: true
      });
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const mockUser = { id: 'test-user-123' };
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(supabase!.rpc).mockRejectedValue(new Error('Network error'));

      await expect(CheckinService.performDailyCheckin())
        .rejects
        .toThrow('Network error');
    });

    it('should return default values when stats fetch fails', async () => {
      const mockUser = { id: 'test-user-123' };
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(supabase!.rpc).mockRejectedValue(new Error('Database error'));

      const points = await CheckinService.getUserPoints();
      const streak = await CheckinService.getCurrentStreak();
      const hasCheckedIn = await CheckinService.hasCheckedInToday();

      expect(points).toBe(0);
      expect(streak).toBe(0);
      expect(hasCheckedIn).toBe(false);
    });
  });
});