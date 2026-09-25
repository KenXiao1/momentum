/**
 * 增强的重复规则处理服务
 * 提供重复检测、用户友好的处理选项和智能建议
 */

import {
  ExceptionRuleType,
  ExceptionRuleError,
  ExceptionRuleException,
} from '../types';
import type { ExceptionRule } from '../types';
import { exceptionRuleStorage } from './ExceptionRuleStorage';
import { t } from '../utils/runtimeI18n';
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
  DuplicateResolution,
} from './duplication/enhanced-handler/types';

export class EnhancedDuplicationHandler {
  /**
   * 生成智能的名称建议
   */
  generateNameSuggestions(baseName: string, existingNames: string[]): string[] {
    return buildNameSuggestions(baseName, existingNames);
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
        t('enhancedDuplicationHandler.duplicateCheckFailed'),
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
    userChoice?: DuplicateResolution,
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

    // Resolve focus-mode intent against this read instead of a separate UI precheck.
    if (userChoice === 'reuse_exact') {
      userChoice =
        checkResult.conflictType === 'exact' ? 'use_existing' : 'create_anyway';
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
            t(
              'enhancedDuplicationHandler.cannotCreateARuleWithADuplicateName',
              { name: name },
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
