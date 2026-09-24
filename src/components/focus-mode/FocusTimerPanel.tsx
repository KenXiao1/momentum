import { type Translator } from '../../i18n';
import { CheckCircle, Clock, Flame, Hourglass } from 'lucide-react';
import type { ActiveSession, Chain } from '../../types';
import {
  formatDuration,
  formatElapsedTime,
  formatLastCompletionReference,
  formatTimeDescriptionByLanguage,
} from '../../utils/time';
import { TimerRing } from './TimerRing';

interface FocusTimerPanelProps {
  session: ActiveSession;
  chain: Chain;
  isDurationless: boolean;
  timeRemaining: number;
  elapsedSeconds: number;
  progress: number;
  lastCompletionTime: number | null;
  hasReachedMinimum: boolean;
  minimumCountdown: number;
  language: 'zh' | 'en';
  t: Translator;
}

export function FocusTimerPanel({
  session,
  chain,
  isDurationless,
  timeRemaining,
  elapsedSeconds,
  progress,
  lastCompletionTime,
  hasReachedMinimum,
  minimumCountdown,
  language,
  t: t,
}: FocusTimerPanelProps) {
  const elapsedMinutes = Math.ceil(elapsedSeconds / 60);
  const elapsedWholeMinutes = Math.floor(
    (session.duration * 60 - timeRemaining) / 60,
  );
  const minimumConfigured =
    isDurationless &&
    Boolean(chain.minimumDuration && chain.minimumDuration > 0);

  return (
    <section className="mb-12 text-center sm:mb-16" aria-live="polite">
      <div className="relative mb-8 flex items-center justify-center py-4">
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <TimerRing
            progress={progress}
            isDurationless={isDurationless}
            isPaused={session.isPaused}
            className="h-[min(300px,72vw)] w-[min(300px,72vw)]"
          />
        </div>
        <div className="focus-timer-value relative z-10 px-8 font-mono text-[clamp(4rem,15vw,9rem)] font-light leading-none tracking-tight text-gray-950 dark:text-white">
          {isDurationless
            ? formatElapsedTime(elapsedSeconds)
            : formatDuration(timeRemaining)}
        </div>
      </div>
      <div className="mx-auto mb-6 h-1.5 w-full max-w-2xl overflow-hidden rounded-full bg-gray-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-primary-600 transition-[width] duration-1000 ease-out dark:bg-primary-400"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center space-x-2">
          <Clock className="text-primary-500" size={16} aria-hidden="true" />
          <span className="font-mono">
            {isDurationless
              ? `${t('focusMode.focusTimerPanel.elapsed')}${formatTimeDescriptionByLanguage(elapsedMinutes, language)}`
              : t(
                  'focusMode.focusTimerPanel.elapsedWholeMinutesMinSessionDurationMin',
                  {
                    elapsedWholeMinutes: elapsedWholeMinutes,
                    sessionDuration: session.duration,
                  },
                )}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Flame className="text-primary-500" size={16} aria-hidden="true" />
          <span className="font-mono">#{chain.currentStreak}</span>
        </div>
      </div>
      {isDurationless && lastCompletionTime !== null && (
        <div className="mt-4 font-chinese text-sm text-gray-500 dark:text-gray-400">
          {formatLastCompletionReference(lastCompletionTime, language)}
        </div>
      )}
      {minimumConfigured && !hasReachedMinimum && (
        <div className="mt-4 flex items-center justify-center space-x-2 font-chinese text-lg text-indigo-600 dark:text-indigo-400">
          <Hourglass className="text-indigo-500" size={16} aria-hidden="true" />
          <span>
            {t(
              'focusMode.focusTimerPanel.needMinimumCountdownMinutesMMinimumCountdownSecondsSToReachTheMinimum',
              {
                minimumCountdownMinutes: Math.floor(minimumCountdown / 60),
                minimumCountdownSeconds: minimumCountdown % 60,
              },
            )}
          </span>
        </div>
      )}
      {minimumConfigured && hasReachedMinimum && (
        <div className="mt-4 flex items-center justify-center space-x-2 font-chinese text-lg text-green-600 dark:text-green-400">
          <CheckCircle
            className="text-green-500"
            size={16}
            aria-hidden="true"
          />
          <span>
            {t(
              'focusMode.focusTimerPanel.minimumDurationReachedChainMinimumDurationMinYouCanComplete',
              { chainMinimumDuration: chain.minimumDuration },
            )}
          </span>
        </div>
      )}
    </section>
  );
}
