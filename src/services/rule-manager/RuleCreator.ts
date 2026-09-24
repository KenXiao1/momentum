/**
 * RuleCreator - 规则创建服务
 * 负责例外规则的创建逻辑，包括普通创建和链专属创建
 */

import {
  ExceptionRule,
  ExceptionRuleType,
  ExceptionRuleError,
  ExceptionRuleException,
} from '../../types';
import { exceptionRuleStorage } from '../ExceptionRuleStorage';
import { enhancedDuplicationHandler } from '../EnhancedDuplicationHandler';
import { validateRulesIntegrity } from '../validateRulesIntegrity';
import { errorClassificationService } from '../ErrorClassificationService';
import { errorRecoveryManager } from '../ErrorRecoveryManager';
import { logger } from '../../utils/logger';
import { isDev } from '../../utils/env';
import { t } from '../../utils/runtimeI18n';

export interface RuleCreationResult {
  rule: ExceptionRule;
  warnings: string[];
}

export interface RealTimeCheckResult {
  hasConflict: boolean;
  conflictMessage?: string;
  suggestions: Array<{
    type: 'use_existing' | 'modify_name' | 'create_anyway' | 'merge_rules';
    title: string;
    description: string;
    suggestedName?: string;
  }>;
}

/**
 * 规则创建服务类 - 处理所有规则创建相关的逻辑
 */
class RuleCreator {
  /** 创建新的例外规则（增强版本） */
  async createRule(
    name: string,
    type: ExceptionRuleType,
    description?: string,
    userChoice?: 'use_existing' | 'modify_name' | 'create_anyway',
  ): Promise<RuleCreationResult> {
    try {
      if (isDev) {
        logger.debug('RULE_CREATOR', 'createRule', {
          name,
          type,
          descLen: description?.length ?? 0,
        });
      }
      exceptionRuleStorage.validateRule({ name, type, description }, true);
      const result = await enhancedDuplicationHandler.handleDuplicateCreation(
        name,
        type,
        description,
        userChoice,
      );
      this.logValidationWarnings(result.rule);
      return { rule: result.rule, warnings: result.warnings };
    } catch (error) {
      return this.handleCreationError(error, {
        name,
        type,
        description,
        userChoice,
      });
    }
  }

  /** 创建链专属规则 */
  async createChainRule(
    chainId: string,
    name: string,
    type: ExceptionRuleType,
    description?: string,
  ): Promise<RuleCreationResult> {
    try {
      if (isDev) {
        logger.debug('RULE_CREATOR', 'createChainRule', {
          chainId,
          name,
          type,
        });
      }
      exceptionRuleStorage.validateRule({ name, type, description }, true);
      const rule = await exceptionRuleStorage.createRule({
        name,
        type,
        description,
        chainId,
        scope: 'chain',
      });
      this.logValidationWarnings(rule);
      return { rule, warnings: [] };
    } catch (error) {
      if (error instanceof ExceptionRuleException) throw error;
      throw new ExceptionRuleException(
        ExceptionRuleError.STORAGE_ERROR,
        'Failed to create chain rule',
        error,
      );
    }
  }

  /** 实时检查规则名称重复 */
  async checkRuleNameRealTime(
    name: string,
    excludeId?: string,
  ): Promise<RealTimeCheckResult> {
    try {
      const result = await enhancedDuplicationHandler.checkDuplicationRealTime(
        name,
        excludeId,
      );
      return {
        hasConflict: result.hasConflict,
        conflictMessage: result.conflictMessage,
        suggestions: result.suggestions.map((s) => ({
          type: s.type,
          title: s.title,
          description: s.description,
          suggestedName: s.suggestedName,
        })),
      };
    } catch {
      return { hasConflict: false, suggestions: [] };
    }
  }

  private async logValidationWarnings(rule: ExceptionRule): Promise<void> {
    const validationResult = await validateRulesIntegrity([rule]);
    if (validationResult.invalidRules.length > 0) {
      logger.warn('RULE_CREATOR', 'Rule has issues', {
        invalidRules: validationResult.invalidRules,
      });
    }
  }

  private async handleCreationError(
    error: unknown,
    context: {
      name: string;
      type: ExceptionRuleType;
      description?: string;
      userChoice?: string;
    },
  ): Promise<RuleCreationResult> {
    const analysis = errorClassificationService.analyzeError(
      error instanceof ExceptionRuleException
        ? error
        : new ExceptionRuleException(
            ExceptionRuleError.STORAGE_ERROR,
            'Failed to create rule',
            error,
          ),
    );
    const recovery = await errorRecoveryManager.attemptRecovery(
      analysis.error,
      context,
      'create_rule',
    );
    if (recovery.success && recovery.recoveredData) {
      const ruleId = this.extractRuleIdFromRecovery(recovery.recoveredData);
      if (ruleId) {
        const rule = await exceptionRuleStorage.getRuleById(ruleId);
        if (rule)
          return {
            rule,
            warnings: [
              t('ruleManager.ruleCreator.ruleCreatedViaErrorRecovery'),
            ],
          };
      }
    }
    throw analysis.error;
  }

  private extractRuleIdFromRecovery(data: unknown): string | null {
    return typeof data === 'object' &&
      data !== null &&
      'id' in data &&
      typeof (data as { id: unknown }).id === 'string'
      ? (data as { id: string }).id
      : null;
  }
}

export const ruleCreator = new RuleCreator();
