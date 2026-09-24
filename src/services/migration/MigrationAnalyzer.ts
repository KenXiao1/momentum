/**
 * 迁移分析器
 * 提供迁移建议、验证和报告功能
 */

import type { ExceptionRule } from '../../types';
import type {
  MigrationInfo,
  MigrationSuggestions,
  MigrationValidation,
} from './migrationTypes';
import {
  LEGACY_MIGRATED_DESCRIPTION_ZH,
  LEGACY_MIGRATED_DESCRIPTION_EN,
} from './migrationTypes';
import { MigrationStorage } from './MigrationStorage';
import { exceptionRuleManager } from '../ExceptionRuleManager';
import { logger } from '../../utils/logger';
import { getCurrentLanguage, t } from '../../utils/runtimeI18n';
import {
  getSafeErrorDetail,
  toError,
  getErrorMessage,
} from '../../utils/errorMessage';

/**
 * 迁移分析器
 * 负责分析迁移需求、验证结果和生成报告
 */
export class MigrationAnalyzer {
  constructor(private migrationStorage: MigrationStorage) {}

  /**
   * 获取迁移建议
   */
  async getMigrationSuggestions(): Promise<MigrationSuggestions> {
    try {
      const chains = await this.migrationStorage.getLegacyChains();
      const chainsWithExceptions = chains.filter(
        (chain) => chain.exceptions && chain.exceptions.length > 0,
      );

      const ruleUsage = new Map<string, { count: number; chains: string[] }>();
      let totalRules = 0;

      for (const chain of chainsWithExceptions) {
        for (const exception of chain.exceptions) {
          const ruleName = exception.trim();
          if (ruleName) {
            totalRules++;
            const existing = ruleUsage.get(ruleName);
            if (existing) {
              existing.count++;
              existing.chains.push(chain.name);
            } else {
              ruleUsage.set(ruleName, { count: 1, chains: [chain.name] });
            }
          }
        }
      }

      const uniqueRules = Array.from(ruleUsage.keys());
      const duplicateRules = Array.from(ruleUsage.entries())
        .filter(([, usage]) => usage.count > 1)
        .map(([rule, usage]) => ({
          rule,
          count: usage.count,
          chains: usage.chains,
        }))
        .sort((a, b) => b.count - a.count);

      const recommendations = this.generateRecommendations(
        uniqueRules,
        duplicateRules,
      );

      return {
        totalRules,
        uniqueRules,
        duplicateRules,
        recommendations,
      };
    } catch (error) {
      const err = toError(error);
      logger.error('MIGRATION_ANALYZER', '获取迁移建议失败', undefined, err);
      return {
        totalRules: 0,
        uniqueRules: [],
        duplicateRules: [],
        recommendations: [
          t(
            'migration.migrationAnalyzer.failedToGetMigrationSuggestionsCheckDataIntegrity',
          ),
        ],
      };
    }
  }

  /**
   * 生成建议
   */
  private generateRecommendations(
    uniqueRules: string[],
    duplicateRules: Array<{ rule: string; count: number; chains: string[] }>,
  ): string[] {
    const recommendations: string[] = [];

    if (duplicateRules.length > 0) {
      recommendations.push(
        t(
          'migration.migrationAnalyzer.foundDuplicateRulesCountDuplicatedRuleSDuplicatesWillBeMergedAfter',
          { duplicateRulesCount: duplicateRules.length },
        ),
      );
    }

    if (uniqueRules.length > 20) {
      recommendations.push(
        t(
          'migration.migrationAnalyzer.manyRulesDetectedConsiderOrganizingAndCategorizingThemAfter',
        ),
      );
    }

    const commonPatterns = uniqueRules.filter((rule) =>
      ['上厕所', '喝水', '休息', '接电话', '查看消息'].some((pattern) =>
        rule.includes(pattern),
      ),
    );

    if (commonPatterns.length > 0) {
      recommendations.push(
        t(
          'migration.migrationAnalyzer.foundCommonPatternsCountCommonPatternRuleSConsiderStandardizingNaming',
          { commonPatternsCount: commonPatterns.length },
        ),
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        t('migration.migrationAnalyzer.dataLooksGoodYouCanMigrateDirectly'),
      );
    }

    return recommendations;
  }

