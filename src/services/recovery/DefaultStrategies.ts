/**
 * 默认恢复策略初始化
 * 注册所有内置的错误恢复策略
 */

import { ExceptionRuleError } from '../../types';
import { dataIntegrityChecker } from '../DataIntegrityChecker';
import { tr } from '../../utils/runtimeI18n';
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
        message: tr(
          '无法自动恢复缺失的规则',
          'Unable to auto-recover the missing rule',
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
        message: tr('发现重复的规则名称', 'Duplicate rule name detected'),
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
        message: tr(
          '规则类型与操作不匹配',
          'Rule type does not match the action',
        ),
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
              message: tr(
                `已自动修复 ${successCount} 个数据问题`,
                `Auto-fixed ${successCount} data issue(s)`,
              ),
            };
          }
        }
      } catch {
        // 继续其他策略
      }

      return {
        success: false,
        message: tr(
          '存储错误需要手动处理',
          'Storage error requires manual handling',
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
        message: tr(
          '验证错误需要用户确认',
          'Validation requires your confirmation',
        ),
        requiresUserAction: true,
        actions: [
          {
            id: 'fix_validation',
            label: tr('修复验证问题', 'Fix validation issues'),
            description: tr(
              '尝试修复数据验证问题',
              'Try to fix validation issues',
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
    message: tr(
      `未知错误类型: ${errorType}`,
      `Unknown error type: ${errorType}`,
    ),
    actions: [
      {
        id: 'check_data_integrity',
        label: tr('检查数据完整性', 'Check data integrity'),
        description: tr('检查并修复规则数据', 'Check and repair rule data'),
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
    message: tr(
      '所有自动恢复策略都失败了',
      'All auto-recovery strategies failed',
    ),
    actions: [
      {
        id: 'manual_intervention',
        label: tr('手动处理', 'Manual fix'),
        description: tr(
          '需要手动解决此问题',
          'This requires manual intervention',
        ),
        type: 'danger',
        handler: async () => ({
          success: false,
          message: tr('需要手动处理', 'Manual intervention required'),
        }),
      },
      {
        id: 'reset_system',
        label: tr('重置系统', 'Reset system'),
        description: tr(
          '重置规则系统到初始状态',
          'Reset the rule system to the initial state',
        ),
        type: 'danger',
        handler: async () => recoveryHandlers.handleSystemReset({} as never),
      },
    ],
  };
}
