/**
 * 用户恢复选项生成器
 * 根据错误类型生成适当的用户可选恢复操作
 */

import { ExceptionRuleError, ExceptionRuleException } from '../../types';
import { t } from '../../utils/runtimeI18n';
import { RecoveryAction } from './RecoveryStrategy';
import { recoveryHandlers } from './RecoveryHandlers';

/**
 * 恢复选项提供器
 * 根据错误类型生成用户可选的恢复操作列表
 */
class RecoveryOptionsProvider {
  /**
   * 获取指定错误的恢复选项
   * @param error 异常规则错误
   * @returns 可用的恢复操作列表
   */
  getRecoveryOptions(error: ExceptionRuleException): RecoveryAction[] {
    const actions: RecoveryAction[] = [];

    switch (error.type) {
      case ExceptionRuleError.RULE_NOT_FOUND:
        actions.push(
          {
            id: 'create_new_rule',
            label: t('recovery.recoveryOptionsProvider.createNewRule'),
            description: t(
              'recovery.recoveryOptionsProvider.createANewRuleToReplaceTheMissingOne',
            ),
            type: 'primary',
            handler: async () => recoveryHandlers.handleCreateNewRule(error),
          },
          {
            id: 'select_existing_rule',
            label: t('recovery.recoveryOptionsProvider.selectExistingRule'),
            description: t(
              'recovery.recoveryOptionsProvider.chooseOneFromExistingRules',
            ),
            type: 'secondary',
            handler: async () =>
              recoveryHandlers.handleSelectExistingRule(error),
          },
        );
        break;

      case ExceptionRuleError.DUPLICATE_RULE_NAME:
        actions.push(
          {
            id: 'use_existing_rule',
            label: t(
              'duplication.enhancedHandler.suggestionHelpers.useExistingRule',
            ),
            description: t(
              'recovery.recoveryOptionsProvider.useTheExistingRuleWithTheSameName',
            ),
            type: 'primary',
            handler: async () => recoveryHandlers.handleUseExistingRule(error),
          },
          {
            id: 'rename_rule',
            label: t('recovery.recoveryOptionsProvider.renameRule'),
            description: t(
              'recovery.recoveryOptionsProvider.generateADifferentNameForTheNewRule',
            ),
            type: 'secondary',
            handler: async () => recoveryHandlers.handleRenameRule(error),
          },
        );
        break;

      case ExceptionRuleError.RULE_TYPE_MISMATCH:
        actions.push(
          {
            id: 'create_correct_type',
            label: t('recovery.recoveryOptionsProvider.createCorrectType'),
            description: t(
              'recovery.recoveryOptionsProvider.createANewRuleWithAMatchingType',
            ),
            type: 'primary',
            handler: async () =>
              recoveryHandlers.handleCreateCorrectType(error),
          },
          {
            id: 'select_matching_rule',
            label: t('recovery.recoveryOptionsProvider.selectMatchingRule'),
            description: t(
              'recovery.recoveryOptionsProvider.selectAnExistingRuleWithAMatchingType',
            ),
            type: 'secondary',
            handler: async () =>
              recoveryHandlers.handleSelectMatchingRule(error),
          },
        );
        break;

      case ExceptionRuleError.STORAGE_ERROR:
        actions.push(
          {
            id: 'retry_operation',
            label: t('focusMode.useExceptionRuleOperations.retry'),
            description: t(
              'recovery.recoveryOptionsProvider.tryTheOperationAgain',
            ),
            type: 'primary',
            handler: async () => recoveryHandlers.handleRetryOperation(error),
          },
          {
            id: 'check_data_integrity',
            label: t('recovery.defaultStrategies.checkDataIntegrity'),
            description: t(
              'recovery.recoveryOptionsProvider.runADataIntegrityCheckAndAutoFixIfPossible',
            ),
            type: 'secondary',
            handler: async () =>
              recoveryHandlers.handleDataIntegrityCheck(error),
          },
        );
        break;

      default:
        actions.push({
          id: 'check_data_integrity',
          label: t('recovery.defaultStrategies.checkDataIntegrity'),
          description: t('recovery.defaultStrategies.checkAndRepairRuleData'),
          type: 'secondary',
          handler: async () => recoveryHandlers.handleDataIntegrityCheck(error),
        });
    }

    return actions;
  }
}

// 创建全局选项提供器实例
export const recoveryOptionsProvider = new RecoveryOptionsProvider();