  /**
   * 验证迁移结果
   */
  async validateMigration(): Promise<MigrationValidation> {
    try {
      const issues: string[] = [];

      const migrationInfo = this.migrationStorage.getMigrationInfo();
      if (!migrationInfo) {
        issues.push(t('migration.migrationAnalyzer.missingMigrationRecord'));
      }

      const allRules = await exceptionRuleManager.getAllRules();
      const migratedRules = this.filterMigratedRules(allRules, migrationInfo);
      const activeRules = allRules.filter((rule) => rule.isActive);

      if (migrationInfo && migratedRules.length !== migrationInfo.totalRules) {
        issues.push(
          t(
            'migration.migrationAnalyzer.migratedRuleCountMismatchExpectedMigrationInfoTotalRulesGotMigratedRulesCount',
            {
              migrationInfoTotalRules: migrationInfo.totalRules,
              migratedRulesCount: migratedRules.length,
            },
          ),
        );
      }

      for (const rule of migratedRules) {
        if (!rule.name || !rule.type) {
          issues.push(
            t('migration.migrationAnalyzer.ruleRuleIdDataIsIncomplete', {
              ruleId: rule.id,
            }),
          );
        }
      }

      return {
        isValid: issues.length === 0,
        issues,
        statistics: {
          totalRules: allRules.length,
          migratedRules: migratedRules.length,
          activeRules: activeRules.length,
        },
      };
    } catch (error) {
      const currentLanguage = getCurrentLanguage();
      return {
        isValid: false,
        issues: [
          (() => {
            if (error instanceof Error) {
              const safe = getSafeErrorDetail(error.message, currentLanguage);
              return (
                safe ??
                t(
                  'migration.migrationAnalyzer.validationErrorOccurredCheckConsoleForDetails',
                )
              );
            }
            return t('focusMode.useExceptionRuleOperations.unknownError');
          })(),
        ],
        statistics: {
          totalRules: 0,
          migratedRules: 0,
          activeRules: 0,
        },
      };
    }
  }

  /**
   * 过滤迁移的规则
   */
  filterMigratedRules(
    allRules: ExceptionRule[],
    migrationInfo: MigrationInfo | null,
  ): ExceptionRule[] {
    if (migrationInfo?.createdRuleIds?.length) {
      return allRules.filter((rule) =>
        migrationInfo.createdRuleIds!.includes(rule.id),
      );
    }
    return allRules.filter(
      (rule) =>
        rule.description === LEGACY_MIGRATED_DESCRIPTION_ZH ||
        rule.description === LEGACY_MIGRATED_DESCRIPTION_EN,
    );
  }

  /**
   * 创建迁移报告
   */
  async generateMigrationReport(): Promise<string> {
    try {
      const migrationInfo = this.migrationStorage.getMigrationInfo();
      const validation = await this.validateMigration();
      const suggestions = await this.getMigrationSuggestions();

      const report = {
        title: t('migration.migrationAnalyzer.exceptionRuleMigrationReport'),
        generatedAt: new Date().toISOString(),
        migrationInfo,
        validation,
        suggestions,
        summary: {
          migrationCompleted: !!migrationInfo,
          validationPassed: validation.isValid,
          totalIssues: validation.issues.length,
          recommendations: suggestions.recommendations.length,
        },
      };

      return JSON.stringify(report, null, 2);
    } catch (error) {
      return JSON.stringify(
        {
          title: t('migration.migrationAnalyzer.exceptionRuleMigrationReport'),
          generatedAt: new Date().toISOString(),
          error: getErrorMessage(error),
        },
        null,
        2,
      );
    }
  }
}
