/**
 * 具体恢复处理器
 * 实现各种错误类型的具体恢复逻辑
 */

import { ExceptionRuleException } from '../../types';
import { dataIntegrityChecker } from '../DataIntegrityChecker';
import { enhancedDuplicationHandler } from '../EnhancedDuplicationHandler';
import { tr } from '../../utils/runtimeI18n';
import { ignoreUnused } from '../../utils/ignoreUnused';
import { RecoveryResult } from './RecoveryStrategy';

/**
 * 恢复处理器集合
 * 提供各种错误场景的具体恢复实现
 */
export const recoveryHandlers = {
  /**
   * 处理创建新规则
   */
  async handleCreateNewRule(
    error: ExceptionRuleException,
  ): Promise<RecoveryResult> {
    ignoreUnused(error);
    return {
      success: false,
      message: tr('请创建新规则', 'Please create a new rule'),
      requiresUserAction: true,
    };
  },

  /**
   * 处理选择现有规则
   */
  async handleSelectExistingRule(
    error: ExceptionRuleException,
  ): Promise<RecoveryResult> {
    ignoreUnused(error);
    return {
      success: false,
      message: tr('请选择现有规则', 'Please select an existing rule'),
      requiresUserAction: true,
    };
  },

  /**
   * 处理使用现有规则
   */
  async handleUseExistingRule(
    error: ExceptionRuleException,
  ): Promise<RecoveryResult> {
    try {
      const existingRules =
        error.details && typeof error.details === 'object'
          ? (error.details as { existingRules?: unknown }).existingRules
          : undefined;

      const rules = Array.isArray(existingRules) ? existingRules : [];
      if (rules.length > 0) {
        return {
          success: true,
          message: tr('使用现有规则', 'Using existing rule'),
          recoveredData: rules[0],
        };
      }
    } catch {
      // 继续
    }

    return {
      success: false,
      message: tr('无法找到可用的现有规则', 'No usable existing rule found'),
    };
  },

  /**
   * 处理重命名规则
   */
  async handleRenameRule(
    error: ExceptionRuleException,
  ): Promise<RecoveryResult> {
    try {
      const ruleName = extractRuleNameFromError(error);
      if (ruleName) {
        const suggestions = enhancedDuplicationHandler.generateNameSuggestions(
          ruleName,
          [],
        );

        if (suggestions.length > 0) {
          return {
            success: true,
            message: tr(
              `建议使用名称: ${suggestions[0]}`,
              `Suggested name: ${suggestions[0]}`,
            ),
            recoveredData: { suggestedName: suggestions[0] },
          };
        }
      }
    } catch {
      // 继续
    }

    return {
      success: false,
      message: tr('无法生成新的规则名称', 'Unable to generate a new rule name'),
    };
  },

  /**
   * 处理创建正确类型的规则
   */
  async handleCreateCorrectType(
    error: ExceptionRuleException,
  ): Promise<RecoveryResult> {
    ignoreUnused(error);
    return {
      success: false,
      message: tr(
        '请创建正确类型的规则',
        'Please create a rule with the correct type',
      ),
      requiresUserAction: true,
    };
  },

  /**
   * 处理选择匹配类型的规则
   */
  async handleSelectMatchingRule(
    error: ExceptionRuleException,
  ): Promise<RecoveryResult> {
    ignoreUnused(error);
    return {
      success: false,
      message: tr(
        '请选择类型匹配的规则',
        'Please select a rule with a matching type',
      ),
      requiresUserAction: true,
    };
  },

  /**
   * 处理重试操作
   */
  async handleRetryOperation(
    error: ExceptionRuleException,
  ): Promise<RecoveryResult> {
    ignoreUnused(error);
    return {
      success: false,
      message: tr('请重试操作', 'Please retry the operation'),
      requiresUserAction: true,
    };
  },

  /**
   * 处理数据完整性检查
   */
  async handleDataIntegrityCheck(
    error: ExceptionRuleException,
  ): Promise<RecoveryResult> {
    ignoreUnused(error);
    try {
      const report = await dataIntegrityChecker.checkRuleDataIntegrity();

      if (report.issues.length === 0) {
        return {
          success: true,
          message: tr('数据完整性检查通过', 'Data integrity check passed'),
        };
      }

      const autoFixableCount = report.issues.filter(
        (i) => i.autoFixable,
      ).length;
      return {
        success: false,
        message: tr(
          `发现 ${report.issues.length} 个问题，其中 ${autoFixableCount} 个可自动修复`,
          `Found ${report.issues.length} issue(s), ${autoFixableCount} can be auto-fixed`,
        ),
        actions: [
          {
            id: 'auto_fix_issues',
            label: tr('自动修复', 'Auto-fix'),
            description: tr(
              '自动修复可修复的问题',
              'Automatically fix the fixable issues',
            ),
            type: 'primary',
            handler: async () => {
              const fixResults = await dataIntegrityChecker.autoFixIssues(
                report.issues.filter((i) => i.autoFixable),
              );
              const successCount = fixResults.filter((r) => r.success).length;
              return {
                success: successCount > 0,
                message: tr(
                  `已修复 ${successCount} 个问题`,
                  `Fixed ${successCount} issue(s)`,
                ),
              };
            },
          },
        ],
      };
    } catch {
      return {
        success: false,
        message: tr('数据完整性检查失败', 'Data integrity check failed'),
      };
    }
  },

  /**
   * 处理验证修复
   */
  async handleValidationFix(
    error: ExceptionRuleException,
  ): Promise<RecoveryResult> {
    ignoreUnused(error);
    return {
      success: false,
      message: tr(
        '验证修复需要用户输入',
        'Fixing validation requires your input',
      ),
      requiresUserAction: true,
    };
  },

  /**
   * 处理系统重置
   */
  async handleSystemReset(
    error: ExceptionRuleException,
  ): Promise<RecoveryResult> {
    ignoreUnused(error);
    return {
      success: false,
      message: tr(
        '系统重置是危险操作，需要用户确认',
        'System reset is risky and requires confirmation',
      ),
      requiresUserAction: true,
    };
  },
};

/**
 * 从错误信息中提取规则名称
 */
function extractRuleNameFromError(
  error: ExceptionRuleException,
): string | null {
  const message = error.message;
  const match = message.match(/(?:规则名称|Rule name)\s+"([^"]+)"/i);
  return match?.[1] ?? null;
}
