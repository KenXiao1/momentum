import type { Translator } from '../../i18n/translate';
import { useMemo } from 'react';
import type { RSIPRunRecord } from '../../types';
import { useI18n } from '../../i18n';

interface RSIPRunHistoryProps {
  records: RSIPRunRecord[];
}

function formatCollapseNodeTitle(title: string | undefined, t: Translator) {
  if (!title) return '';
  return t('rsip.rsipRunHistory.collapseNodeTitle', { title });
}

export function RSIPRunHistory({ records }: RSIPRunHistoryProps) {
  const { language, t } = useI18n();

  const sorted = useMemo(
    () => [...records].sort((a, b) => b.runNumber - a.runNumber),
    [records],
  );

  const stats = useMemo(() => {
    if (sorted.length === 0) {
      return {
        totalRuns: 0,
        longestDuration: 0,
        averageMaxNodeCount: 0,
      };
    }
    const longestDuration = Math.max(
      ...sorted.map((item) => item.durationDays),
    );
    const averageMaxNodeCount =
      sorted.reduce((sum, item) => sum + item.maxNodeCount, 0) / sorted.length;
    return {
      totalRuns: sorted.length,
      longestDuration,
      averageMaxNodeCount: Math.round(averageMaxNodeCount * 10) / 10,
    };
  }, [sorted]);

  const dateLocale = language.startsWith('zh') ? 'zh-CN' : 'en-US';

  if (sorted.length === 0) {
    return (
      <div className="bento-card">
        <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-slate-100">
          {t('rsip.rsipRunHistory.runHistory')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-slate-300">
          {t(
            'rsip.rsipRunHistory.noCollapseRecordsYetSignificantRollbacksWillBeRecorded',
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bento-card">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t('rsip.rsipRunHistory.totalRuns')}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {stats.totalRuns}
          </p>
        </div>
        <div className="bento-card">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t('rsip.rsipRunHistory.longestDuration')}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {t('rsip.rsipRunHistory.durationDays', {
              days: stats.longestDuration,
            })}
          </p>
        </div>
        <div className="bento-card">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t('rsip.rsipRunHistory.avgPeakNodes')}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {stats.averageMaxNodeCount}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {sorted.map((record) => (
          <div
            key={`${record.runNumber}-${record.startedAt.getTime()}`}
            className="rounded-2xl border border-gray-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/60"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                {t('rsip.rsipRunHistory.runNumber', {
                  number: record.runNumber,
                })}
              </h3>
              <span className="text-xs text-gray-500 dark:text-slate-400">
                {record.startedAt.toLocaleDateString(dateLocale)} -{' '}
                {record.endedAt?.toLocaleDateString(dateLocale) ??
                  t('rsip.rsipRunHistory.inProgress')}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-300">
              {t('rsip.rsipRunHistory.runSummary', {
                days: record.durationDays,
                count: record.maxNodeCount,
              })}
            </p>
            {record.collapseReason && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-300">
                {t('rsip.rsipRunHistory.collapseReason')}
                {record.collapseReason}
                {formatCollapseNodeTitle(record.collapseNodeTitle, t)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
