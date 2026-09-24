/**
 * @module useCheckinDomain
 * @description 每日签到功能的领域 Hook
 *
 * 职责：
 * - 加载用户签到统计（连续天数、总积分等）
 * - 执行每日签到操作
 * - 管理签到 UI 状态（加载中、错误、成功消息）
 *
 * 仅在 Supabase 模式下生效，本地模式不支持签到功能。
 *
 * @see src/domain/checkin.ts - 类型定义
 * @see docs/api/daily-checkin-api-guide.md - API 文档
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CheckinResult, CheckinStats } from '../../domain/checkin';
import { useStorage } from '../../storage/useStorage';
import { hasStorageCapability } from '../../storage/ports';
import { logger } from '../../utils/logger';
import { useI18n } from '../../i18n';
import {
  getSafeErrorDetail,
  getSafeErrorDetailFromUnknown,
  toError,
} from '../../utils/errorMessage';
import { POINTS_CHANGED_EVENT } from '../../utils/pointsEvents';

export function useCheckinDomain() {
  const { language, t } = useI18n();
  const storage = useStorage();
  const canUseCheckin = hasStorageCapability(storage, 'checkin');

  const [stats, setStats] = useState<CheckinStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Refs to access latest values without re-creating callbacks
  const statsRef = useRef(stats);
  const isCheckingInRef = useRef(isCheckingIn);
  const languageRef = useRef(language);
  const tRef = useRef(t);

  // Keep refs in sync with state
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useEffect(() => {
    isCheckingInRef.current = isCheckingIn;
  }, [isCheckingIn]);

  useEffect(() => {
    languageRef.current = language;
    tRef.current = t;
  }, [language, t]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const loadStats = useCallback(async () => {
    if (!canUseCheckin) {
      setError(t('useCheckinDomain.dailyCheckInRequiresLogin'));
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      const result = await storage.getUserCheckinStats();
      if (!result.ok) {
        const safeDetail = getSafeErrorDetail(result.error.message, language);
        setError(
          safeDetail ??
            t('useCheckinDomain.failedToLoadCheckInDataCheckTheConsoleFor'),
        );
        setStats(null);
        return;
      }
      setStats(result.value);
    } catch (err) {
      logger.error('CHECKIN', '加载签到统计失败', undefined, toError(err));
      const safeDetail = getSafeErrorDetailFromUnknown(err, language);
      setError(
        safeDetail ??
          t('useCheckinDomain.failedToLoadCheckInDataCheckTheConsoleFor'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [canUseCheckin, language, storage, t]);

  const handleCheckin = useCallback(async () => {
    // Use refs to get latest values without causing callback recreation
    const currentStats = statsRef.current;
    if (
      !currentStats ||
      currentStats.has_checked_in_today ||
      isCheckingInRef.current
    ) {
      return;
    }

    try {
      setIsCheckingIn(true);
      setError(null);
      setSuccessMessage(null);

      const op = await storage.performDailyCheckin();
      if (!op.ok) {
        const safeDetail = getSafeErrorDetail(
          op.error.message,
          languageRef.current,
        );
        setError(
          safeDetail ??
            tRef.current(
              'useCheckinDomain.checkInFailedCheckTheConsoleForDetailsThenTry',
            ),
        );
        return;
      }

      const result: CheckinResult = op.value;

      if (result.success) {
        setStats((prev) =>
          prev
            ? {
                ...prev,
                total_points:
                  result.total_points ||
                  prev.total_points + result.points_earned,
                total_checkins: prev.total_checkins + 1,
                current_streak: result.consecutive_days,
                has_checked_in_today: true,
                last_checkin_date: result.checkin_date,
              }
            : null,
        );

        setSuccessMessage(
          tRef.current(
            'useCheckinDomain.checkedInEarnedResultPointsEarnedPointsStreakResultConsecutiveDaysDays',
            {
              resultPointsEarned: result.points_earned,
              resultConsecutiveDays: result.consecutive_days,
            },
          ),
        );
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const safeDetail = result.message
          ? getSafeErrorDetail(result.message, languageRef.current)
          : null;
        setError(safeDetail ?? tRef.current('useCheckinDomain.checkInFailed'));
      }
    } catch (err) {
      logger.error('CHECKIN', '签到失败', undefined, toError(err));
      const safeDetail = getSafeErrorDetailFromUnknown(
        err,
        languageRef.current,
      );
      setError(
        safeDetail ??
          tRef.current(
            'useCheckinDomain.checkInFailedCheckTheConsoleForDetailsThenTry',
          ),
      );
    } finally {
      setIsCheckingIn(false);
    }
  }, [storage]); // Reduced dependencies: only storage is needed

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (!canUseCheckin) return;

    const handler = () => {
      void loadStats();
    };

    window.addEventListener(POINTS_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(POINTS_CHANGED_EVENT, handler);
    };
  }, [canUseCheckin, loadStats]);

  return {
    stats,
    isLoading,
    isCheckingIn,
    error,
    successMessage,
    isCollapsed,
    clearError,
    toggleCollapsed,
    loadStats,
    handleCheckin,
  };
}
