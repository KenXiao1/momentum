import { useCallback, useEffect, useState } from 'react';
import type { ActiveSession } from '../../../types';
import { localPreferences } from '../../../utils/localPreferences';

interface UseAutoResumeParams {
  session: ActiveSession;
  onResume: () => void;
}

interface AutoResumeSchedule {
  resumeAt: number;
  secondsLeft: number;
}

function secondsUntil(timestamp: number): number {
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
}

/** Persisted schedule for this paused session, if one was saved. */
function readPersistedSchedule(
  session: ActiveSession,
): AutoResumeSchedule | null {
  const data = localPreferences.getAutoResume();
  if (
    !data ||
    data.chainId !== session.chainId ||
    data.startedAt !== session.startedAt.toISOString()
  ) {
    return null;
  }
  const resumeAt = new Date(data.resumeAt).getTime();
  return { resumeAt, secondsLeft: secondsUntil(resumeAt) };
}

function clearPersistedSchedule(chainId: string): void {
  const data = localPreferences.getAutoResume();
  if (data && data.chainId === chainId) {
    localPreferences.clearAutoResume();
  }
}

export function useAutoResume({ session, onResume }: UseAutoResumeParams) {
  const [schedule, setSchedule] = useState<AutoResumeSchedule | null>(null);
  const [elapsed, setElapsed] = useState<{
    pausedAt: number;
    seconds: number;
  } | null>(null);

  // Each paused session restores its persisted schedule; leaving the pause
  // drops it. (Persisted data is cleared by the effect below.)
  const pausedSessionKey = session.isPaused
    ? `${session.chainId}|${session.startedAt.toISOString()}`
    : null;
  const [restoredSessionKey, setRestoredSessionKey] = useState<string | null>(
    null,
  );
  if (pausedSessionKey !== restoredSessionKey) {
    setRestoredSessionKey(pausedSessionKey);
    setSchedule(pausedSessionKey ? readPersistedSchedule(session) : null);
  }

  const clearAutoResumeSchedule = useCallback(() => {
    clearPersistedSchedule(session.chainId);
    setSchedule(null);
  }, [session.chainId]);

  const scheduleAutoResume = useCallback(
    (minutes: number) => {
      const resumeAt = Date.now() + minutes * 60 * 1000;
      setSchedule({ resumeAt, secondsLeft: secondsUntil(resumeAt) });

      localPreferences.setAutoResume({
        chainId: session.chainId,
        startedAt: session.startedAt.toISOString(),
        resumeAt: new Date(resumeAt).toISOString(),
      });
    },
    [session.chainId, session.startedAt],
  );

  // Resume when the schedule comes due (at once if it already has).
  const resumeAt = session.isPaused ? (schedule?.resumeAt ?? null) : null;
  useEffect(() => {
    if (resumeAt === null) return;
    const timeout = window.setTimeout(
      () => {
        onResume();
        clearAutoResumeSchedule();
      },
      Math.max(0, resumeAt - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [clearAutoResumeSchedule, onResume, resumeAt]);

  // 倒计时显示
  useEffect(() => {
    if (resumeAt === null) return;
    const interval = window.setInterval(() => {
      const secondsLeft = secondsUntil(resumeAt);
      setSchedule((previous) =>
        previous?.resumeAt === resumeAt ? { resumeAt, secondsLeft } : previous,
      );
      if (secondsLeft <= 0) window.clearInterval(interval);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [resumeAt]);

  // Elapsed pause time, counted while paused without a schedule.
  const pausedAt =
    session.isPaused && session.pausedAt
      ? new Date(session.pausedAt).getTime()
      : null;
  const countsElapsed = pausedAt !== null && !schedule;
  useEffect(() => {
    if (!countsElapsed) return;
    const interval = window.setInterval(() => {
      setElapsed({
        pausedAt,
        seconds: Math.floor((Date.now() - pausedAt) / 1000),
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [countsElapsed, pausedAt]);

  // 清理自动恢复计划
  useEffect(() => {
    if (!session.isPaused) clearPersistedSchedule(session.chainId);
  }, [session.isPaused, session.chainId]);

  return {
    autoResumeAt: schedule?.resumeAt ?? null,
    resumeCountdown: schedule?.secondsLeft ?? 0,
    elapsedPauseTime:
      pausedAt !== null && elapsed?.pausedAt === pausedAt ? elapsed.seconds : 0,
    scheduleAutoResume,
    clearAutoResumeSchedule,
  };
}
