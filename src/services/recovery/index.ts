/**
 * 错误恢复模块索引
 * 导出所有恢复相关的类型、类和函数
 */

// 核心类型和接口
export type {
  RecoveryResult,
  RecoveryAction,
  RecoveryContext,
  RecoveryStrategy,
} from './RecoveryStrategy';

export { RecoveryStrategyRegistry } from './RecoveryStrategy';

// 恢复选项提供器
export { recoveryOptionsProvider } from './RecoveryOptionsProvider';

// 恢复处理器

// 默认策略
export {
  initializeDefaultStrategies,
  createUnknownErrorResult,
  createRecoveryFailureResult,
} from './DefaultStrategies';
