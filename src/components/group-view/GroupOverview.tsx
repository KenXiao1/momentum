import { translate } from '../../i18n/translate';
import { AlertTriangle, Clock, Hash, Target, Users } from 'lucide-react';
import type { GroupViewViewProps } from './types';

type Props = Pick<
  GroupViewViewProps,
  'group' | 'language' | 't' | 'progress' | 'unitProgress' | 'timeStatus'
>;

function getProgressBarColor(progress: number) {
  if (progress > 0.8) return 'bg-red-500';
  if (progress > 0.6) return 'bg-orange-500';
  return 'bg-green-500';
}

export function GroupOverview({
  group,
  language,
  t,
  progress,
  unitProgress,
  timeStatus,
}: Props) {
  return (
    <div className="bento-card mb-8 animate-scale-in">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-chinese text-2xl font-bold text-gray-900 dark:text-slate-100">
          {t('groupView.groupOverview.groupOverview')}
        </h2>
        <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-slate-400">
          <div className="flex items-center space-x-2">
            <Users size={16} />
            <span>
              {t('groupView.groupOverview.groupChildrenCountUnits', {
                groupChildrenCount: group.children.length,
              })}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Target size={16} />
            <span>
              {unitProgress.completed}/{unitProgress.total}{' '}
              {t('groupView.groupOverview.completed')}
            </span>
          </div>
          {group.totalCompletions > 0 && (
            <div className="flex items-center space-x-2 font-medium text-amber-600 dark:text-amber-400">
              <Hash size={16} />
              <span>
                {translate(
                  language === 'zh' ? 'zh' : 'en',
                  'groupView.groupOverview.completedGroupTotalCompletionsCycles',
                  { groupTotalCompletions: group.totalCompletions },
                )}
              </span>
            </div>
          )}
          {progress.total !== unitProgress.total && (
            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-slate-500">
              <span>
                {translate(
                  language === 'zh' ? 'zh' : 'en',
                  'groupView.groupOverview.progressCompletedProgressTotalRepeats',
                  {
                    progressCompleted: progress.completed,
                    progressTotal: progress.total,
                  },
                )}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="mb-4 h-4 w-full rounded-full bg-gray-200 dark:bg-slate-700">
        <div
          className="flex h-4 items-center justify-end rounded-full bg-gradient-to-r from-primary-500 to-primary-600 pr-2 transition-[width] duration-500"
          style={{
            width: `${unitProgress.total > 0 ? (unitProgress.completed / unitProgress.total) * 100 : 0}%`,
          }}
        >
          {unitProgress.completed > 0 && (
            <span className="text-xs font-bold text-white">
              {Math.round((unitProgress.completed / unitProgress.total) * 100)}%
            </span>
          )}
        </div>
      </div>
      <p className="font-chinese leading-relaxed text-gray-700 dark:text-slate-300">
        {group.description}
      </p>
      {group.timeLimitHours && (
        <div
          className={`mt-6 rounded-2xl border-l-4 p-4 ${timeStatus.isExpired ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Clock
                size={18}
                className={
                  timeStatus.isExpired ? 'text-red-500' : 'text-orange-500'
                }
              />
              <div>
                <h4
                  className={`font-chinese font-bold ${timeStatus.isExpired ? 'text-red-700 dark:text-red-300' : 'text-orange-700 dark:text-orange-300'}`}
                >
                  {timeStatus.isExpired
                    ? t('groupView.groupOverview.timeExpired')
                    : t('groupView.groupOverview.timeLimit')}
                </h4>
                <p
                  className={`text-sm ${timeStatus.isExpired ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}
                >
                  {timeStatus.formattedTime}
                </p>
              </div>
            </div>
            {!timeStatus.isExpired && (
              <div className="flex items-center space-x-2">
                <div className="h-2 w-24 rounded-full bg-gray-200 dark:bg-slate-700">
                  <div
                    className={`h-2 rounded-full transition-[width,background-color] duration-300 ${getProgressBarColor(timeStatus.progress)}`}
                    style={{ width: `${timeStatus.progress * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  {Math.round(timeStatus.progress * 100)}%
                </span>
              </div>
            )}
          </div>
          {timeStatus.isExpired && (
            <div className="mt-3 flex items-center font-chinese text-sm text-red-600 dark:text-red-400">
              <AlertTriangle size={14} className="mr-2" />
              {t(
                'groupView.groupOverview.thisGroupHasExpiredProgressWillBeClearedPlease',
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
