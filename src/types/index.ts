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

// Minimal RSIP types (added to satisfy components importing RSIPNode/RSIPTreeNode/RSIPMeta)
export type RSIPNode = {
  id: string;
  parentId?: string;
  title: string;
  rule: string;
  sortOrder: number;
  createdAt: Date;
  useTimer?: boolean;
  timerMinutes?: number;
  // allow small, opt-in metadata used by RSIPView (type/emoji)
  type?: string;
  emoji?: string;
};

export interface RSIPTreeNode extends RSIPNode {
  children: RSIPTreeNode[];
  depth: number;
}

export interface RSIPMeta {
  allowMultiplePerDay?: boolean;
  lastAddedAt?: Date | string;
  // persisted custom type presets
  typePresets?: Array<{ type: string; emoji: string }>;
}

// Exception rule types used across services (enum-like)
export enum ExceptionRuleType {
  PAUSE_ONLY = 'PAUSE_ONLY',
  EARLY_COMPLETION_ONLY = 'EARLY_COMPLETION_ONLY',
}

export interface ExceptionRule {
  id: string;
  type: ExceptionRuleType | string;
  name: string;
  isActive?: boolean;
  usageCount?: number;
  lastUsedAt?: Date | null;
  createdAt?: Date;
  message?: string;
}

// Error codes used by exception services
export enum ExceptionRuleError {
  RULE_NOT_FOUND = 'RULE_NOT_FOUND',
  INVALID_RULE_TYPE = 'INVALID_RULE_TYPE',
  RULE_TYPE_MISMATCH = 'RULE_TYPE_MISMATCH',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

// Lightweight enhanced exception with chainable helpers used in services/tests
export class EnhancedExceptionRuleException extends Error {
  public code?: ExceptionRuleError;
  public detail?: string;
  public meta?: any;
  public suggestions: string[] = [];

  constructor(message?: string) {
    super(message);
    this.name = 'EnhancedExceptionRuleException';
  }

  static createUserFriendly(code: ExceptionRuleError, userMessage?: string, detail?: string, meta?: any) {
    const e = new EnhancedExceptionRuleException(userMessage || String(code));
    e.code = code;
    e.detail = detail;
    e.meta = meta;
    return e;
  }

  addSuggestedAction(action: string) {
    this.suggestions.push(action);
    return this;
  }
}

// Backwards-compatible lightweight exception class for places that import ExceptionRuleException
export class ExceptionRuleException extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'ExceptionRuleException';
  }
}