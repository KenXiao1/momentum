import React from 'react';
import {
  CheckCircle,
  Gift,
  Calendar,
  Star,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useCheckinDomain } from '../hooks/domains/useCheckinDomain';
import { useI18n } from '../i18n';
import {
  DailyCheckinCheckedInState,
  DailyCheckinStatsGrid,
} from './daily-checkin/DailyCheckinShared';

interface DailyCheckinProps {
  className?: string;
}

export const DailyCheckin: React.FC<DailyCheckinProps> = ({
  className = '',
}) => {
  const { t } = useI18n();
  const {
    stats,
    isLoading,
    isCheckingIn,
    error,
    successMessage,
    isCollapsed,
    clearError,
    toggleCollapsed,
    loadStats,
    handleCheckin,
  } = useCheckinDomain();

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <div
        className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}
      >
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          <span className="ml-3 text-gray-600 dark:text-gray-300">
            {t('dailyCheckin.loadingCheckInData')}
          </span>
        </div>
      </div>
    );
  }

  // 如果有错误且没有数据，显示错误状态
  if (error && !stats) {
    return (
      <div
        className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}
      >
        <div className="flex items-center justify-center py-8">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <div className="ml-3">
            <p className="font-medium text-red-600 dark:text-red-400">
              {t('dailyCheckin.dailyCheckInUnavailable')}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {error}
            </p>
            <button
              type="button"
              onClick={loadStats}
              aria-label={t('accountModal.retry')}
              className="mt-2 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
            >
              {t('accountModal.retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      {/* 标题 */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={t('dailyCheckin.toggleCheckIn')}
          aria-expanded={!isCollapsed}
          className="flex items-center text-xl font-semibold text-gray-900 transition-colors hover:text-primary-600 dark:text-gray-100 dark:hover:text-primary-400"
        >
          <Calendar
            className="mr-2 h-5 w-5 text-primary-500"
            aria-hidden="true"
          />
          {t('dailyCheckin.dailyCheckIn')}
          {isCollapsed ? (
            <ChevronDown
              className="ml-2 h-5 w-5 text-gray-500"
              aria-hidden="true"
            />
          ) : (
            <ChevronUp
              className="ml-2 h-5 w-5 text-gray-500"
              aria-hidden="true"
            />
          )}
        </button>
        <div className="flex items-center space-x-2">
          {/* 快速状态指示器（折叠时显示） */}
          {isCollapsed && stats && (
            <div className="flex items-center space-x-3 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center">
                <Star className="mr-1 h-4 w-4 text-yellow-500" />
                {stats.total_points}
              </div>
              {stats.has_checked_in_today ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              )}
            </div>
          )}
          <button
            type="button"
            onClick={loadStats}
            aria-label={t('dailyCheckin.refresh')}
            className="p-1 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
            title={t('dailyCheckin.refresh')}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 可折叠内容区域 */}
      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100'} `}
      >
        {/* 统计信息 */}
        {stats && <DailyCheckinStatsGrid stats={stats} t={t} />}

        {/* 签到按钮 */}
        <div className="space-y-4">
          {stats?.has_checked_in_today ? (
            <DailyCheckinCheckedInState t={t} />
          ) : (
            <button
              type="button"
              onClick={handleCheckin}
              disabled={isCheckingIn}
              aria-label={t('dailyCheckin.checkInNow')}
              className={`w-full rounded-xl px-6 py-4 text-lg font-semibold transition duration-200 ${
                isCheckingIn
                  ? 'cursor-not-allowed bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  : 'transform bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg hover:scale-[1.02] hover:from-primary-600 hover:to-primary-700 hover:shadow-xl active:scale-[0.98]'
              } `}
            >
              {isCheckingIn ? (
                <div className="flex items-center justify-center">
                  <Loader2
                    className="mr-3 h-6 w-6 animate-spin"
                    aria-hidden="true"
                  />
                  {t('dailyCheckin.checkingIn')}
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <Gift className="mr-3 h-6 w-6" aria-hidden="true" />
                  {t('dailyCheckin.checkInNow')}
                </div>
              )}
            </button>
          )}

          {/* 成功消息 */}
          {successMessage && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
              <div className="flex items-center">
                <CheckCircle className="mr-3 h-5 w-5 text-green-500" />
                <p className="font-medium text-green-700 dark:text-green-300">
                  {successMessage}
                </p>
              </div>
            </div>
          )}

          {/* 错误消息 */}
          {error && stats && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertCircle className="mr-3 h-5 w-5 text-red-500" />
                  <p className="text-red-700 dark:text-red-300">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={clearError}
                  aria-label={t('accountModal.close')}
                  className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* 最佳连续记录 */}
          {stats && stats.longest_streak > stats.current_streak && (
            <div className="border-t border-gray-200 py-2 text-center dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('dailyCheckin.bestStreak')}{' '}
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {stats.longest_streak}
                </span>{' '}
                {t('dailyCheckin.days')}
              </p>
            </div>
          )}
        </div>
      </div>
      {/* 折叠内容区域结束 */}
    </div>
  );
};
