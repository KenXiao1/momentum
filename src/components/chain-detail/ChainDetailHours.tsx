import { Clock3 } from 'lucide-react';
import type { HourBucket } from '../../domain/completionStats';
import { BarChart } from '../charts/BarChart';
import type { TranslationFn } from './types';

const pad = (value: number) => String(value).padStart(2, '0');
const hourRange = (hour: number) => `${pad(hour)}:00–${pad(hour + 1)}:00`;

/** When in the day this chain usually gets done. */
export function ChainDetailHours({
  hours,
  t,
}: {
  hours: HourBucket[];
  t: TranslationFn;
}) {
  const peak = hours.reduce((best, bucket) =>
    bucket.successes > best.successes ? bucket : best,
  );

  return (
    <div className="bento-card animate-scale-in">
      <h3 className="mb-6 flex items-center space-x-3 font-chinese text-xl font-bold text-[#161615] dark:text-slate-100">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10">
          <Clock3 className="text-violet-500" size={20} />
        </div>
        <div>
          <span>{t('chainDetail.hours.title')}</span>
          <p className="font-mono text-xs tracking-wide text-gray-500 dark:text-slate-400">
            {t('chainDetail.hours.subtitle')}
          </p>
        </div>
      </h3>
      {peak.successes === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {t('chainDetail.hours.empty')}
        </p>
      ) : (
        <BarChart
          label={t('chainDetail.hours.title')}
          summary={t('chainDetail.hours.summary', {
            range: hourRange(peak.hour),
            completions: peak.successes,
          })}
          data={hours.map((bucket) => ({
            key: String(bucket.hour),
            tick: bucket.hour % 3 === 0 ? String(bucket.hour) : '',
            value: bucket.successes,
            description: t('chainDetail.hours.bar', {
              range: hourRange(bucket.hour),
              completions: bucket.successes,
              failures: bucket.failures,
            }),
          }))}
        />
      )}
    </div>
  );
}
