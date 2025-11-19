export interface Chain {
  id: string;
  parentId?: string; // 父任务ID，用于构建层级关系
  type: ChainType; // 任务类型/兵种
  sortOrder: number; // 在同一父任务下的排序
  name: string;
  trigger: string;
  duration: number; // in minutes
  description: string;
  currentStreak: number;
  auxiliaryStreak: number; // 辅助链连续成功记录
  totalCompletions: number;
  totalFailures: number;
  auxiliaryFailures: number; // 辅助链失败次数
  exceptions: string[];
  auxiliaryExceptions: string[]; // 辅助链例外规则
  // 辅助链设置
  auxiliarySignal: string; // 预约信号，如"打响指"、"设置闹钟"
  auxiliaryDuration: number; // 预约时长（分钟）
  auxiliaryCompletionTrigger: string; // 预约完成条件，通常与主链trigger相同
  // 任务群时间限定设置
  timeLimitHours?: number; // 时间限制（小时），仅在 type=group 时有效
  timeLimitExceptions: string[]; // 时间限制例外规则
  groupStartedAt?: Date; // 任务群开始时间
  groupExpiresAt?: Date; // 任务群过期时间
  // 无时长任务（手动结束）
  isDurationless?: boolean; // 为 true 时不倒计时，由用户手动结束
  createdAt: Date;
  lastCompletedAt?: Date;
}

export type ChainType = 
  | 'unit'          // 基础单元
  | 'group'         // 任务群容器
  | 'assault'       // 突击单元（学习、实验、论文）
  | 'recon'         // 侦查单元（信息搜集）
  | 'command'       // 指挥单元（制定计划）
  | 'special_ops'   // 特勤单元（处理杂事）
  | 'engineering'   // 工程单元（运动锻炼）
  | 'quartermaster'; // 炊事单元（备餐做饭）

// 任务树节点，用于前端渲染层级结构
export interface ChainTreeNode extends Chain {
  children: ChainTreeNode[];
  depth: number;
}

export interface ScheduledSession {
  chainId: string;
  scheduledAt: Date;
  expiresAt: Date;
  auxiliarySignal: string; // 记录使用的预约信号
}

export interface ActiveSession {
  chainId: string;
  startedAt: Date;
  duration: number;
  isPaused: boolean;
  pausedAt?: Date;
  totalPausedTime: number;
}

export interface CompletionHistory {
  chainId: string;
  completedAt: Date;
  duration: number;
  wasSuccessful: boolean;
  reasonForFailure?: string;
}

export type ViewState = 'dashboard' | 'editor' | 'focus' | 'detail' | 'group';

export interface AppState {
  chains: Chain[];
  scheduledSessions: ScheduledSession[];
  activeSession: ActiveSession | null;
  currentView: ViewState;
  editingChain: Chain | null;
  viewingChainId: string | null;
  completionHistory: CompletionHistory[];
}

// Exception rules related types (added to resolve missing exports after merge)
export enum ExceptionRuleType {
  PAUSE_ONLY = 'PAUSE_ONLY',
  EARLY_COMPLETION_ONLY = 'EARLY_COMPLETION_ONLY',
}

export enum ExceptionRuleError {
  STORAGE_ERROR = 'STORAGE_ERROR',
  DUPLICATE_RULE_NAME = 'DUPLICATE_RULE_NAME',
  RULE_NOT_FOUND = 'RULE_NOT_FOUND',
  RULE_TYPE_MISMATCH = 'RULE_TYPE_MISMATCH',
  INVALID_RULE_TYPE = 'INVALID_RULE_TYPE',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

export interface ExceptionRule {
  id: string;
  name: string;
  type: ExceptionRuleType;
  description?: string;
  chainId?: string; // 当为链专属规则时关联链
  scope: 'chain' | 'global';
  isActive: boolean;
  isArchived?: boolean;
  usageCount: number;
  createdAt: Date;
  lastUsedAt?: Date;
}

export interface RuleUsageRecord {
  id: string;
  ruleId: string;
  chainId?: string;
  sessionId?: string;
  usedAt: Date;
  pauseDuration?: number; // seconds
  autoResume?: boolean;
  ruleScope?: 'chain' | 'global';
}

export interface ExceptionRuleStorage {
  rules: ExceptionRule[];
  usageRecords: RuleUsageRecord[];
  lastSyncAt?: Date;
}

// Minimal exception wrapper class types exported for instanceof checks
export class ExceptionRuleException extends Error {
  public type: ExceptionRuleError;
  public original?: any;
  constructor(type: ExceptionRuleError, message?: string, original?: any) {
    super(message || String(type));
    this.name = 'ExceptionRuleException';
    this.type = type;
    this.original = original;
  }
}

export class EnhancedExceptionRuleException extends ExceptionRuleException {
  public errorCode?: string;
  static createUserFriendly(type: ExceptionRuleError, message?: string, original?: any) {
    return new EnhancedExceptionRuleException(type, message, original);
  }
}