import { type Translator } from '../../i18n';
import { CheckCircle, Flame, Gift, Star } from 'lucide-react';

type TranslateFn = Translator;

type CheckinStatsSummary = {
  total_points: number;
  total_checkins: number;
  current_streak: number;
};

export function DailyCheckinStatsGrid({
  stats,
  t,
}: {
  stats: CheckinStatsSummary;
  t: TranslateFn;
}) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
      {/* 总积分 */}
      <div className="rounded-lg bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 dark:from-yellow-900/20 dark:to-yellow-800/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
              {t('dailyCheckin.dailyCheckinShared.totalPoints')}
            </p>
            <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
              {stats.total_points}
            </p>
          </div>
          <Star className="h-8 w-8 text-yellow-500" />
        </div>
      </div>

      {/* 连续签到天数 */}
      <div className="rounded-lg bg-gradient-to-br from-red-50 to-red-100 p-4 dark:from-red-900/20 dark:to-red-800/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              {t('dailyCheckin.dailyCheckinShared.streak')}
            </p>
            <p className="text-2xl font-bold text-red-800 dark:text-red-200">
              {stats.current_streak}
            </p>
          </div>
          <Flame className="h-8 w-8 text-red-500" />
        </div>
      </div>

      {/* 总签到次数 */}
      <div className="col-span-2 rounded-lg bg-gradient-to-br from-green-50 to-green-100 p-4 dark:from-green-900/20 dark:to-green-800/20 md:col-span-1">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              {t('dailyCheckin.dailyCheckinShared.totalCheckIns')}
            </p>
            <p className="text-2xl font-bold text-green-800 dark:text-green-200">
              {stats.total_checkins}
            </p>
          </div>
          <Gift className="h-8 w-8 text-green-500" />
        </div>
      </div>
    </div>
  );
}

export function DailyCheckinCheckedInState({ t }: { t: TranslateFn }) {
  return (
    <div className="py-4 text-center">
      <CheckCircle className="mx-auto mb-3 h-16 w-16 text-green-500" />
      <p className="text-lg font-semibold text-green-700 dark:text-green-300">
        {t('dailyCheckin.dailyCheckinShared.checkedInToday')}
      </p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {t('dailyCheckin.dailyCheckinShared.comeBackTomorrowForMorePoints')}
      </p>
    </div>
  );
}
