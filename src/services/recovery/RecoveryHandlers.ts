/**
 * 具体恢复处理器
 * 实现各种错误类型的具体恢复逻辑
 */

import { ExceptionRuleException } from '../../types';
import { dataIntegrityChecker } from '../DataIntegrityChecker';
import { enhancedDuplicationHandler } from '../EnhancedDuplicationHandler';
import { t } from '../../utils/runtimeI18n';
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
      message: t('recovery.recoveryHandlers.pleaseCreateANewRule'),
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
      message: t('recovery.recoveryHandlers.pleaseSelectAnExistingRule'),
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
          message: t('recovery.recoveryHandlers.usingExistingRule'),
          recoveredData: rules[0],
        };
      }
    } catch {
      // 继续
    }

    return {
      success: false,
      message: t('recovery.recoveryHandlers.noUsableExistingRuleFound'),
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
            message: t(
              'recovery.recoveryHandlers.suggestedNameSuggestionsItem',
              { suggestionsItem: suggestions[0] },
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
      message: t('recovery.recoveryHandlers.unableToGenerateANewRuleName'),
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
      message: t(
        'recovery.recoveryHandlers.pleaseCreateARuleWithTheCorrectType',
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
      message: t(
        'recovery.recoveryHandlers.pleaseSelectARuleWithAMatchingType',
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
      message: t('recovery.recoveryHandlers.pleaseRetryTheOperation'),
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
          message: t('recovery.recoveryHandlers.dataIntegrityCheckPassed'),
        };
      }

      const autoFixableCount = report.issues.filter(
        (i) => i.autoFixable,
      ).length;
      return {
        success: false,
        message: t(
          'recovery.recoveryHandlers.foundReportIssuesCountIssueSAutoFixableCountCanBeAutoFixed',
          {
            reportIssuesCount: report.issues.length,
            autoFixableCount: autoFixableCount,
          },
        ),
        actions: [
          {
            id: 'auto_fix_issues',
            label: t('recovery.recoveryHandlers.autoFix'),
            description: t(
              'recovery.recoveryHandlers.automaticallyFixTheFixableIssues',
            ),
            type: 'primary',
            handler: async () => {
              const fixResults = await dataIntegrityChecker.autoFixIssues(
                report.issues.filter((i) => i.autoFixable),
              );
              const successCount = fixResults.filter((r) => r.success).length;
              return {
                success: successCount > 0,
                message: t(
                  'recovery.recoveryHandlers.fixedSuccessCountIssueS',
                  { successCount: successCount },
                ),
              };
            },
          },
        ],
      };
    } catch {
      return {
        success: false,
        message: t('recovery.recoveryHandlers.dataIntegrityCheckFailed'),
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
      message: t('recovery.recoveryHandlers.fixingValidationRequiresYourInput'),
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
      message: t(
        'recovery.recoveryHandlers.systemResetIsRiskyAndRequiresConfirmation',
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
