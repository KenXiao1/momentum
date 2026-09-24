/**
 * 默认恢复策略初始化
 * 注册所有内置的错误恢复策略
 */

import { ExceptionRuleError } from '../../types';
import { dataIntegrityChecker } from '../DataIntegrityChecker';
import { t } from '../../utils/runtimeI18n';
import { RecoveryStrategyRegistry, RecoveryResult } from './RecoveryStrategy';
import { recoveryOptionsProvider } from './RecoveryOptionsProvider';
import { recoveryHandlers } from './RecoveryHandlers';

/**
 * 初始化所有默认恢复策略
 * @param registry 策略注册表
 */
export function initializeDefaultStrategies(
  registry: RecoveryStrategyRegistry,
): void {
  // 规则不存在的恢复策略
  registry.registerStrategy({
    errorType: ExceptionRuleError.RULE_NOT_FOUND,
    strategy: 'auto_fix',
    priority: 100,
    handler: async (error) => {
      return {
        success: false,
        message: t(
          'recovery.defaultStrategies.unableToAutoRecoverTheMissingRule',
        ),
        requiresUserAction: true,
        actions: recoveryOptionsProvider.getRecoveryOptions(error),
      };
    },
  });

  // 重复规则名称的恢复策略
  registry.registerStrategy({
    errorType: ExceptionRuleError.DUPLICATE_RULE_NAME,
    strategy: 'user_choice',
    priority: 100,
    handler: async (error) => {
      return {
        success: false,
        message: t('recovery.defaultStrategies.duplicateRuleNameDetected'),
        requiresUserAction: true,
        actions: recoveryOptionsProvider.getRecoveryOptions(error),
      };
    },
  });

  // 规则类型不匹配的恢复策略
  registry.registerStrategy({
    errorType: ExceptionRuleError.RULE_TYPE_MISMATCH,
    strategy: 'user_choice',
    priority: 100,
    handler: async (error) => {
      return {
        success: false,
        message: t('recovery.defaultStrategies.ruleTypeDoesNotMatchTheAction'),
        requiresUserAction: true,
        actions: recoveryOptionsProvider.getRecoveryOptions(error),
      };
    },
  });

  // 存储错误的恢复策略
  registry.registerStrategy({
    errorType: ExceptionRuleError.STORAGE_ERROR,
    strategy: 'auto_fix',
    priority: 100,
    handler: async (error) => {
      try {
        const report = await dataIntegrityChecker.checkRuleDataIntegrity();
        const autoFixableIssues = report.issues.filter(
          (issue) => issue.autoFixable,
        );

        if (autoFixableIssues.length > 0) {
          const fixResults =
            await dataIntegrityChecker.autoFixIssues(autoFixableIssues);
          const successCount = fixResults.filter((r) => r.success).length;

          if (successCount > 0) {
            return {
              success: true,
              message: t(
                'recovery.defaultStrategies.autoFixedSuccessCountDataIssueS',
                { successCount: successCount },
              ),
            };
          }
        }
      } catch {
        // 继续其他策略
      }

      return {
        success: false,
        message: t(
          'recovery.defaultStrategies.storageErrorRequiresManualHandling',
        ),
        requiresUserAction: true,
        actions: recoveryOptionsProvider.getRecoveryOptions(error),
      };
    },
  });

  // 验证错误的恢复策略
  registry.registerStrategy({
    errorType: ExceptionRuleError.VALIDATION_ERROR,
    strategy: 'auto_fix',
    priority: 100,
    handler: async (error) => {
      return {
        success: false,
        message: t(
          'recovery.defaultStrategies.validationRequiresYourConfirmation',
        ),
        requiresUserAction: true,
        actions: [
          {
            id: 'fix_validation',
            label: t('recovery.defaultStrategies.fixValidationIssues'),
            description: t(
              'recovery.defaultStrategies.tryToFixValidationIssues',
            ),
            type: 'primary',
            handler: async () => recoveryHandlers.handleValidationFix(error),
          },
        ],
      };
    },
  });
}

/**
 * 创建未知错误的恢复结果
 */
export function createUnknownErrorResult(errorType: string): RecoveryResult {
  return {
    success: false,
    message: t('recovery.defaultStrategies.unknownErrorTypeErrorType', {
      errorType: errorType,
    }),
    actions: [
      {
        id: 'check_data_integrity',
        label: t('recovery.defaultStrategies.checkDataIntegrity'),
        description: t('recovery.defaultStrategies.checkAndRepairRuleData'),
        type: 'secondary',
        handler: async () =>
          recoveryHandlers.handleDataIntegrityCheck({} as never),
      },
    ],
  };
}

/**
 * 创建恢复失败的结果
 */
export function createRecoveryFailureResult(): RecoveryResult {
  return {
    success: false,
    message: t('recovery.defaultStrategies.allAutoRecoveryStrategiesFailed'),
    actions: [
      {
        id: 'manual_intervention',
        label: t('errorRecoveryManager.manualFix'),
        description: t('errorRecoveryManager.thisRequiresManualIntervention'),
        type: 'danger',
        handler: async () => ({
          success: false,
          message: t('errorRecoveryManager.manualInterventionRequired'),
        }),
      },
      {
        id: 'reset_system',
        label: t('recovery.defaultStrategies.resetSystem'),
        description: t(
          'recovery.defaultStrategies.resetTheRuleSystemToTheInitialState',
        ),
        type: 'danger',
        handler: async () => recoveryHandlers.handleSystemReset({} as never),
      },
    ],
  };
}
