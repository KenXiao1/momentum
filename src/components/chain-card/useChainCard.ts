/**
 * useChainCard hook - 封装 ChainCard 的状态和副作用逻辑
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Chain, ScheduledSession, ChainTreeNode } from '../../types';
import { getTimeRemaining } from '../../utils/time';
import { getChainTypeConfig } from '../../utils/chainTree';
import { systemNotificationService } from '../../services/platform/SystemNotificationService';
import { useStorage } from '../../storage/useStorage';
import { soundManager } from '../../utils/soundManager';
import { isDev } from '../../utils/env';
import { logger } from '../../utils/logger';
import { toError } from '../../utils/errorMessage';
import { fireAndForget } from '../../utils/fireAndForget';
import { useI18n } from '../../i18n';

interface UseChainCardOptions {
  chain: Chain | ChainTreeNode;
  scheduledSession?: ScheduledSession;
  onDelete: (chainId: string) => void;
}

/**
 * 计算通知时机
 */
function getNotificationThreshold(durationMinutes: number): number | null {
  if (durationMinutes <= 3) return null; // 小于等于3分钟不通知
  const thresholdMinutes = Math.floor(durationMinutes / 3);
  return Math.min(thresholdMinutes, 1) * 60; // 转换为秒，最多1分钟
}

export function useChainCard({
  chain,
  scheduledSession,
  onDelete,
}: UseChainCardOptions) {
  const { language, t } = useI18n();
  const storage = useStorage();

  // 状态
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [hasShownWarning, setHasShownWarning] = useState(false);
  const [lastCompletionTime, setLastCompletionTime] = useState<number | null>(
    null,
  );

  // Refs
  const lastPlayedExpiresAtRef = useRef<number | null>(null);

  // Memoized values
  const typeConfig = useMemo(
    () => getChainTypeConfig(chain.type, language),
    [chain.type, language],
  );

  const isScheduled = scheduledSession && timeRemaining > 0;

  // 获取上次完成时间（仅对无时长任务）
  useEffect(() => {
    let didCancel = false;

    if (!chain.isDurationless && chain.duration !== 0) {
      setLastCompletionTime(null);
      return;
    }

    (async () => {
      try {
        const lastTime = await storage.getLastCompletionTime(chain.id);
        if (!didCancel) {
          setLastCompletionTime(lastTime);
        }
      } catch (error) {
        if (!didCancel) {
          setLastCompletionTime(null);
        }
        if (isDev) {
          logger.warn(
            'CHAIN_CARD',
            'Failed to load last completion time',
            { chainId: chain.id },
            toError(error),
          );
        }
      }
    })();

    return () => {
      didCancel = true;
    };
  }, [chain.id, chain.isDurationless, chain.duration, storage]);

  // 定时器和通知逻辑
  useEffect(() => {
    if (!scheduledSession) {
      lastPlayedExpiresAtRef.current = null;
      return;
    }

    const notificationThreshold = getNotificationThreshold(
      chain.auxiliaryDuration,
    );

    const updateTimer = () => {
      const remaining = getTimeRemaining(scheduledSession.expiresAt);
      setTimeRemaining(remaining);

      // 根据新逻辑显示警告通知
      if (
        notificationThreshold &&
        remaining <= notificationThreshold &&
        remaining > 0 &&
        !hasShownWarning
      ) {
        setHasShownWarning(true);
        const minutes = Math.max(1, Math.ceil(remaining / 60));
        fireAndForget(
          systemNotificationService.notifyScheduleWarning(
            chain.name,
            t('chainCard.useChainCard.minutesMin', { minutes: minutes }),
          ),
          { label: 'schedule-warning-notification' },
        );
      }

      if (remaining <= 0) {
        // 预约失败通知
        fireAndForget(
          systemNotificationService.notifyScheduleFailed(chain.name),
          { label: 'schedule-failed-notification' },
        );

        // Play sound when timer reaches 0, but only once per session
        if (
          lastPlayedExpiresAtRef.current !==
          scheduledSession.expiresAt.getTime()
        ) {
          soundManager.playTimerFinished();
          lastPlayedExpiresAtRef.current = scheduledSession.expiresAt.getTime();
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [
    scheduledSession,
    hasShownWarning,
    chain.name,
    chain.auxiliaryDuration,
    t,
  ]);

  // 重置警告状态当预约会话改变时
  useEffect(() => {
    setHasShownWarning(false);
  }, [scheduledSession?.scheduledAt, scheduledSession?.chainId]);

  const handleToggleMenu = useCallback(() => {
    setShowMenu((prev) => !prev);
  }, []);

  const handleShowDeleteConfirm = useCallback(() => {
    setShowDeleteConfirm(true);
    setShowMenu(false);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    onDelete(chain.id);
    setShowDeleteConfirm(false);
  }, [chain.id, onDelete]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  return {
    // State
    timeRemaining,
    showDeleteConfirm,
    showMenu,
    lastCompletionTime,
    isScheduled,

    // Memoized values
    typeConfig,
    language,
    t,

    // Handlers
    handleToggleMenu,
    handleShowDeleteConfirm,
    handleConfirmDelete,
    handleCancelDelete,
  };
}
