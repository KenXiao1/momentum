/**
 * useChainDetail hook
 * 封装 ChainDetail 的状态和业务逻辑
 */

import { useState, useCallback, useMemo } from 'react';
import type { Chain, CompletionHistory } from '../types';
import { useI18n } from '../i18n';
import { isUserInterruptedReason } from '../domain/failureReason';
import { buildActivityCalendar } from '../domain/activityCalendar';

/** About six months: long enough to see a habit form, narrow enough for phones. */
const ACTIVITY_WEEKS = 26;

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
