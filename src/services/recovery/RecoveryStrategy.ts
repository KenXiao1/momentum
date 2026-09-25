/**
 * 恢复策略定义和类型
 * 定义错误恢复相关的接口和类型
 */

import { ExceptionRuleError, ExceptionRuleException } from '../../types';

/**
 * 恢复操作结果
 */
export interface RecoveryResult {
  success: boolean;
  message: string;
  actions?: RecoveryAction[];
  recoveredData?: unknown;
  requiresUserAction?: boolean;
}

/**
 * 用户可选的恢复操作
 */
export interface RecoveryAction {
  id: string;
  label: string;
  description: string;
  type: 'primary' | 'secondary' | 'danger';
  handler: () => Promise<RecoveryResult>;
}

/**
 * 恢复上下文信息
 */
export interface RecoveryContext {
  errorType: ExceptionRuleError;
  originalOperation: string;
  operationData: unknown;
  timestamp: Date;
  retryCount: number;
}

/**
 * 恢复策略定义
 */
export interface RecoveryStrategy {
  errorType: ExceptionRuleError;
  strategy: 'auto_fix' | 'user_choice' | 'fallback' | 'reset';
  priority: number;
  handler: (
    error: ExceptionRuleException,
    context: RecoveryContext,
  ) => Promise<RecoveryResult>;
}

/**
 * 恢复策略注册表
 * 管理错误类型到恢复策略的映射
 */
export class RecoveryStrategyRegistry {
  private strategies = new Map<ExceptionRuleError, RecoveryStrategy[]>();

  /**
   * 注册恢复策略
   * @param strategy 要注册的恢复策略
   */
  registerStrategy(strategy: RecoveryStrategy): void {
    if (!this.strategies.has(strategy.errorType)) {
      this.strategies.set(strategy.errorType, []);
    }

    const strategies = this.strategies.get(strategy.errorType)!;
    strategies.push(strategy);

    // 按优先级排序（高优先级在前）
    strategies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 获取指定错误类型的所有策略
   * @param errorType 错误类型
   * @returns 已排序的策略列表
   */
  getStrategies(errorType: ExceptionRuleError): RecoveryStrategy[] {
    return this.strategies.get(errorType) || [];
  }

  /**
   * 检查是否有指定错误类型的策略
   * @param errorType 错误类型
   */
  hasStrategies(errorType: ExceptionRuleError): boolean {
    const strategies = this.strategies.get(errorType);
    return strategies !== undefined && strategies.length > 0;
  }

  /**
   * 清除所有策略
   */
  clear(): void {
    this.strategies.clear();
  }
}

// 创建全局策略注册表实例
