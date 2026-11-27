import { TrendingUp } from 'lucide-react';
import type { StreakPoint } from '../../domain/completionStats';
import { StepLineChart } from '../charts/StepLineChart';
import type { TranslationFn } from './types';

/** How the streak rose and reset over the most recent records. */
export function ChainDetailStreak({
  points,
  locale,
  t,
}: {
  points: StreakPoint[];
  locale: string;
  t: TranslationFn;
}) {
  const formatDate = (date: Date) =>
    date.toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const best = Math.max(0, ...points.map((point) => point.streak));
  const current = points[points.length - 1]?.streak ?? 0;

  return (
    <div className="bento-card animate-scale-in">
      <h3 className="mb-6 flex items-center space-x-3 font-chinese text-xl font-bold text-[#161615] dark:text-slate-100">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10">
          <TrendingUp className="text-violet-500" size={20} />
        </div>
        <div>
          <span>{t('chainDetail.streak.title')}</span>
          <p className="font-mono text-xs tracking-wide text-gray-500 dark:text-slate-400">
            {t('chainDetail.streak.subtitle', { count: points.length })}
          </p>
        </div>
      </h3>
      {points.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {t('chainDetail.hours.empty')}
        </p>
      ) : (
        <StepLineChart
          label={t('chainDetail.streak.title')}
          summary={t('chainDetail.streak.summary', { best, current })}
          points={points.map((point) => ({
            key: point.completedAt.toISOString(),
            value: point.streak,
            description: point.wasSuccessful
              ? t('chainDetail.streak.point', {
                  date: formatDate(point.completedAt),
                  streak: point.streak,
                })
              : t('chainDetail.streak.failedPoint', {
                  date: formatDate(point.completedAt),
                }),
          }))}
        />
      )}
    </div>
  );
}
