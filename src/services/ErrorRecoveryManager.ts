/**
 * 错误恢复管理器
 * 作为协调器统一管理错误恢复流程
 *
 * 职责：
 * - 协调恢复策略的执行
 * - 管理恢复历史记录
 * - 提供统一的恢复入口
 *
 * 相关模块：
 * - RecoveryStrategy: 策略定义和注册
 * - RecoveryOptionsProvider: 用户选项生成
 * - RecoveryHandlers: 具体恢复处理器
 * - DefaultStrategies: 默认策略初始化
 */

import { ExceptionRuleException } from '../types';
import { logger } from '../utils/logger';
import { t } from '../utils/runtimeI18n';

import {
  RecoveryResult,
  RecoveryAction,
  RecoveryContext,
  RecoveryStrategy,
  RecoveryHistoryEntry,
  RecoveryStrategyRegistry,
  recoveryOptionsProvider,
  initializeDefaultStrategies,
  createUnknownErrorResult,
  createRecoveryFailureResult,
} from './recovery';

// 重新导出类型以保持向后兼容
export type { RecoveryAction };

/**
 * 错误恢复管理器
 * 提供智能的错误恢复策略和用户友好的错误处理
 */
class ErrorRecoveryManager {
  private registry: RecoveryStrategyRegistry;
  private recoveryHistory: RecoveryHistoryEntry[] = [];

  constructor() {
    this.registry = new RecoveryStrategyRegistry();
    initializeDefaultStrategies(this.registry);
  }

  /**
   * 注册恢复策略
   * @param strategy 要注册的恢复策略
   */
  registerRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.registry.registerStrategy(strategy);
  }

  /**
   * 尝试错误恢复
   * @param error 异常规则错误
   * @param context 上下文数据
   * @param originalOperation 原始操作名称
   * @returns 恢复结果
   */
  async attemptRecovery(
    error: ExceptionRuleException,
    context: unknown,
    originalOperation?: string,
  ): Promise<RecoveryResult> {
    const recoveryContext: RecoveryContext = {
      errorType: error.type,
      originalOperation: originalOperation || 'unknown',
      operationData: context,
      timestamp: new Date(),
      retryCount: 0,
    };

    logger.info('ERROR_RECOVERY', '开始错误恢复', {
      error: error.message,
      type: error.type,
      context,
    });

    try {
      const strategies = this.registry.getStrategies(error.type);

      if (strategies.length === 0) {
        return createUnknownErrorResult(error.type);
      }

      // 尝试每个策略
      for (const strategy of strategies) {
        try {
          const result = await strategy.handler(error, recoveryContext);

          // 记录恢复历史
          this.recordHistory(error, recoveryContext, result);

          if (result.success) {
            logger.info('ERROR_RECOVERY', '错误恢复成功', {
              message: result.message,
            });
            return result;
          }

          // 如果需要用户操作，返回结果
          if (result.requiresUserAction) {
            return result;
          }
        } catch (strategyError) {
          const err =
            strategyError instanceof Error
              ? strategyError
              : new Error(String(strategyError));
          logger.error('ERROR_RECOVERY', '恢复策略执行失败', undefined, err);
          continue;
        }
      }

      // 所有策略都失败了
      return createRecoveryFailureResult();
    } catch (recoveryError) {
      const err =
        recoveryError instanceof Error
          ? recoveryError
          : new Error(String(recoveryError));
      logger.error('ERROR_RECOVERY', '错误恢复过程失败', undefined, err);

      return {
        success: false,
        message: t('errorRecoveryManager.errorRecoveryFailed'),
        actions: [
          {
            id: 'manual_intervention',
            label: t('errorRecoveryManager.manualFix'),
            description: t(
              'errorRecoveryManager.thisRequiresManualIntervention',
            ),
            type: 'danger',
            handler: async () => ({
              success: false,
              message: t('errorRecoveryManager.manualInterventionRequired'),
            }),
          },
        ],
      };
    }
  }

  /**
   * 提供用户选择的恢复选项
   * @param error 异常规则错误
   * @returns 可用的恢复操作列表
   */
  getRecoveryOptions(error: ExceptionRuleException): RecoveryAction[] {
    return recoveryOptionsProvider.getRecoveryOptions(error);
  }

  /**
   * 获取恢复历史
   * @returns 恢复历史记录的副本
   */
  getRecoveryHistory(): RecoveryHistoryEntry[] {
    return [...this.recoveryHistory];
  }

  /**
   * 清除恢复历史
   */
  clearRecoveryHistory(): void {
    this.recoveryHistory = [];
  }

  /**
   * 记录恢复历史
   */
  private recordHistory(
    error: ExceptionRuleException,
    context: RecoveryContext,
    result: RecoveryResult,
  ): void {
    this.recoveryHistory.push({
      error,
      context,
      result,
      timestamp: new Date(),
    });
  }
}

// 创建全局实例
export const errorRecoveryManager = new ErrorRecoveryManager();
