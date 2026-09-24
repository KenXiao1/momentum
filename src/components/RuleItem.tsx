import { translate } from '../i18n/translate';
/**
 * 优化的规则项组件
 * 使用 React.memo 避免不必要的重渲染
 */

import React, { memo } from 'react';
import { ExceptionRule, ExceptionRuleType } from '../types';
import { Edit2, Trash2, BarChart3, Clock, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n';

interface RuleItemProps {
  rule: ExceptionRule;
  isOptimistic: boolean;
  onEdit: (rule: ExceptionRule) => void;
  onDelete: (rule: ExceptionRule) => void;
  onSelect?: (rule: ExceptionRule) => void; // 新增 onSelect prop
}

const RuleItem: React.FC<RuleItemProps> = memo(
  ({ rule, isOptimistic, onEdit, onDelete, onSelect }) => {
    const { language, t } = useI18n();

    const getRuleTypeDisplayName = (type: ExceptionRuleType): string => {
      return type === ExceptionRuleType.PAUSE_ONLY
        ? t('ruleItem.pauseOnly')
        : t('ruleItem.earlyCompletionOnly');
    };

    const getRuleTypeColor = (type: ExceptionRuleType): string => {
      return type === ExceptionRuleType.PAUSE_ONLY
        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300'
        : 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300';
    };

    const formatLastUsed = (date?: Date): string => {
      if (!date) return t('ruleItem.neverUsed');

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return t('ruleItem.today');
      if (diffDays === 1) return t('ruleItem.yesterday');
      if (diffDays < 7)
        return translate(
          language === 'zh' ? 'zh' : 'en',
          'ruleItem.diffDaysDAgo',
          { diffDays: diffDays },
        );
      if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return translate(
          language === 'zh' ? 'zh' : 'en',
          'ruleItem.weeksWAgo',
          { weeks: weeks },
        );
      }
      const months = Math.floor(diffDays / 30);
      return translate(
        language === 'zh' ? 'zh' : 'en',
        'ruleItem.monthsMoAgo',
        { months: months },
      );
    };

    const isSelectable = Boolean(onSelect);

    const handleSelect = () => {
      if (onSelect) {
        onSelect(rule);
      }
    };

    const usageText =
      rule.usageCount === 1
        ? t('counts.ruleUsedOnce', { count: rule.usageCount })
        : t('counts.ruleUsedMany', { count: rule.usageCount });

    return (
      <div
        className={`rounded-2xl bg-gray-50 p-4 transition-colors hover:bg-gray-100 dark:bg-gray-700/50 dark:hover:bg-gray-700 ${isSelectable ? 'focus-ring cursor-pointer' : ''}`}
        role={isSelectable ? 'button' : undefined}
        tabIndex={isSelectable ? 0 : undefined}
        onClick={isSelectable ? handleSelect : undefined}
        onKeyDown={
          isSelectable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelect();
                }
              }
            : undefined
        }
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-2 flex items-center space-x-3">
              <h3 className="flex items-center space-x-2 text-lg font-medium text-gray-900 dark:text-white">
                <span>{rule.name}</span>
                {isOptimistic && (
                  <Loader2
                    size={14}
                    className="animate-spin text-primary-500"
                  />
                )}
              </h3>
              <span
                className={`rounded-lg px-2 py-1 text-xs font-medium ${getRuleTypeColor(rule.type)}`}
              >
                {getRuleTypeDisplayName(rule.type)}
              </span>
            </div>

            {rule.description && (
              <p className="mb-3 text-gray-600 dark:text-gray-400">
                {rule.description}
              </p>
            )}

            <div className="flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center space-x-1">
                <BarChart3 size={14} />
                <span>{usageText}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock size={14} />
                <span>{formatLastUsed(rule.lastUsedAt)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(rule);
              }}
              className="touch-target rounded-xl bg-white p-2 text-gray-600 transition-colors hover:bg-gray-50 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(rule);
              }}
              className="touch-target rounded-xl bg-white p-2 text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-red-500/20 dark:hover:text-red-400"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  },
);

RuleItem.displayName = 'RuleItem';

export default RuleItem;
