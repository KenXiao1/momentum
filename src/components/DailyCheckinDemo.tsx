import React, { useState } from 'react';
import { CheckCircle, Gift, Calendar, Flame, Star, Loader2, AlertCircle } from 'lucide-react';

interface DailyCheckinDemoProps {
  className?: string;
}

export const DailyCheckinDemo: React.FC<DailyCheckinDemoProps> = ({ className = '' }) => {
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [stats, setStats] = useState({
    total_points: 120,
    total_checkins: 12,
    current_streak: 5,
    longest_streak: 8,
    has_checked_in_today: false
  });

  const handleCheckin = async () => {
    setIsCheckingIn(true);
    // 模拟签到过程
    setTimeout(() => {
      setStats(prev => ({
        ...prev,
        total_points: prev.total_points + 10,
        total_checkins: prev.total_checkins + 1,
        current_streak: prev.current_streak + 1,
        has_checked_in_today: true
      }));
      setHasCheckedIn(true);
      setIsCheckingIn(false);
    }, 1500);
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      {/* 演示标签 */}
      <div className="mb-4 text-center">
        <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm rounded-full">
          🚀 演示模式 - Demo Mode
        </span>
      </div>

      {/* 标题 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-primary-500" />
          每日签到
        </h2>
        <button 
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="刷新数据"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {/* 总积分 */}
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">总积分</p>
              <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">{stats.total_points}</p>
            </div>
            <Star className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        {/* 连续签到天数 */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700 dark:text-red-300 font-medium">连续天数</p>
              <p className="text-2xl font-bold text-red-800 dark:text-red-200">{stats.current_streak}</p>
            </div>
            <Flame className="w-8 h-8 text-red-500" />
          </div>
        </div>

        {/* 总签到次数 */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 dark:text-green-300 font-medium">总签到</p>
              <p className="text-2xl font-bold text-green-800 dark:text-green-200">{stats.total_checkins}</p>
            </div>
            <Gift className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* 签到按钮 */}
      <div className="space-y-4">
        {stats.has_checked_in_today || hasCheckedIn ? (
          <div className="text-center py-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-semibold text-green-700 dark:text-green-300">今天已签到</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              明天再来获取更多积分吧！
            </p>
          </div>
        ) : (
          <button
            onClick={handleCheckin}
            disabled={isCheckingIn}
            className={`
              w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200
              ${isCheckingIn 
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
              }
            `}
          >
            <div className="flex items-center justify-center space-x-2">
              {isCheckingIn ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>签到中...</span>
                </>
              ) : (
                <>
                  <Gift className="w-6 h-6" />
                  <span>每日签到 +10 积分</span>
                </>
              )}
            </div>
          </button>
        )}

        {/* 说明文字 */}
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            每日签到获得 10 积分，连续签到获得更多奖励
          </p>
        </div>
      </div>

      {/* 演示说明 */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
              演示模式说明
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-300 leading-relaxed">
              这是签到功能的演示版本。要使用真实功能，请配置 Supabase 环境变量并运行数据库迁移。
              配置完成后，此演示版本将被正式版本自动替换。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};