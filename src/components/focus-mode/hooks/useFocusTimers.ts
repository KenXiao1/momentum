import { useEffect, useRef, useState } from 'react';
import type { ActiveSession, Chain } from '../../../types';
import type { MomentumStorage } from '../../../storage/MomentumStorage';
import { systemNotificationService } from '../../../services/platform/SystemNotificationService';
import { forwardTimerManager } from '../../../utils/forwardTimer';
import { soundManager } from '../../../utils/soundManager';
import { useI18n } from '../../../i18n';
import { fireAndForget } from '../../../utils/fireAndForget';

interface UseFocusTimersParams {
  session: ActiveSession;
  chain: Chain;
  isDurationless: boolean;
  storage: MomentumStorage;
  onTimeUp: () => void;
}

export function useFocusTimers({
  session,
  chain,
  isDurationless,
  storage,
  onTimeUp,
}: UseFocusTimersParams) {
  const { t } = useI18n();
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [forwardElapsedSeconds, setForwardElapsedSeconds] = useState(0);
  const [lastCompletionTime, setLastCompletionTime] = useState<number | null>(
    null,
  );
  const [hasReachedMinimum, setHasReachedMinimum] = useState(false);
  const [minimumCountdown, setMinimumCountdown] = useState(0);

  const hasShownWarningRef = useRef(false);
  const hasPlayedSoundRef = useRef(false);
  const hasTriggeredTimeUpRef = useRef(false);

  useEffect(() => {
    hasShownWarningRef.current = false;
    hasPlayedSoundRef.current = false;
    hasTriggeredTimeUpRef.current = false;
  }, [session.startedAt, session.chainId]);

  useEffect(() => {
    if (!isDurationless) return;

    storage
      .getLastCompletionTime(chain.id)
      .then(setLastCompletionTime)
      .catch(() => setLastCompletionTime(null));
  }, [chain.id, isDurationless, storage]);

  useEffect(() => {
    if (!isDurationless) return;

    const sessionId = `${session.chainId}_${session.startedAt.getTime()}`;

    if (!forwardTimerManager.hasTimer(sessionId)) {
      forwardTimerManager.startTimer(sessionId);
    }

    const updateForwardTimer = () => {
      if (session.isPaused && !forwardTimerManager.isPaused(sessionId)) {
        forwardTimerManager.pauseTimer(sessionId);
      } else if (!session.isPaused && forwardTimerManager.isPaused(sessionId)) {
        forwardTimerManager.resumeTimer(sessionId);
      }

      const elapsed = forwardTimerManager.getCurrentElapsed(sessionId);
      setForwardElapsedSeconds(elapsed);

      if (chain.minimumDuration && chain.minimumDuration > 0) {
        const minimumSeconds = chain.minimumDuration * 60;
        if (elapsed >= minimumSeconds) {
          setHasReachedMinimum(true);
          setMinimumCountdown(0);
        } else {
          setHasReachedMinimum(false);
          setMinimumCountdown(minimumSeconds - elapsed);
        }
      } else {
        setHasReachedMinimum(true);
        setMinimumCountdown(0);
      }
    };

    updateForwardTimer();
    const interval = setInterval(updateForwardTimer, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [chain.minimumDuration, isDurationless, session]);

  useEffect(() => {
    if (isDurationless) return;

    const getNotificationThresholdSeconds = (durationMinutes: number) => {
      if (durationMinutes <= 3) return null;
      const thresholdMinutes = Math.floor(durationMinutes / 3);
      return Math.min(thresholdMinutes, 1) * 60;
    };

    const notificationThresholdSeconds = getNotificationThresholdSeconds(
      session.duration,
    );

    const calculateTimeRemainingSeconds = () => {
      const now = Date.now();
      const sessionDurationMs = session.duration * 60 * 1000;
      const elapsedTime = session.isPaused
        ? (session.pausedAt?.getTime() || now) - session.startedAt.getTime()
        : now - session.startedAt.getTime();
      const adjustedElapsedTime = elapsedTime - session.totalPausedTime;
      const remaining = Math.max(0, sessionDurationMs - adjustedElapsedTime);
      return Math.ceil(remaining / 1000);
    };

    const updateTimer = () => {
      if (session.isPaused) return;

      const remaining = calculateTimeRemainingSeconds();
      setTimeRemaining(remaining);

      if (
        notificationThresholdSeconds &&
        remaining <= notificationThresholdSeconds &&
        remaining > 0 &&
        !hasShownWarningRef.current
      ) {
        hasShownWarningRef.current = true;
        const minutes = Math.max(1, Math.ceil(remaining / 60));
        fireAndForget(
          systemNotificationService.notifyTaskWarning(
            chain.name,
            t('chainCard.useChainCard.minutesMin', { minutes: minutes }),
          ),
          { label: 'task-warning-notification' },
        );
      }

      if (remaining <= 0) {
        if (!hasTriggeredTimeUpRef.current) {
          hasTriggeredTimeUpRef.current = true;
          onTimeUp();
        }
        if (!hasPlayedSoundRef.current) {
          soundManager.playTimerFinished();
          hasPlayedSoundRef.current = true;
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [chain.name, isDurationless, onTimeUp, session, t]);

  return {
    timeRemaining,
    forwardElapsedSeconds,
    lastCompletionTime,
    hasReachedMinimum,
    minimumCountdown,
  };
}
