/**
 * 规则生命周期管理组件
 * 提供规则归档、合并、清理和维护功能
 */

import React, { useState, useEffect } from 'react';
import {
  ExceptionRule,
  ExceptionRuleType,
  RuleUsageStats,
  ExceptionRuleError,
  ExceptionRuleException,
} from '../types';
import { exceptionRuleManager } from '../services/ExceptionRuleManager';
import { ruleScopeManager } from '../services/RuleScopeManager';
import { chainDeletionHandler } from '../services/ChainDeletionHandler';
import { exceptionRuleCache } from '../utils/exceptionRuleCache';
import {
  Archive,
  Trash2,
  Merge,
  Star,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  X,
  RefreshCw,
  Filter,
  Search,
} from 'lucide-react';

interface RuleLifecycleManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RuleAnalysis {
  rule: ExceptionRule;
  stats: RuleUsageStats;
  recommendation: 'keep' | 'archive' | 'merge' | 'delete';
  reason: string;
  confidence: number;
  suggestedMergeTarget?: ExceptionRule;
}

interface LifecycleAction {
  type: 'archive' | 'delete' | 'merge' | 'promote';
  ruleIds: string[];
  targetRuleId?: string;
  reason: string;
}

export const RuleLifecycleManager: React.FC<RuleLifecycleManagerProps> = ({
  isOpen,
  onClose,
}) => {
  const [rules, setRules] = useState<ExceptionRule[]>([]);
  const [analyses, setAnalyses] = useState<RuleAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<
    'all' | 'unused' | 'duplicate' | 'popular'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] =
    useState<LifecycleAction | null>(null);
  const [processingAction, setProcessingAction] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadRulesAndAnalyze();
    }
  }, [isOpen]);

  const loadRulesAndAnalyze = async () => {
    try {
      setLoading(true);
      setError(null);

      // 获取所有规则
      const allRules = await exceptionRuleManager.getAllRules();
      setRules(allRules);

      // 分析每个规则
      const ruleAnalyses: RuleAnalysis[] = [];

      for (const rule of allRules) {
        try {
          const stats = await exceptionRuleManager.getRuleStats(rule.id);
          const analysis = await analyzeRule(rule, stats, allRules);
          ruleAnalyses.push(analysis);
        } catch (err) {
          console.warn(`分析规则 ${rule.name} 失败:`, err);
          // 创建默认分析
          ruleAnalyses.push({
            rule,
            stats: {
              ruleId: rule.id,
              totalUsage: rule.usageCount || 0,
              lastUsedAt: rule.lastUsedAt,
              averageSessionDuration: 0,
              successRate: 1,
              usageByTimeOfDay: {},
              usageByDayOfWeek: {},
              recentTrend: 'stable',
            },
            recommendation: 'keep',
            reason: '无法分析，建议保留',
            confidence: 0.5,
          });
        }
      }

      setAnalyses(ruleAnalyses);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载规则失败');
    } finally {
      setLoading(false);
    }
  };

  const analyzeRule = async (
    rule: ExceptionRule,
    stats: RuleUsageStats,
    allRules: ExceptionRule[],
  ): Promise<RuleAnalysis> => {
    const daysSinceCreation =
      (Date.now() - rule.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const daysSinceLastUse = rule.lastUsedAt
      ? (Date.now() - rule.lastUsedAt.getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;

    const usageCount = rule.usageCount || 0;
    const usageFrequency =
      daysSinceCreation > 0 ? usageCount / daysSinceCreation : 0;

    // 检查是否为未使用规则
    if (usageCount === 0 && daysSinceCreation > 30) {
      return {
        rule,
        stats,
        recommendation: 'delete',
        reason: '创建超过30天但从未使用',
        confidence: 0.9,
      };
    }

    // 检查是否为长期未使用规则
    if (daysSinceLastUse > 90 && usageCount < 3) {
      return {
        rule,
        stats,
        recommendation: 'archive',
        reason: '超过90天未使用且使用次数少',
        confidence: 0.8,
      };
    }

    // 检查是否为重复规则
    const duplicateTarget = findDuplicateRule(rule, allRules);
    if (duplicateTarget) {
      return {
        rule,
        stats,
        recommendation: 'merge',
        reason: `与规则"${duplicateTarget.name}"重复`,
        confidence: 0.7,
        suggestedMergeTarget: duplicateTarget,
      };
    }

    // 检查是否为高频使用规则
    if (usageCount > 10 && daysSinceLastUse < 7) {
      return {
        rule,
        stats,
        recommendation: 'keep',
        reason: '高频使用的活跃规则',
        confidence: 0.9,
      };
    }

    // 默认建议保留
    return {
      rule,
      stats,
      recommendation: 'keep',
      reason: '正常使用的规则',
      confidence: 0.6,
    };
  };

  const findDuplicateRule = (
    rule: ExceptionRule,
    allRules: ExceptionRule[],
  ): ExceptionRule | undefined => {
    const ruleName = rule.name.toLowerCase().trim();

    return allRules.find((otherRule) => {
      if (otherRule.id === rule.id) return false;

      const otherName = otherRule.name.toLowerCase().trim();

      // 检查完全相同的名称
      if (ruleName === otherName) {
        return (otherRule.usageCount || 0) > (rule.usageCount || 0);
      }

      // 检查高度相似的名称
      const similarity = calculateSimilarity(ruleName, otherName);
      if (similarity > 0.8 && otherRule.type === rule.type) {
        return (otherRule.usageCount || 0) > (rule.usageCount || 0);
      }

      return false;
    });
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  };

  const getFilteredAnalyses = () => {
    let filtered = analyses;

    // 按类型过滤
    switch (filterType) {
      case 'unused':
        filtered = filtered.filter(
          (a) =>
            (a.rule.usageCount || 0) === 0 ||
            a.recommendation === 'archive' ||
            a.recommendation === 'delete',
        );
        break;
      case 'duplicate':
        filtered = filtered.filter((a) => a.recommendation === 'merge');
        break;
      case 'popular':
        filtered = filtered.filter((a) => (a.rule.usageCount || 0) > 5);
        break;
    }

    // 按搜索查询过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.rule.name.toLowerCase().includes(query) ||
          a.rule.description?.toLowerCase().includes(query) ||
          a.reason.toLowerCase().includes(query),
      );
    }

    return filtered;
  };

  const handleBulkAction = (action: LifecycleAction) => {
    setShowConfirmDialog(action);
  };

  const executeBulkAction = async (action: LifecycleAction) => {
    try {
      setProcessingAction(true);

      switch (action.type) {
        case 'archive':
          await archiveRules(action.ruleIds);
          break;
        case 'delete':
          await deleteRules(action.ruleIds);
          break;
        case 'merge':
          if (action.targetRuleId) {
            await mergeRules(action.ruleIds, action.targetRuleId);
          }
          break;
        case 'promote':
          await promoteRules(action.ruleIds);
          break;
      }

      // 清理缓存并重新加载
      exceptionRuleCache.clear();
      await loadRulesAndAnalyze();

      setSelectedRules(new Set());
      setShowConfirmDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '执行操作失败');
    } finally {
      setProcessingAction(false);
    }
  };

  const archiveRules = async (ruleIds: string[]) => {
    for (const ruleId of ruleIds) {
      // 这里应该调用实际的归档方法
      // 目前使用更新规则的方式模拟
      console.log(`归档规则: ${ruleId}`);
    }
  };

  const deleteRules = async (ruleIds: string[]) => {
    for (const ruleId of ruleIds) {
      await exceptionRuleManager.deleteRule(ruleId);
    }
  };

  const mergeRules = async (sourceRuleIds: string[], targetRuleId: string) => {
    // 合并规则的逻辑
    console.log(`合并规则 ${sourceRuleIds.join(', ')} 到 ${targetRuleId}`);

    // 删除源规则
    for (const ruleId of sourceRuleIds) {
      if (ruleId !== targetRuleId) {
        await exceptionRuleManager.deleteRule(ruleId);
      }
    }
  };

  const promoteRules = async (ruleIds: string[]) => {
    for (const ruleId of ruleIds) {
      const rule = rules.find((r) => r.id === ruleId);
      if (rule && rule.scope === 'chain') {
        await ruleScopeManager.convertRuleScope(ruleId, 'global');
      }
    }
  };

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation) {
      case 'keep':
        return <CheckCircle className="text-green-500" size={16} />;
      case 'archive':
        return <Archive className="text-yellow-500" size={16} />;
      case 'merge':
        return <Merge className="text-blue-500" size={16} />;
      case 'delete':
        return <Trash2 className="text-red-500" size={16} />;
      default:
        return <Clock className="text-gray-500" size={16} />;
    }
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'keep':
        return 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30';
      case 'archive':
        return 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30';
      case 'merge':
        return 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30';
      case 'delete':
        return 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30';
      default:
        return 'bg-gray-50 dark:bg-gray-500/10 border-gray-200 dark:border-gray-500/30';
    }
  };

  const getSummaryStats = () => {
    const total = analyses.length;
    const toKeep = analyses.filter((a) => a.recommendation === 'keep').length;
    const toArchive = analyses.filter(
      (a) => a.recommendation === 'archive',
    ).length;
    const toMerge = analyses.filter((a) => a.recommendation === 'merge').length;
    const toDelete = analyses.filter(
      (a) => a.recommendation === 'delete',
    ).length;

    return { total, toKeep, toArchive, toMerge, toDelete };
  };

  if (!isOpen) return null;

  const filteredAnalyses = getFilteredAnalyses();
  const stats = getSummaryStats();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-3xl bg-white dark:bg-gray-800">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              规则生命周期管理
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              管理规则的归档、合并和清理
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        {/* 统计概览 */}
        <div className="border-b border-gray-200 p-6 dark:border-gray-700">
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.total}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                总规则数
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {stats.toKeep}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                建议保留
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {stats.toArchive}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                建议归档
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.toMerge}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                建议合并
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {stats.toDelete}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                建议删除
              </div>
            </div>
          </div>
        </div>

        {/* 过滤和搜索 */}
        <div className="border-b border-gray-200 p-6 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter size={16} className="text-gray-500" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="all">所有规则</option>
                <option value="unused">未使用/低使用</option>
                <option value="duplicate">重复规则</option>
                <option value="popular">热门规则</option>
              </select>
            </div>

            <div className="relative flex-1">
              <Search
                className="absolute top-1/2 left-3 -translate-y-1/2 transform text-gray-400"
                size={16}
              />
              <input
                type="text"
                placeholder="搜索规则..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pr-4 pl-10 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <button
              onClick={loadRulesAndAnalyze}
              disabled={loading}
              className="flex items-center space-x-2 rounded-lg bg-primary-500 px-4 py-2 text-white hover:bg-primary-600 disabled:opacity-50"
            >
              <RefreshCw className={loading ? 'animate-spin' : ''} size={16} />
              <span>刷新分析</span>
            </button>
          </div>
        </div>

        {/* 规则列表 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="animate-spin text-primary-500" size={32} />
              <span className="ml-3 text-gray-600 dark:text-gray-400">
                分析规则中...
              </span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <AlertTriangle className="text-red-500" size={32} />
              <span className="ml-3 text-red-600">{error}</span>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAnalyses.map((analysis) => (
                <div
                  key={analysis.rule.id}
                  className={`rounded-xl border p-4 ${getRecommendationColor(analysis.recommendation)} transition-all duration-200`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedRules.has(analysis.rule.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedRules);
                          if (e.target.checked) {
                            newSelected.add(analysis.rule.id);
                          } else {
                            newSelected.delete(analysis.rule.id);
                          }
                          setSelectedRules(newSelected);
                        }}
                        className="h-4 w-4 rounded text-primary-600"
                      />

                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {analysis.rule.name}
                          </h4>
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-medium ${
                              analysis.rule.scope === 'global'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                                : 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
                            }`}
                          >
                            {analysis.rule.scope === 'global'
                              ? '全局'
                              : '链专属'}
                          </span>
                        </div>

                        {analysis.rule.description && (
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {analysis.rule.description}
                          </p>
                        )}

                        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                          <span>使用 {analysis.rule.usageCount || 0} 次</span>
                          {analysis.rule.lastUsedAt && (
                            <span>
                              最后使用:{' '}
                              {analysis.rule.lastUsedAt.toLocaleDateString()}
                            </span>
                          )}
                          <span>
                            创建: {analysis.rule.createdAt.toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          {getRecommendationIcon(analysis.recommendation)}
                          <span className="text-sm font-medium">
                            {analysis.recommendation === 'keep'
                              ? '保留'
                              : analysis.recommendation === 'archive'
                                ? '归档'
                                : analysis.recommendation === 'merge'
                                  ? '合并'
                                  : '删除'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          {analysis.reason}
                        </p>
                        <div className="mt-1 flex items-center space-x-1">
                          <span className="text-xs text-gray-500">置信度:</span>
                          <div className="flex items-center space-x-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <div
                                key={i}
                                className={`h-2 w-1 rounded-full ${
                                  i < Math.ceil(analysis.confidence * 5)
                                    ? 'bg-primary-500'
                                    : 'bg-gray-200 dark:bg-gray-600'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {analysis.suggestedMergeTarget && (
                    <div className="mt-3 rounded-lg bg-blue-50 p-3 dark:bg-blue-500/10">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        建议合并到:{' '}
                        <strong>{analysis.suggestedMergeTarget.name}</strong>
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 批量操作按钮 */}
        {selectedRules.size > 0 && (
          <div className="border-t border-gray-200 p-6 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                已选择 {selectedRules.size} 个规则
              </span>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() =>
                    handleBulkAction({
                      type: 'archive',
                      ruleIds: Array.from(selectedRules),
                      reason: '批量归档选中的规则',
                    })
                  }
                  className="flex items-center space-x-2 rounded-lg bg-yellow-500 px-4 py-2 text-white hover:bg-yellow-600"
                >
                  <Archive size={16} />
                  <span>归档</span>
                </button>

                <button
                  onClick={() =>
                    handleBulkAction({
                      type: 'promote',
                      ruleIds: Array.from(selectedRules),
                      reason: '批量提升为全局规则',
                    })
                  }
                  className="flex items-center space-x-2 rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
                >
                  <Star size={16} />
                  <span>提升为全局</span>
                </button>

                <button
                  onClick={() =>
                    handleBulkAction({
                      type: 'delete',
                      ruleIds: Array.from(selectedRules),
                      reason: '批量删除选中的规则',
                    })
                  }
                  className="flex items-center space-x-2 rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600"
                >
                  <Trash2 size={16} />
                  <span>删除</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 确认对话框 */}
        {showConfirmDialog && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-gray-800">
              <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">
                确认操作
              </h3>
              <p className="mb-6 text-gray-600 dark:text-gray-400">
                {showConfirmDialog.reason}
              </p>
              <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                将影响 {showConfirmDialog.ruleIds.length}{' '}
                个规则，此操作不可撤销。
              </p>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowConfirmDialog(null)}
                  disabled={processingAction}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  取消
                </button>
                <button
                  onClick={() => executeBulkAction(showConfirmDialog)}
                  disabled={processingAction}
                  className="flex flex-1 items-center justify-center space-x-2 rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {processingAction ? (
                    <RefreshCw className="animate-spin" size={16} />
                  ) : (
                    <CheckCircle size={16} />
                  )}
                  <span>确认</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
