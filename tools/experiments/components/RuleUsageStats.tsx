/**
 * 规则使用统计界面组件
 * 显示规则使用频率、历史记录和分析数据
 */

import React, { useState, useEffect } from 'react';
import {
  ExceptionRule,
  RuleUsageStats as RuleUsageStatsType,
  OverallUsageStats,
  RuleUsageRecord,
} from '../types';
import { exceptionRuleManager } from '../services/ExceptionRuleManager';
import { ruleUsageTracker } from '../services/RuleUsageTracker';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Calendar,
  Activity,
  PieChart,
  Filter,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface RuleUsageStatsProps {
  onClose: () => void;
  selectedRuleId?: string;
}

export const RuleUsageStats: React.FC<RuleUsageStatsProps> = ({
  onClose,
  selectedRuleId,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 数据状态
  const [overallStats, setOverallStats] = useState<OverallUsageStats | null>(
    null,
  );
  const [rules, setRules] = useState<ExceptionRule[]>([]);
  const [selectedRule, setSelectedRule] = useState<ExceptionRule | null>(null);
  const [ruleStats, setRuleStats] = useState<RuleUsageStatsType | null>(null);
  const [usageHistory, setUsageHistory] = useState<RuleUsageRecord[]>([]);
  const [usageTrend, setUsageTrend] = useState<{
    trend: Array<{ date: string; count: number }>;
    totalUsage: number;
    averageDailyUsage: number;
    peakUsageDate: string | null;
  } | null>(null);

  // 界面状态
  const [activeTab, setActiveTab] = useState<'overview' | 'rules' | 'trends'>(
    'overview',
  );
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overview']),
  );

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  // 选择规则时加载详细数据
  useEffect(() => {
    if (selectedRule) {
      loadRuleDetails(selectedRule.id);
    }
  }, [selectedRule, timeRange]);

  // 初始选择规则
  useEffect(() => {
    if (selectedRuleId && rules.length > 0) {
      const rule = rules.find((r) => r.id === selectedRuleId);
      if (rule) {
        setSelectedRule(rule);
        setActiveTab('rules');
      }
    }
  }, [selectedRuleId, rules]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 加载整体统计
      const overall = await exceptionRuleManager.getOverallStats();
      setOverallStats(overall);

      // 加载所有规则
      const allRules = await exceptionRuleManager.getAllRules();
      const activeRules = allRules.filter((rule) => rule.isActive);
      setRules(activeRules);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadRuleDetails = async (ruleId: string) => {
    try {
      // 加载规则统计
      const stats = await exceptionRuleManager.getRuleStats(ruleId);
      setRuleStats(stats);

      // 加载使用历史
      const history = await exceptionRuleManager.getRuleUsageHistory(
        ruleId,
        50,
      );
      setUsageHistory(history);

      // 加载使用趋势
      const trend = await ruleUsageTracker.getRuleUsageTrend(ruleId, timeRange);
      setUsageTrend(trend);
    } catch (err) {
      console.error('加载规则详情失败:', err);
    }
  };

  const handleExportStats = async () => {
    try {
      const exportData = await ruleUsageTracker.exportUsageData('json');
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rule-usage-stats-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('导出统计数据失败');
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const formatUsageTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}小时${remainingMinutes > 0 ? `${remainingMinutes}分钟` : ''}`;
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
    return date.toLocaleDateString('zh-CN');
  };

  const getUsagePercentage = (count: number, total: number): number => {
    return total > 0 ? Math.round((count / total) * 100) : 0;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="rounded-3xl bg-white p-8 dark:bg-gray-800">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500"></div>
          <p className="mt-4 text-center text-gray-600 dark:text-gray-400">
            加载统计数据中...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-800">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500/20">
              <BarChart3 className="text-primary-500" size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                使用统计
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                例外规则使用情况分析
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={timeRange}
              onChange={(e) =>
                setTimeRange(Number(e.target.value) as 7 | 30 | 90)
              }
              className="rounded-xl border-0 bg-gray-100 px-3 py-2 text-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none dark:bg-gray-700 dark:text-gray-300"
            >
              <option value={7}>最近7天</option>
              <option value={30}>最近30天</option>
              <option value={90}>最近90天</option>
            </select>

            <button
              onClick={handleExportStats}
              className="flex items-center space-x-2 rounded-xl bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              <Download size={16} />
              <span>导出</span>
            </button>

            <button
              onClick={loadData}
              className="flex items-center space-x-2 rounded-xl bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              <RefreshCw size={16} />
              <span>刷新</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-xl bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              关闭
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mx-6 mt-4 flex items-center space-x-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
            <Activity className="text-red-500" size={20} />
            <span className="text-red-700 dark:text-red-300">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex h-[calc(90vh-120px)]">
          {/* 侧边栏 */}
          <div className="w-80 overflow-y-auto border-r border-gray-200 dark:border-gray-700">
            {/* 标签页 */}
            <div className="border-b border-gray-200 p-4 dark:border-gray-700">
              <div className="flex space-x-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-700">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'overview'
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  总览
                </button>
                <button
                  onClick={() => setActiveTab('rules')}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'rules'
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  规则详情
                </button>
                <button
                  onClick={() => setActiveTab('trends')}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'trends'
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  趋势分析
                </button>
              </div>
            </div>

            {/* 总览标签页 */}
            {activeTab === 'overview' && overallStats && (
              <div className="space-y-4 p-4">
                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-700/50">
                  <h3 className="mb-3 font-medium text-gray-900 dark:text-white">
                    整体统计
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        总规则数
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {overallStats.totalRules}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        总使用次数
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {overallStats.totalUsage}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        暂停使用
                      </span>
                      <span className="font-medium text-yellow-600 dark:text-yellow-400">
                        {overallStats.pauseUsage} (
                        {getUsagePercentage(
                          overallStats.pauseUsage,
                          overallStats.totalUsage,
                        )}
                        %)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        提前完成
                      </span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {overallStats.earlyCompletionUsage} (
                        {getUsagePercentage(
                          overallStats.earlyCompletionUsage,
                          overallStats.totalUsage,
                        )}
                        %)
                      </span>
                    </div>
                  </div>
                </div>

                {/* 最常用规则 */}
                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-700/50">
                  <h3 className="mb-3 font-medium text-gray-900 dark:text-white">
                    最常用规则
                  </h3>
                  <div className="space-y-2">
                    {overallStats.mostUsedRules
                      .slice(0, 5)
                      .map((rule, index) => (
                        <div
                          key={rule.ruleId}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-xs text-white">
                              {index + 1}
                            </span>
                            <span className="truncate text-sm text-gray-900 dark:text-white">
                              {rule.ruleName}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            {rule.count}次
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* 规则详情标签页 */}
            {activeTab === 'rules' && (
              <div className="p-4">
                <h3 className="mb-3 font-medium text-gray-900 dark:text-white">
                  选择规则
                </h3>
                <div className="space-y-2">
                  {rules.map((rule) => (
                    <button
                      key={rule.id}
                      onClick={() => setSelectedRule(rule)}
                      className={`w-full rounded-xl p-3 text-left transition-colors ${
                        selectedRule?.id === rule.id
                          ? 'border border-primary-200 bg-primary-50 dark:border-primary-500/30 dark:bg-primary-500/10'
                          : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-700/50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="mb-1 font-medium text-gray-900 dark:text-white">
                        {rule.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        使用 {rule.usageCount} 次
                        {rule.lastUsedAt && ` • ${formatDate(rule.lastUsedAt)}`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 主内容区域 */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'overview' && overallStats && (
              <div className="p-6">
                <h3 className="mb-6 text-xl font-bold text-gray-900 dark:text-white">
                  使用概览
                </h3>

                {/* 使用分布图表占位符 */}
                <div className="mb-6 rounded-2xl bg-gray-50 p-6 dark:bg-gray-700/50">
                  <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
                    <div className="text-center">
                      <PieChart size={48} className="mx-auto mb-4" />
                      <p>使用分布图表</p>
                      <p className="text-sm">
                        暂停: {overallStats.pauseUsage} | 提前完成:{' '}
                        {overallStats.earlyCompletionUsage}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 详细统计 */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="rounded-2xl bg-gray-50 p-6 dark:bg-gray-700/50">
                    <h4 className="mb-4 font-medium text-gray-900 dark:text-white">
                      规则类型分布
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          暂停规则
                        </span>
                        <span className="font-medium text-yellow-600 dark:text-yellow-400">
                          {rules.filter((r) => r.type === 'pause_only').length}
                          个
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          完成规则
                        </span>
                        <span className="font-medium text-green-600 dark:text-green-400">
                          {
                            rules.filter(
                              (r) => r.type === 'early_completion_only',
                            ).length
                          }
                          个
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-6 dark:bg-gray-700/50">
                    <h4 className="mb-4 font-medium text-gray-900 dark:text-white">
                      使用频率
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          平均每规则
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {overallStats.totalRules > 0
                            ? Math.round(
                                overallStats.totalUsage /
                                  overallStats.totalRules,
                              )
                            : 0}
                          次
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          最高使用
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {overallStats.mostUsedRules[0]?.count || 0}次
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'rules' && selectedRule && ruleStats && (
              <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {selectedRule.name}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {selectedRule.description || '无描述'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary-500">
                      {ruleStats.totalUsage}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      总使用次数
                    </div>
                  </div>
                </div>

                {/* 规则统计卡片 */}
                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-500/30 dark:bg-yellow-500/10">
                    <div className="flex items-center space-x-3">
                      <Clock
                        className="text-yellow-600 dark:text-yellow-400"
                        size={24}
                      />
                      <div>
                        <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                          {ruleStats.pauseUsage}
                        </div>
                        <div className="text-sm text-yellow-700 dark:text-yellow-300">
                          暂停使用
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-green-200 bg-green-50 p-4 dark:border-green-500/30 dark:bg-green-500/10">
                    <div className="flex items-center space-x-3">
                      <TrendingUp
                        className="text-green-600 dark:text-green-400"
                        size={24}
                      />
                      <div>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {ruleStats.earlyCompletionUsage}
                        </div>
                        <div className="text-sm text-green-700 dark:text-green-300">
                          提前完成
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
                    <div className="flex items-center space-x-3">
                      <Activity
                        className="text-blue-600 dark:text-blue-400"
                        size={24}
                      />
                      <div>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {formatUsageTime(ruleStats.averageTaskElapsedTime)}
                        </div>
                        <div className="text-sm text-blue-700 dark:text-blue-300">
                          平均使用时机
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 使用历史 */}
                <div className="rounded-2xl bg-gray-50 p-6 dark:bg-gray-700/50">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      使用历史
                    </h4>
                    <button
                      onClick={() => toggleSection('history')}
                      className="flex items-center space-x-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    >
                      <span className="text-sm">
                        {expandedSections.has('history') ? '收起' : '展开'}
                      </span>
                      {expandedSections.has('history') ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </button>
                  </div>

                  {expandedSections.has('history') && (
                    <div className="max-h-64 space-y-3 overflow-y-auto">
                      {usageHistory.length === 0 ? (
                        <p className="py-4 text-center text-gray-500 dark:text-gray-400">
                          暂无使用记录
                        </p>
                      ) : (
                        usageHistory.map((record) => (
                          <div
                            key={record.id}
                            className="flex items-center justify-between border-b border-gray-200 py-2 last:border-b-0 dark:border-gray-600"
                          >
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {record.actionType === 'pause'
                                  ? '暂停计时'
                                  : '提前完成'}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                任务进行{' '}
                                {formatUsageTime(record.taskElapsedTime)}
                                {record.taskRemainingTime &&
                                  ` • 剩余 ${formatUsageTime(record.taskRemainingTime)}`}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(record.usedAt)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'trends' && usageTrend && (
              <div className="p-6">
                <h3 className="mb-6 text-xl font-bold text-gray-900 dark:text-white">
                  使用趋势
                </h3>

                {/* 趋势图表占位符 */}
                <div className="mb-6 rounded-2xl bg-gray-50 p-6 dark:bg-gray-700/50">
                  <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
                    <div className="text-center">
                      <BarChart3 size={48} className="mx-auto mb-4" />
                      <p>使用趋势图表</p>
                      <p className="text-sm">
                        {timeRange}天内总使用 {usageTrend.totalUsage} 次， 日均{' '}
                        {usageTrend.averageDailyUsage.toFixed(1)} 次
                      </p>
                      {usageTrend.peakUsageDate && (
                        <p className="text-sm">
                          峰值日期: {usageTrend.peakUsageDate}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 趋势统计 */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-700/50">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {usageTrend.totalUsage}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {timeRange}天总使用
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-700/50">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {usageTrend.averageDailyUsage.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      日均使用次数
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-700/50">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {usageTrend.peakUsageDate
                        ? new Date(usageTrend.peakUsageDate).getDate()
                        : '-'}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      峰值使用日
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
