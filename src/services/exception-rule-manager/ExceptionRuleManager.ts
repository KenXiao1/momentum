/**
 * ExceptionRuleManager - 统一的例外规则管理协调器
 *
 * 此类作为外部接口的统一入口，委托到各专门服务：
 * - RuleCreator: 规则创建逻辑
 * - RuleExecutor: 规则执行/使用逻辑
 * - RuleExportImportService: 导入导出逻辑
 * - RuleMaintenanceService: 维护和健康检查
 *
 * 保持向后兼容性，现有代码无需修改即可使用
 */

import type {
  ExceptionRule,
  PauseOptions,
  RuleUsageRecord,
  SessionContext,
  RuleUsageStats,
  OverallUsageStats,
} from '../../types';
import { ExceptionRuleType } from '../../types';
import { dataIntegrityChecker } from '../DataIntegrityChecker';
import { exceptionRuleStorage } from '../ExceptionRuleStorage';
import { ruleClassificationService } from '../RuleClassificationService';
import { ruleUsageTracker } from '../RuleUsageTracker';
import {
  generateNameSuggestions,
  getDuplicationReport,
  type DuplicationReport,
} from '../duplication/duplicationDetection';
import { logger } from '../../utils/logger';
import { toError } from '../../utils/errorMessage';

import {
  ruleCreator,
  ruleExecutor,
  ruleExportImportService,
  ruleMaintenanceService,
  type RuleCreationResult,
  type RealTimeCheckResult,
  type RuleExecutionResult,
  type ImportResult,
  type ExportResult,
  type CleanupResult,
  type SystemHealthStatus,
} from '../rule-manager';
import { withRuleErrorHandling } from './errorHandling';

type DuplicationSuggestions = DuplicationReport & { nameSuggestions: string[] };

interface RuleUsageSuggestions {
  mostUsed: ExceptionRule[];
  recentlyUsed: ExceptionRule[];
  suggested: ExceptionRule[];
}

interface RuleTypeStats {
  total: number;
  pauseOnly: number;
  earlyCompletionOnly: number;
  mostUsedType: ExceptionRuleType | null;
  leastUsedType: ExceptionRuleType | null;
}

export class ExceptionRuleManager {
  private initialized = false;

