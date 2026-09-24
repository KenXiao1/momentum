import type { ActiveSession, Chain } from '../../types';
import { CheckCircle, Settings } from 'lucide-react';
import { useI18n } from '../../i18n';

interface FocusModeControlsProps {
  session: ActiveSession;
  chain: Chain;
  isDurationless: boolean;
  hasReachedMinimum: boolean;
  onPauseClick: () => void;
  onEarlyCompleteClick: () => void;

  autoResumeAt: number | null;
  resumeCountdown: number;
  elapsedPauseTime: number;
  onResumeNow: () => void;
  onCancelAutoResume: () => void;
}

export function FocusModeControls({
  session,
  chain,
  isDurationless,
  hasReachedMinimum,
  onPauseClick,
  onEarlyCompleteClick,
  autoResumeAt,
  resumeCountdown,
  elapsedPauseTime,
  onResumeNow,
  onCancelAutoResume,
}: FocusModeControlsProps) {
  const { t } = useI18n();
  return (
    <>
      {!session.isPaused && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {isDurationless ? (
            <>
              <button
                type="button"
                onClick={onPauseClick}
                className="focus-ring flex min-h-12 items-center gap-2 rounded-xl border border-gray-300 bg-[var(--surface-raised)] px-5 py-3 font-chinese font-medium text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-950 dark:border-slate-600 dark:text-slate-200 dark:hover:text-white"
              >
                <Settings size={16} />
                <span>{t('focusMode.focusModeControls.pause')}</span>
              </button>
              {(!chain.minimumDuration || chain.minimumDuration === 0) && (
                <button
                  type="button"
                  onClick={onEarlyCompleteClick}
                  className="focus-ring flex min-h-12 items-center gap-2 rounded-xl bg-gray-950 px-7 py-3 font-chinese font-semibold text-white transition-colors hover:bg-green-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-green-300"
                >
                  <CheckCircle size={20} />
                  <span>{t('focusMode.focusModeControls.complete')}</span>
                </button>
              )}

              {chain.minimumDuration && chain.minimumDuration > 0 && (
                <>
                  {!hasReachedMinimum ? (
                    <button
                      type="button"
                      onClick={onEarlyCompleteClick}
                      className="focus-ring flex min-h-12 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 font-chinese font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                    >
                      <CheckCircle size={16} />
                      <span>
                        {t('focusMode.focusModeControls.completeEarly')}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onEarlyCompleteClick}
                      className="focus-ring flex min-h-12 items-center gap-2 rounded-xl bg-gray-950 px-7 py-3 font-chinese font-semibold text-white transition-colors hover:bg-green-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-green-300"
                    >
                      <CheckCircle size={20} />
                      <span>{t('focusMode.focusModeControls.complete')}</span>
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onPauseClick}
                className="focus-ring flex min-h-12 items-center gap-2 rounded-xl border border-gray-300 bg-[var(--surface-raised)] px-5 py-3 font-chinese font-medium text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-950 dark:border-slate-600 dark:text-slate-200 dark:hover:text-white"
              >
                <Settings size={16} />
                <span>{t('focusMode.focusModeControls.pause')}</span>
              </button>
              <button
                type="button"
                onClick={onEarlyCompleteClick}
                className="focus-ring flex min-h-12 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 font-chinese font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
              >
                <CheckCircle size={16} />
                <span>{t('focusMode.focusModeControls.completeEarly')}</span>
              </button>
            </>
          )}
        </div>
      )}

      {session.isPaused && (
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="font-chinese text-gray-700 dark:text-gray-300">
            {autoResumeAt
              ? t(
                  'focusMode.focusModeControls.pausedAutoResumeInResumeCountdownMinutesMResumeCountdownSecondsS',
                  {
                    resumeCountdownMinutes: Math.floor(resumeCountdown / 60),
                    resumeCountdownSeconds: resumeCountdown % 60,
                  },
                )
              : t(
                  'focusMode.focusModeControls.pausedForElapsedPauseTimeMinutesMElapsedPauseTimeSecondsS',
                  {
                    elapsedPauseTimeMinutes: Math.floor(elapsedPauseTime / 60),
                    elapsedPauseTimeSeconds: elapsedPauseTime % 60,
                  },
                )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onResumeNow}
              className="focus-ring min-h-12 rounded-xl bg-gray-950 px-6 py-3 font-chinese font-semibold text-white transition-colors hover:bg-green-700 dark:bg-slate-100 dark:text-slate-950"
            >
              {t('focusMode.focusModeControls.resume')}
            </button>
            {autoResumeAt && (
              <button
                type="button"
                onClick={onCancelAutoResume}
                className="focus-ring min-h-12 rounded-xl border border-gray-300 bg-[var(--surface-raised)] px-6 py-3 font-chinese text-gray-800 transition-colors hover:bg-gray-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                {t('focusMode.focusModeControls.cancelAutoResume')}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
