import { useMemo, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { weeklyReview, type PeriodStats } from '../../domain/completionStats';
import type { Translator } from '../../i18n';
import type { Chain, CompletionHistory } from '../../types';
import { BarChart } from '../charts/BarChart';

interface WeeklyReviewCardProps {
  history: CompletionHistory[];
  chains: Chain[];
  language: 'zh' | 'en';
  t: Translator;
}

function parseDay(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** This week against last week; hidden until either has a session. */
export function WeeklyReviewCard({
  history,
  chains,
  language,
  t,
}: WeeklyReviewCardProps) {
  const locale = language === 'zh' ? 'zh-CN' : 'en-US';
  // The week is the one the dashboard was opened in.
  const [openedAt] = useState(() => new Date());
  const review = useMemo(
    () => weeklyReview(history, chains, openedAt),
    [history, chains, openedAt],
  );
  const { thisWeek, lastWeek } = review;
  if (
    thisWeek.completions +
      thisWeek.failures +
      lastWeek.completions +
      lastWeek.failures ===
    0
  )
    return null;

  const duration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const rest = Math.round(minutes % 60);
    return hours > 0
      ? t('weeklyReview.hoursMinutes', { hours, minutes: rest })
      : t('weeklyReview.minutesOnly', { minutes: rest });
  };
  const rate = (stats: PeriodStats) =>
    stats.successRate === null
      ? t('weeklyReview.noValue')
      : `${Math.round(stats.successRate * 100)}%`;
  const shortDate = (date: string) =>
    parseDay(date).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
    });
  const weekday = (date: string) =>
    parseDay(date).toLocaleDateString(locale, { weekday: 'short' });

  const tiles = [
    {
      label: t('weeklyReview.completions'),
      value: String(thisWeek.completions),
      last: String(lastWeek.completions),
    },
    {
      label: t('weeklyReview.focus'),
      value: duration(thisWeek.focusMinutes),
      last: duration(lastWeek.focusMinutes),
    },
    {
      label: t('weeklyReview.successRate'),
      value: rate(thisWeek),
      last: rate(lastWeek),
    },
    {
      label: t('weeklyReview.activeDays'),
      value: t('weeklyReview.activeDaysValue', { days: thisWeek.activeDays }),
      last: t('weeklyReview.activeDaysValue', { days: lastWeek.activeDays }),
    },
  ];

  return (
    <section
      aria-labelledby="weekly-review-title"
      className="bento-card mb-12 animate-scale-in"
    >
      <h2
        id="weekly-review-title"
        className="mb-6 flex items-center space-x-3 font-chinese text-xl font-bold text-[#161615] dark:text-slate-100"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10">
          <CalendarRange className="text-violet-500" size={20} />
        </span>
        <span>
          <span className="block">{t('weeklyReview.title')}</span>
          <span className="block font-mono text-xs font-normal tracking-wide text-gray-500 dark:text-slate-400">
            {t('weeklyReview.range', {
              start: shortDate(review.days[0].date),
              end: shortDate(review.days[6].date),
            })}
          </span>
        </span>
      </h2>

      <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-2xl bg-gray-50 p-3 dark:bg-slate-700/60"
          >
            <dt className="text-xs text-gray-500 dark:text-slate-400">
              {tile.label}
            </dt>
            <dd className="mt-1 text-xl font-bold text-gray-900 dark:text-slate-100">
              {tile.value}
            </dd>
            <dd className="text-xs text-gray-500 dark:text-slate-400">
              {t('weeklyReview.lastWeek', { value: tile.last })}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <BarChart
            label={t('weeklyReview.chart')}
            summary={t('weeklyReview.daysSummary', {
              completions: thisWeek.completions,
            })}
            heightClass="h-24"
            data={review.days.map((day) => ({
              key: day.date,
              tick: weekday(day.date),
              value: day.completions,
              pending: day.future,
              description: t('weeklyReview.day', {
                date: shortDate(day.date),
                completions: day.completions,
                focus: duration(day.focusMinutes),
              }),
            }))}
          />
        </div>
        {review.topChains.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-slate-300">
              {t('weeklyReview.topChains')}
            </h3>
            <ol className="space-y-2">
              {review.topChains.map((chain) => (
                <li
                  key={chain.chainId}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="truncate text-gray-900 dark:text-slate-100">
                    {chain.name ?? t('weeklyReview.deletedChain')}
                  </span>
                  <span className="shrink-0 text-xs text-gray-500 dark:text-slate-400">
                    {t('weeklyReview.chainLine', {
                      completions: chain.completions,
                      focus: duration(chain.focusMinutes),
                    })}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
