import { translate } from '../../i18n/translate';
import type { ReactNode } from 'react';
import { CheckCircle, TrendingUp, History } from 'lucide-react';
import type { ExceptionRule } from '../../types';
import type { SearchResult } from '../../utils/ruleSearchOptimizer';

interface RuleListItemProps {
  index: number;
  itemHeight: number;
  language: string;
  onSelect: (rule: ExceptionRule) => void;
  result: SearchResult;
  rulesLength: number;
  searchQuery: string;
  showCreateNew: boolean;
  formatLastUsed: (date: Date) => string;
  getMatchTypeLabel: (matchType: string) => string;
  highlightText: (
    text: string,
    ranges: Array<{ start: number; end: number }>,
  ) => ReactNode;
}

export function RuleListItem({
  result,
  index,
  itemHeight,
  onSelect,
  language,
  rulesLength,
  searchQuery,
  showCreateNew,
  highlightText,
  formatLastUsed,
  getMatchTypeLabel,
}: RuleListItemProps) {
  const rule = result.rule;
  const usageCount = rule.usageCount || 0;
  const locale = language === 'zh' ? 'zh' : 'en';
  const usageText =
    usageCount === 1
      ? translate(locale, 'counts.rulePreviouslyUsedOnce', {
          count: usageCount,
        })
      : translate(locale, 'counts.rulePreviouslyUsedMany', {
          count: usageCount,
        });
  const actualIndex = showCreateNew && searchQuery ? index - 1 : index;

  if (actualIndex < 0 || actualIndex >= rulesLength) return null;

  return (
    <div
      className="rule-item absolute w-full"
      style={{
        height: itemHeight,
        top: index * itemHeight,
        left: 0,
      }}
      data-rule-item
    >
      <button
        type="button"
        onClick={() => onSelect(rule)}
        className="flex w-full items-center justify-between rounded-xl border border-transparent bg-gray-50 p-3 text-left transition duration-200 hover:border-primary-200 hover:bg-gray-100 dark:bg-gray-700/50 dark:hover:border-primary-500/30 dark:hover:bg-gray-700"
        style={{ height: itemHeight }}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-gray-900 dark:text-white">
            {highlightText(rule.name, result.highlightRanges)}
          </div>
          <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center space-x-1">
              <TrendingUp size={12} aria-hidden="true" />
              <span>{usageText}</span>
            </span>
            {rule.lastUsedAt && (
              <span className="flex items-center space-x-1">
                <History size={12} aria-hidden="true" />
                <span>{formatLastUsed(rule.lastUsedAt)}</span>
              </span>
            )}
            {result.matchType !== 'exact' && (
              <span className="text-xs text-primary-500">
                {getMatchTypeLabel(result.matchType)}
              </span>
            )}
          </div>
        </div>

        <div className="ml-4 flex items-center space-x-2">
          {/* 使用频率可视化 */}
          <div className="flex items-center space-x-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`h-4 w-1 rounded-full ${
                  i < Math.min((rule.usageCount || 0) / 2, 5)
                    ? 'bg-primary-500'
                    : 'bg-gray-200 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
          <CheckCircle
            className="flex-shrink-0 text-gray-400 transition-colors hover:text-primary-500"
            size={20}
            aria-hidden="true"
          />
        </div>
      </button>
    </div>
  );
}
