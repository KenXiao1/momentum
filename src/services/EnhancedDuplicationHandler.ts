/**
 * 增强的重复规则处理服务
 * 提供实时重复检测、用户友好的处理选项和智能建议
 */

import {
  ExceptionRuleType,
  ExceptionRuleError,
  ExceptionRuleException,
} from '../types';
import type { ExceptionRule } from '../types';
import { exceptionRuleStorage } from './ExceptionRuleStorage';
import { tr } from '../utils/runtimeI18n';
import {
  findExactDuplicateRules,
  findSimilarRulesWithSimilarity,
} from './duplication/duplicationDetection';
import {
  createRuleIfNoConflict,
  handleCreateAnyway,
  handleModifyName,
  handleUseExisting,
} from './duplication/enhanced-handler/creationHandlers';
import {
  generateNameSuggestions as buildNameSuggestions,
  generateSuggestions,
  getConflictMessage,
} from './duplication/enhanced-handler/suggestionHelpers';
import type {
  DuplicationCheckResult,
  DuplicationConflictType,
  DuplicationSuggestion,
} from './duplication/enhanced-handler/types';

interface RealTimeDuplicationCheck {
  isChecking: boolean;
  hasConflict: boolean;
  conflictMessage?: string;
  suggestions: DuplicationSuggestion[];
}

export class EnhancedDuplicationHandler {
  /**
   * 生成智能的名称建议
   */
  generateNameSuggestions(baseName: string, existingNames: string[]): string[] {
    return buildNameSuggestions(baseName, existingNames);
  }

  /**
   * 实时重复检测（用于用户输入时）
   */
  async checkDuplicationRealTime(
    name: string,
    excludeId?: string,
  ): Promise<RealTimeDuplicationCheck> {
    if (!name || name.trim().length === 0) {
      return {
        isChecking: false,
        hasConflict: false,
        suggestions: [],
      };
    }

    try {
      const result = await this.checkDuplication(name.trim(), excludeId);

      return {
        isChecking: false,
        hasConflict: result.hasConflict,
        conflictMessage: result.hasConflict
          ? getConflictMessage(result.conflictType, result.existingRules)
          : undefined,
        suggestions: result.suggestions,
      };
    } catch {
      return {
        isChecking: false,
        hasConflict: false,
        suggestions: [
          {
            type: 'create_anyway',
            title: tr('继续创建', 'Continue'),
            description: tr(
              '检查失败，但可以尝试创建',
              'Check failed, but you can try creating it',
            ),
            handler: async () => null,
          },
        ],
      };
    }
  }

  /**
   * 完整的重复检查
   */
  async checkDuplication(
    name: string,
    excludeId?: string,
  ): Promise<DuplicationCheckResult> {
    const trimmedName = name.trim();
    try {
      const allRules = await exceptionRuleStorage.getRules();
      const exactMatches = findExactDuplicateRules(
        allRules,
        trimmedName,
        excludeId,
      );
      const similarMatches = findSimilarRulesWithSimilarity(
        allRules,
        trimmedName,
        0.7,
        excludeId,
      ).map((item) => item.rule);

      let conflictType: DuplicationConflictType = 'none';
      let existingRules: ExceptionRule[] = [];

      if (exactMatches.length > 0) {
        conflictType = 'exact';
        existingRules = exactMatches;
      } else if (similarMatches.length > 0) {
        conflictType = 'similar';
        existingRules = similarMatches;
      }

      const result: DuplicationCheckResult = {
        hasConflict: conflictType !== 'none',
        conflictType,
        existingRules,
        suggestions: generateSuggestions(
          trimmedName,
          conflictType,
          existingRules,
        ),
        canProceed: conflictType !== 'exact',
      };

      return result;
    } catch (error) {
      throw new ExceptionRuleException(
        ExceptionRuleError.STORAGE_ERROR,
        tr('重复检查失败', 'Duplicate check failed'),
        error,
      );
    }
  }

  /**
   * 处理重复规则创建请求
   */
  async handleDuplicateCreation(
    name: string,
    type: ExceptionRuleType,
    description?: string,
    userChoice?: 'use_existing' | 'modify_name' | 'create_anyway',
  ): Promise<{
    rule: ExceptionRule;
    action: string;
    warnings: string[];
  }> {
    const checkResult = await this.checkDuplication(name);

    if (!checkResult.hasConflict) {
      const result = await createRuleIfNoConflict(name, type, description);
      return result;
    }

    // 相似冲突默认允许创建，但提供警告
    if (checkResult.conflictType === 'similar' && userChoice === undefined) {
      const result = await handleCreateAnyway(
        name,
        type,
        description,
        checkResult,
      );
      return result;
    }

    // 有冲突，根据用户选择处理
    switch (userChoice) {
      case 'use_existing':
        return handleUseExisting(checkResult.existingRules, type);

      case 'modify_name': {
        const result = await handleModifyName(name, type, description);
        return result;
      }

      case 'create_anyway':
        if (checkResult.conflictType === 'exact') {
          throw new ExceptionRuleException(
            ExceptionRuleError.DUPLICATE_RULE_NAME,
            tr(
              `不能创建重复名称的规则: "${name}"`,
              `Cannot create a rule with a duplicate name: "${name}"`,
            ),
          );
        }
        {
          const result = await handleCreateAnyway(
            name,
            type,
            description,
            checkResult,
          );
          return result;
        }

      default:
        // 没有用户选择，抛出异常让用户决定
        throw new ExceptionRuleException(
          ExceptionRuleError.DUPLICATE_RULE_NAME,
          getConflictMessage(
            checkResult.conflictType,
            checkResult.existingRules,
          ),
          {
            checkResult,
            suggestions: checkResult.suggestions,
          },
        );
    }
  }
}

// 创建全局实例
export const enhancedDuplicationHandler = new EnhancedDuplicationHandler();
