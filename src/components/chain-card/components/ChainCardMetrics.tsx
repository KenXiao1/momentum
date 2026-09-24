import { Calendar, Clock, Flame, Sparkles } from 'lucide-react';
import {
  formatTime,
  formatTimeDescriptionByLanguage,
} from '../../../utils/time';
import type { ChainCardViewProps } from '../types';

const STREAK_MILESTONES = [7, 30, 100, 365];

type ChainCardMetricsProps = Pick<
  ChainCardViewProps,
  'chain' | 'language' | 't' | 'lastCompletionTime'
>;

function getDurationText({
  chain,
  language,
  lastCompletionTime,
  t,
}: {
  chain: ChainCardViewProps['chain'];
  language: ChainCardViewProps['language'];
  lastCompletionTime: ChainCardViewProps['lastCompletionTime'];
  t: ChainCardViewProps['t'];
}) {
  if (!chain.isDurationless && chain.duration !== 0) {
    return formatTime(chain.duration, language);
  }
  if (!lastCompletionTime) return t('chainCard.chainCardMetrics.firstTime');
  return `${t('chainCard.chainCardMetrics.last')}${formatTimeDescriptionByLanguage(lastCompletionTime, language)}`;
}

export function ChainCardMetrics({
  chain,
  language,
  t: t,
  lastCompletionTime,
}: ChainCardMetricsProps) {
  const durationText = getDurationText({
    chain,
    language,
    lastCompletionTime,
    t,
  });
  const completionsText =
    chain.totalCompletions === 1
      ? t('counts.completion', { count: chain.totalCompletions })
      : t('counts.completions', { count: chain.totalCompletions });
  const isMilestone =
    chain.currentStreak > 0 && STREAK_MILESTONES.includes(chain.currentStreak);

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-primary-200/50 bg-gradient-to-br from-primary-500/10 to-primary-600/5 p-4 text-center dark:border-primary-400/30 dark:from-primary-500/20 dark:to-primary-600/10">
          {chain.currentStreak === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-0.5">
              <Sparkles
                size={18}
                className="text-primary-400 dark:text-primary-500"
                aria-hidden="true"
              />
              <span className="font-chinese text-xs font-semibold text-primary-600 dark:text-primary-400">
                {t('chainCard.chainCardMetrics.startFirstChain')}
              </span>
            </div>
          ) : (
            <div
              className={`mb-2 flex items-center justify-center space-x-2 text-primary-500 ${isMilestone ? 'animate-milestone-glow' : ''}`}
            >
              <Flame size={18} aria-hidden="true" />
              <span className="font-mono text-3xl font-bold">
                #{chain.currentStreak}
              </span>
            </div>
          )}
          <div className="font-chinese text-xs font-medium text-gray-600 dark:text-slate-400">
            {t('chainCard.chainCardMetrics.mainStreak')}
          </div>
        </div>
        <div className="rounded-2xl border border-blue-200/50 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-4 text-center dark:border-blue-400/30 dark:from-blue-500/20 dark:to-blue-600/10">
          {chain.auxiliaryStreak === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-0.5">
              <Calendar
                size={18}
                className="text-blue-400 dark:text-blue-500"
                aria-hidden="true"
              />
              <span className="font-chinese text-xs font-semibold text-blue-500 dark:text-blue-400">
                {t('chainCard.chainCardMetrics.noBookingsYet')}
              </span>
            </div>
          ) : (
            <div className="mb-2 flex items-center justify-center space-x-2 text-blue-500">
              <Calendar size={18} aria-hidden="true" />
              <span className="font-mono text-3xl font-bold">
                #{chain.auxiliaryStreak}
              </span>
            </div>
          )}
          <div className="font-chinese text-xs font-medium text-gray-600 dark:text-slate-400">
            {t('chainCard.chainCardMetrics.bookingStreak')}
          </div>
        </div>
      </div>
      <div className="mb-6 flex items-center justify-between rounded-xl bg-gray-50 p-3 dark:bg-slate-700/50">
        <div className="flex items-center space-x-2 text-gray-700 dark:text-slate-300">
          <Clock size={16} aria-hidden="true" />
          <span className="font-medium">{durationText}</span>
        </div>
        <div className="font-mono text-sm text-gray-600 dark:text-slate-400">
          {completionsText}
        </div>
      </div>
    </>
  );
}
