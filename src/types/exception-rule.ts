// 例外规则系统类型定义
export enum ExceptionRuleType {
  PAUSE_ONLY = 'pause_only',
  EARLY_COMPLETION_ONLY = 'early_completion_only',
}

export interface ExceptionRule {
  id: string;
  name: string;
  description?: string;
  type: ExceptionRuleType;
  chainId?: string; // 关联的链ID，null表示全局规则
  scope: 'chain' | 'global'; // 规则作用域
  createdAt: Date;
  lastUsedAt?: Date;
  usageCount: number;
  isActive: boolean;
  isArchived?: boolean; // 归档状态
}

export interface RuleUsageRecord {
  id: string;
  ruleId: string;
  chainId: string;
  sessionId: string;
  usedAt: Date;
  actionType: 'pause' | 'early_completion';
  taskElapsedTime: number; // 使用规则时任务已进行的时间（秒）
  taskRemainingTime?: number; // 剩余时间（有时长任务）
  pauseDuration?: number; // 暂停时长（秒），仅暂停操作有效
  autoResume?: boolean; // 是否自动恢复，仅暂停操作有效
  ruleScope: 'chain' | 'global'; // 记录规则作用域
}

export interface PauseOptions {
  duration?: number; // 暂停时长（秒），undefined 表示无限暂停
  autoResume?: boolean; // 是否自动恢复
}

export interface SessionContext {
  sessionId: string;
  chainId: string;
  chainName: string;
  startedAt: Date;
  elapsedTime: number; // 秒
  remainingTime?: number; // 秒，无时长任务为 undefined
  isDurationless: boolean;
}
