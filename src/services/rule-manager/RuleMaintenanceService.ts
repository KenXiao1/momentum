/**
 * RuleMaintenanceService - 规则维护服务
 * 负责规则的更新、删除、清理和健康检查
 */

import {
  ExceptionRule,
  ExceptionRuleError,
  ExceptionRuleException,
} from '../../types';
import { exceptionRuleStorage } from '../ExceptionRuleStorage';
import { getDuplicationReport } from '../duplication/duplicationDetection';
import { ruleUsageTracker } from '../RuleUsageTracker';
import { t } from '../../utils/runtimeI18n';

interface RuleUpdateResult {
  rule: ExceptionRule;
  warnings: string[];
}

export interface CleanupResult {
  removedRecords: number;
  cleanedAt: Date;
}

export interface SystemHealthStatus {
  status: 'healthy' | 'warning' | 'error';
  totalRules: number;
  activeRules: number;
  totalUsageRecords: number;
  lastUsedAt?: Date;
  issues: string[];
}

interface CleanupOptions {
  removeExpiredRecords?: boolean;
  retentionDays?: number;
}

/**
 * 规则维护服务类
 * 单一职责：处理规则的维护和健康检查
 */
class RuleMaintenanceService {
  /**
   * 更新例外规则
   */
  async updateRule(
    id: string,
    updates: Partial<Pick<ExceptionRule, 'name' | 'type' | 'description'>>,
  ): Promise<RuleUpdateResult> {
    try {
      const warnings: string[] = [];

      if (
        updates.name !== undefined ||
        updates.type !== undefined ||
        updates.description !== undefined
      ) {
        exceptionRuleStorage.validateRule(updates);
      }

      if (updates.name) {
        const allRules = await exceptionRuleStorage.getRules();
        const duplicationReport = getDuplicationReport(
          allRules,
          updates.name,
          id,
        );

        if (duplicationReport.hasExactMatch) {
          throw new ExceptionRuleException(
            ExceptionRuleError.DUPLICATE_RULE_NAME,
            `Rule name "${updates.name}" already exists`,
            { existingRules: duplicationReport.exactMatches },
          );
        }

        if (duplicationReport.hasSimilarRules) {
          const similarRuleNames = duplicationReport.similarRules
            .map((r) => r.rule.name)
            .join(', ');
          warnings.push(
            t(
              'ruleManager.ruleMaintenanceService.similarRulesFoundSimilarRuleNames',
              { similarRuleNames: similarRuleNames },
            ),
          );
        }
      }

      const rule = await exceptionRuleStorage.updateRule(id, updates);

      return { rule, warnings };
    } catch (error) {
      if (error instanceof ExceptionRuleException) {
        throw error;
      }
      throw new ExceptionRuleException(
        ExceptionRuleError.STORAGE_ERROR,
        'Failed to update rule',
        error,
      );
    }
  }

  /**
   * 删除例外规则
   */
  async deleteRule(id: string): Promise<void> {
    try {
      await exceptionRuleStorage.deleteRule(id);
    } catch (error) {
      if (error instanceof ExceptionRuleException) {
        throw error;
      }
      throw new ExceptionRuleException(
        ExceptionRuleError.STORAGE_ERROR,
        'Failed to delete rule',
        error,
      );
    }
  }

  /**
   * 清理系统数据
   */
  async cleanupData(options: CleanupOptions = {}): Promise<CleanupResult> {
    try {
      let removedRecords = 0;

      if (options.removeExpiredRecords) {
        removedRecords = await ruleUsageTracker.cleanupExpiredRecords(
          options.retentionDays || 90,
        );
      }

      await exceptionRuleStorage.cleanupExpiredData();

      return {
        removedRecords,
        cleanedAt: new Date(),
      };
    } catch (error) {
      throw new ExceptionRuleException(
        ExceptionRuleError.STORAGE_ERROR,
        'Failed to cleanup data',
        error,
      );
    }
  }

  /**
   * 获取系统健康状态
   */
  async getSystemHealth(): Promise<SystemHealthStatus> {
    try {
      const allRules = await exceptionRuleStorage.getRules();
      const activeRules = allRules.filter((r) => r.isActive);
      const usageRecords = await exceptionRuleStorage.getUsageRecords();

      const issues: string[] = [];
      let status: 'healthy' | 'warning' | 'error' = 'healthy';

      if (activeRules.length === 0) {
        issues.push(
          t('ruleManager.ruleMaintenanceService.noActiveExceptionRules'),
        );
        status = 'warning';
      }

      if (usageRecords.length === 0 && activeRules.length > 0) {
        issues.push(
          t('ruleManager.ruleMaintenanceService.rulesExistButNoUsageRecords'),
        );
        status = 'warning';
      }

      const lastUsedAt =
        usageRecords.length > 0
          ? new Date(Math.max(...usageRecords.map((r) => r.usedAt.getTime())))
          : undefined;

      if (lastUsedAt) {
        const daysSinceLastUse =
          (Date.now() - lastUsedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastUse > 30) {
          issues.push(
            t('ruleManager.ruleMaintenanceService.noRulesUsedInTheLast30Days'),
          );
          status = 'warning';
        }
      }

      const ruleNames = activeRules.map((r) => r.name);
      const duplicateNames = ruleNames.filter(
        (name, index) => ruleNames.indexOf(name) !== index,
      );
      if (duplicateNames.length > 0) {
        issues.push(
          t(
            'ruleManager.ruleMaintenanceService.duplicateRuleNamesFoundDuplicateNames',
            { duplicateNames: duplicateNames.join(', ') },
          ),
        );
        status = 'error';
      }

      return {
        status,
        totalRules: allRules.length,
        activeRules: activeRules.length,
        totalUsageRecords: usageRecords.length,
        lastUsedAt,
        issues,
      };
    } catch (error) {
      return {
        status: 'error',
        totalRules: 0,
        activeRules: 0,
        totalUsageRecords: 0,
        issues: [
          t('ruleManager.ruleMaintenanceService.systemCheckFailed') +
            (error instanceof Error
              ? error.message
              : t('focusMode.useExceptionRuleOperations.unknownError')),
        ],
      };
    }
  }
}

export const ruleMaintenanceService = new RuleMaintenanceService();
