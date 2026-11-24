/**
 * useChainCard hook - 封装 ChainCard 的状态和副作用逻辑
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Chain, ScheduledSession, ChainTreeNode } from '../../types';
import { getTimeRemaining } from '../../domain/scheduling';
import { getChainTypeConfig } from '../../utils/chain-tree';
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
  // Last completion time as fetched for a chain; only that chain may show it.
  const [fetchedCompletion, setFetchedCompletion] = useState<{
    chainId: string;
    time: number | null;
  } | null>(null);

  // Refs
  const lastPlayedExpiresAtRef = useRef<number | null>(null);
  // The scheduled session a warning was already shown for. A new session
  // (different chain or schedule time) may warn again.
  const warnedSessionRef = useRef<Pick<
    ScheduledSession,
    'chainId' | 'scheduledAt'
  > | null>(null);

  const tracksLastCompletion = chain.isDurationless || chain.duration === 0;
  const lastCompletionTime =
    tracksLastCompletion && fetchedCompletion?.chainId === chain.id
      ? fetchedCompletion.time
      : null;

  // Memoized values
  const typeConfig = useMemo(
    () => getChainTypeConfig(chain.type, language),
    [chain.type, language],
  );

  const isScheduled = scheduledSession && timeRemaining > 0;

  // 获取上次完成时间（仅对无时长任务）
  useEffect(() => {
    if (!tracksLastCompletion) return;
    let didCancel = false;
    const showCompletionTime = (time: number | null) =>
      setFetchedCompletion((previous) =>
        previous?.chainId === chain.id && previous.time === time
          ? previous
          : { chainId: chain.id, time },
      );

    (async () => {
      try {
        const lastTime = await storage.getLastCompletionTime(chain.id);
        if (!didCancel) showCompletionTime(lastTime);
      } catch (error) {
        if (!didCancel) showCompletionTime(null);
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
  }, [chain.id, tracksLastCompletion, storage]);

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
      const warned = warnedSessionRef.current;
      const hasShownWarning =
        warned?.chainId === scheduledSession.chainId &&
        warned.scheduledAt === scheduledSession.scheduledAt;
      if (
        notificationThreshold &&
        remaining <= notificationThreshold &&
        remaining > 0 &&
        !hasShownWarning
      ) {
        warnedSessionRef.current = {
          chainId: scheduledSession.chainId,
          scheduledAt: scheduledSession.scheduledAt,
        };
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
  }, [scheduledSession, chain.name, chain.auxiliaryDuration, t]);

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