  /**
   * 初始化管理器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const integrityReport =
        await dataIntegrityChecker.checkRuleDataIntegrity();

      if (integrityReport.issues.length > 0) {
        logger.warn('EXCEPTION_RULE_MANAGER', 'Data integrity issues found', {
          summary: integrityReport.summary,
        });

        const autoFixableIssues = integrityReport.issues.filter(
          (issue) => issue.autoFixable,
        );
        if (autoFixableIssues.length > 0) {
          const fixResults =
            await dataIntegrityChecker.autoFixIssues(autoFixableIssues);
          const successCount = fixResults.filter((r) => r.success).length;
          logger.info('EXCEPTION_RULE_MANAGER', 'Auto-fixed data issues', {
            successCount,
            total: autoFixableIssues.length,
          });
        }
      }

      this.initialized = true;
      logger.info('EXCEPTION_RULE_MANAGER', 'Initialization completed');
    } catch (error) {
      const err = toError(error);
      logger.error(
        'EXCEPTION_RULE_MANAGER',
        'Initialization failed',
        undefined,
        err,
      );
      throw error;
    }
  }

  // ==================== Creation Methods ====================

  async createRule(
    name: string,
    type: ExceptionRuleType,
    description?: string,
    userChoice?: 'use_existing' | 'modify_name' | 'create_anyway',
  ): Promise<RuleCreationResult> {
    await this.initialize();
    return ruleCreator.createRule(name, type, description, userChoice);
  }

  async createChainRule(
    chainId: string,
    name: string,
    type: ExceptionRuleType,
    description?: string,
  ): Promise<RuleCreationResult> {
    await this.initialize();
    return ruleCreator.createChainRule(chainId, name, type, description);
  }

  async checkRuleNameRealTime(
    name: string,
    excludeId?: string,
  ): Promise<RealTimeCheckResult> {
    return ruleCreator.checkRuleNameRealTime(name, excludeId);
  }

  // ==================== Query Methods ====================

  async getRuleById(id: string): Promise<ExceptionRule | null> {
    return withRuleErrorHandling(
      () => exceptionRuleStorage.getRuleById(id),
      'Failed to get rule',
    );
  }

  async getAllRules(): Promise<ExceptionRule[]> {
    return withRuleErrorHandling(
      () => exceptionRuleStorage.getRules(),
      'Failed to get rule list',
    );
  }

  async getRulesByType(type: ExceptionRuleType): Promise<ExceptionRule[]> {
    return withRuleErrorHandling(
      () => ruleClassificationService.getRulesByType(type),
      'Failed to get rules by type',
    );
  }

  async getRulesForAction(
    actionType: 'pause' | 'early_completion',
  ): Promise<ExceptionRule[]> {
    return withRuleErrorHandling(
      () => ruleClassificationService.getRulesForAction(actionType),
      'Failed to get rules for action',
    );
  }

  async searchRules(
    query: string,
    type?: ExceptionRuleType,
    actionType?: 'pause' | 'early_completion',
  ): Promise<ExceptionRule[]> {
    return withRuleErrorHandling(async () => {
      let searchType = type;
      if (!searchType && actionType) {
        searchType =
          actionType === 'pause'
            ? ExceptionRuleType.PAUSE_ONLY
            : ExceptionRuleType.EARLY_COMPLETION_ONLY;
      }

      return ruleClassificationService.searchRules(query, searchType);
    }, 'Failed to search rules');
  }

  async getRuleUsageSuggestions(
    actionType: 'pause' | 'early_completion',
  ): Promise<RuleUsageSuggestions> {
    return withRuleErrorHandling(
      () => ruleClassificationService.getRuleUsageSuggestions(actionType),
      'Failed to get usage suggestions',
    );
  }

  async getDuplicationSuggestions(
    name: string,
    excludeId?: string,
  ): Promise<DuplicationSuggestions> {
    return withRuleErrorHandling(async () => {
      const allRules = await exceptionRuleStorage.getRules();
      const report = getDuplicationReport(allRules, name, excludeId);
      const nameSuggestions = generateNameSuggestions(
        name,
        allRules.map((r) => r.name),
      );

      return {
        ...report,
        nameSuggestions,
      };
    }, 'Failed to get duplication suggestions');
  }

  // ==================== Execution Methods ====================

  async useRule(
    ruleId: string,
    sessionContext: SessionContext,
    actionType: 'pause' | 'early_completion',
    pauseOptions?: PauseOptions,
  ): Promise<RuleExecutionResult> {
    return ruleExecutor.useRule(
      ruleId,
      sessionContext,
      actionType,
      pauseOptions,
    );
  }

  async validateRuleForAction(
    ruleId: string,
    actionType: 'pause' | 'early_completion',
  ): Promise<boolean> {
    return ruleExecutor.validateRuleForAction(ruleId, actionType);
  }

  // ==================== Stats Methods ====================

  async getRuleStats(ruleId: string): Promise<RuleUsageStats> {
    return withRuleErrorHandling(
      () => ruleUsageTracker.getRuleUsageStats(ruleId),
      'Failed to get rule stats',
      {
        preserveRuleExceptions: true,
      },
    );
  }

  async getOverallStats(): Promise<OverallUsageStats> {
    return withRuleErrorHandling(
      () => ruleUsageTracker.getOverallUsageStats(),
      'Failed to get overall stats',
    );
  }

  async getRuleUsageHistory(
    ruleId: string,
    limit?: number,
  ): Promise<RuleUsageRecord[]> {
    return withRuleErrorHandling(
      () => ruleUsageTracker.getRuleUsageHistory(ruleId, limit),
      'Failed to get usage history',
    );
  }

  async getRuleTypeStats(): Promise<RuleTypeStats> {
    return withRuleErrorHandling(
      () => ruleClassificationService.getRuleTypeStats(),
      'Failed to get rule type stats',
    );
  }

  async getRecommendedRuleType(
    basedOnUsage: boolean = true,
  ): Promise<ExceptionRuleType> {
    return withRuleErrorHandling(
      () => ruleClassificationService.getRecommendedRuleType(basedOnUsage),
      'Failed to get recommended rule type',
    );
  }

  // ==================== Import/Export Methods ====================

  async importRules(
    rules: Array<Pick<ExceptionRule, 'name' | 'type' | 'description'>>,
    options: { skipDuplicates?: boolean; updateExisting?: boolean } = {},
  ): Promise<ImportResult> {
    return ruleExportImportService.importRules(rules, options);
  }

  async exportRules(includeUsageData: boolean = false): Promise<ExportResult> {
    return ruleExportImportService.exportRules(includeUsageData);
  }

  // ==================== Maintenance Methods ====================

  async updateRule(
    id: string,
    updates: Partial<Pick<ExceptionRule, 'name' | 'type' | 'description'>>,
  ): Promise<{ rule: ExceptionRule; warnings: string[] }> {
    return ruleMaintenanceService.updateRule(id, updates);
  }

  async deleteRule(id: string): Promise<void> {
    return ruleMaintenanceService.deleteRule(id);
  }

  async cleanupData(
    options: { removeExpiredRecords?: boolean; retentionDays?: number } = {},
  ): Promise<CleanupResult> {
    return ruleMaintenanceService.cleanupData(options);
  }

  async getSystemHealth(): Promise<SystemHealthStatus> {
    return ruleMaintenanceService.getSystemHealth();
  }
}

export const exceptionRuleManager = new ExceptionRuleManager();
