/**
 * useChainDetail hook
 * 封装 ChainDetail 的状态和业务逻辑
 */

import { useState, useCallback, useMemo, useSyncExternalStore } from 'react';
import type { Chain, CompletionHistory } from '../types';
import { useI18n } from '../i18n';
import { isUserInterruptedReason } from '../domain/failureReason';
import { buildActivityCalendar } from '../domain/activityCalendar';
import { hourlyDistribution, streakSeries } from '../domain/completionStats';
import { useSystemNotificationState } from '../hooks/useSystemNotificationState';
import {
  getDailyReminderTimes,
  setDailyReminderTime,
  subscribeDailyReminderTimes,
} from '../utils/local-preferences/dailyReminders';
import { isTauri, isTauriMobile } from '../utils/platform';
import type { ReminderSettings } from './chain-detail/types';

/** About six months: long enough to see a habit form, narrow enough for phones. */
const ACTIVITY_WEEKS = 26;
/** Enough records to see several streaks rise and reset. */
const STREAK_POINTS = 60;

interface UseChainDetailOptions {
  chain: Chain;
  history: CompletionHistory[];
  onDelete: () => void;
}

export function useChainDetail({
  chain,
  history,
  onDelete,
}: UseChainDetailOptions) {
  const { language, locale, t } = useI18n();

  // 状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 计算值
  const chainHistory = useMemo(
    () => history.filter((h) => h.chainId === chain.id),
    [history, chain.id],
  );

  const recentHistory = useMemo(
    () => chainHistory.slice(-10).reverse(),
    [chainHistory],
  );

  // The calendar ends with the week the page was opened in.
  const [openedAt] = useState(() => new Date());
  const activity = useMemo(
    () => buildActivityCalendar(chainHistory, openedAt, ACTIVITY_WEEKS),
    [chainHistory, openedAt],
  );
  const hours = useMemo(() => hourlyDistribution(chainHistory), [chainHistory]);

  const reminderTimes = useSyncExternalStore(
    subscribeDailyReminderTimes,
    getDailyReminderTimes,
  );
  const notifications = useSystemNotificationState();
  const reminder: ReminderSettings = {
    time: reminderTimes[chain.id] ?? null,
    support: isTauriMobile ? 'none' : isTauri ? 'native' : 'web',
    canNotify: notifications.enabled && notifications.permission === 'granted',
    onChange: (time) => setDailyReminderTime(chain.id, time),
  };
  const streak = useMemo(
    () => streakSeries(chainHistory, STREAK_POINTS),
    [chainHistory],
  );

  const successRate = useMemo(() => {
    if (chain.totalCompletions <= 0) return 0;
    return Math.round(
      (chain.totalCompletions /
        (chain.totalCompletions + chain.totalFailures)) *
        100,
    );
  }, [chain.totalCompletions, chain.totalFailures]);

  // 格式化失败原因
  const formatFailureReason = useCallback(
    (reason: string): string => {
      if (isUserInterruptedReason(reason))
        return t('useChainDetail.interruptedByUser');
      return reason;
    },
    [t],
  );

  // 事件处理器
  const handleDeleteClick = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    onDelete();
    setShowDeleteConfirm(false);
  }, [onDelete]);

  const handleDeleteCancel = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  return {
    // 状态
    showDeleteConfirm,

    // 计算值
    chainHistory,
    recentHistory,
    activity,
    hours,
    streak,
    reminder,
    successRate,
    chainHistoryCount: chainHistory.length,

    // 国际化
    language,
    locale,
    t,

    // 工具函数
    formatFailureReason,

    // 事件处理器
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
  };
}
