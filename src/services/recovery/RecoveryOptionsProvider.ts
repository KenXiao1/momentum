/**
 * 用户恢复选项生成器
 * 根据错误类型生成适当的用户可选恢复操作
 */

import { ExceptionRuleError, ExceptionRuleException } from '../../types';
import { tr } from '../../utils/runtimeI18n';
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
            label: tr('创建新规则', 'Create new rule'),
            description: tr(
              '创建一个新的规则来替代缺失的规则',
              'Create a new rule to replace the missing one',
            ),
            type: 'primary',
            handler: async () => recoveryHandlers.handleCreateNewRule(error),
          },
          {
            id: 'select_existing_rule',
            label: tr('选择现有规则', 'Select existing rule'),
            description: tr(
              '从现有规则中选择一个',
              'Choose one from existing rules',
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
            label: tr('使用现有规则', 'Use existing rule'),
            description: tr(
              '使用已存在的同名规则',
              'Use the existing rule with the same name',
            ),
            type: 'primary',
            handler: async () => recoveryHandlers.handleUseExistingRule(error),
          },
          {
            id: 'rename_rule',
            label: tr('重命名规则', 'Rename rule'),
            description: tr(
              '为新规则生成一个不同的名称',
              'Generate a different name for the new rule',
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
            label: tr('创建正确类型的规则', 'Create correct type'),
            description: tr(
              '创建一个类型匹配的新规则',
              'Create a new rule with a matching type',
            ),
            type: 'primary',
            handler: async () =>
              recoveryHandlers.handleCreateCorrectType(error),
          },
          {
            id: 'select_matching_rule',
            label: tr('选择匹配的规则', 'Select matching rule'),
            description: tr(
              '选择一个类型匹配的现有规则',
              'Select an existing rule with a matching type',
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
            label: tr('重试操作', 'Retry'),
            description: tr('重新尝试执行操作', 'Try the operation again'),
            type: 'primary',
            handler: async () => recoveryHandlers.handleRetryOperation(error),
          },
          {
            id: 'check_data_integrity',
            label: tr('检查数据完整性', 'Check data integrity'),
            description: tr(
              '运行数据完整性检查和修复',
              'Run a data integrity check and auto-fix if possible',
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
          label: tr('检查数据完整性', 'Check data integrity'),
          description: tr('检查并修复规则数据', 'Check and repair rule data'),
          type: 'secondary',
          handler: async () => recoveryHandlers.handleDataIntegrityCheck(error),
        });
    }

    return actions;
  }
}

// 创建全局选项提供器实例
export const recoveryOptionsProvider = new RecoveryOptionsProvider();
