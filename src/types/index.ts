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
  minimumDuration?: number; // 无时长任务的最小时长（分钟），达到后可提前完成
  // 任务群重复功能
  isTaskGroup?: boolean; // 是否为任务群（独立于链系统）
  taskRepeatCount?: number; // 单个任务重复次数
  groupRepeatCount?: number; // 整个任务群重复次数
  // 回收箱功能
  deletedAt?: Date | null; // 软删除时间戳，null表示未删除
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

// 已删除的链条接口
export interface DeletedChain extends Chain {
  deletedAt: Date; // 删除时间戳，对于已删除的链条这个字段是必需的
}

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
  // 正向计时相关字段
  isForwardTimer?: boolean; // 是否为正向计时模式
  forwardElapsedTime?: number; // 正向计时已用时间（秒）
}

export interface CompletionHistory {
  chainId: string;
  completedAt: Date;
  duration: number;
  wasSuccessful: boolean;
  reasonForFailure?: string;
  // 实际用时相关字段
  actualDuration?: number; // 实际用时（分钟）
  isForwardTimed?: boolean; // 是否为正向计时任务
  // 任务完成描述和备注
  description?: string; // 任务完成描述
  notes?: string; // 备注
}

// 任务用时统计接口
export interface TaskTimeStats {
  chainId: string;
  lastCompletionTime?: number; // 上次完成用时（分钟）
  averageCompletionTime?: number; // 平均完成用时（分钟）
  totalCompletions: number; // 总完成次数
  totalTime: number; // 总用时（分钟）
}

// RSIP（递归稳态迭代协议）类型定义
export interface RSIPNode {
  id: string;
  parentId?: string; // 父节点ID
  title: string; // 国策/定式名称
  rule: string; // 精准、可执行的规则描述
  sortOrder: number; // 排序（同一父节点下）
  createdAt: Date; // 创建时间
  // 可选的计时配置（参考神圣座位预约时长逻辑）
  useTimer?: boolean;
  timerMinutes?: number; // 倒计时分钟数
}

export interface RSIPTreeNode extends RSIPNode {
  children: RSIPTreeNode[];
  depth: number;
}

export interface RSIPMeta {
  lastAddedAt?: Date; // 最近一次添加国策的日期（用于“一天最多添加一个”限制）
  allowMultiplePerDay?: boolean; // 是否允许一天添加多条
}

// 例外规则系统类型定义
export enum ExceptionRuleType {
  PAUSE_ONLY = 'pause_only',
  EARLY_COMPLETION_ONLY = 'early_completion_only'
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

export interface RuleUsageStats {
  ruleId: string;
  totalUsage: number;
  pauseUsage: number;
  earlyCompletionUsage: number;
  lastUsedAt?: Date;
  averageTaskElapsedTime: number;
  mostUsedWithChains: Array<{ chainId: string; chainName: string; count: number }>;
}

export interface OverallUsageStats {
  totalRules: number;
  activeRules: number;
  totalUsage: number;
  pauseUsage: number;
  earlyCompletionUsage: number;
  mostUsedRules: Array<{ ruleId: string; ruleName: string; count: number }>;
}

export interface ExceptionRuleStorage {
  rules: ExceptionRule[];
  usageRecords: RuleUsageRecord[];
  lastSyncAt?: Date;
}

// 例外规则错误类型
export enum ExceptionRuleError {
  // 现有错误类型
  RULE_NOT_FOUND = 'RULE_NOT_FOUND',
  DUPLICATE_RULE_NAME = 'DUPLICATE_RULE_NAME',
  INVALID_RULE_TYPE = 'INVALID_RULE_TYPE',
  RULE_TYPE_MISMATCH = 'RULE_TYPE_MISMATCH',
  STORAGE_ERROR = 'STORAGE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // 新增错误类型
  DATA_INTEGRITY_ERROR = 'DATA_INTEGRITY_ERROR',
  TEMPORARY_ID_CONFLICT = 'TEMPORARY_ID_CONFLICT',
  RULE_STATE_INCONSISTENT = 'RULE_STATE_INCONSISTENT',
  RECOVERY_FAILED = 'RECOVERY_FAILED',
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

export class ExceptionRuleException extends Error {
  constructor(
    public type: ExceptionRuleError,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ExceptionRuleException';
  }
}

// 增强的异常类
export class EnhancedExceptionRuleException extends ExceptionRuleException {
  constructor(
    type: ExceptionRuleError,
    message: string,
    public context?: any,
    public recoverable?: boolean,
    public suggestedActions?: string[],
    public severity?: 'low' | 'medium' | 'high' | 'critical',
    public userMessage?: string,
    public technicalDetails?: any
  ) {
    super(type, message, context);
    this.name = 'EnhancedExceptionRuleException';
    this.recoverable = recoverable ?? true;
    this.severity = severity ?? 'medium';
    this.userMessage = userMessage ?? message;
  }

  /**
   * 创建用户友好的错误实例
   */
  static createUserFriendly(
    type: ExceptionRuleError,
    userMessage: string,
    technicalMessage?: string,
    context?: any
  ): EnhancedExceptionRuleException {
    return new EnhancedExceptionRuleException(
      type,
      technicalMessage || userMessage,
      context,
      true,
      [],
      'medium',
      userMessage,
      { technicalMessage }
    );
  }

  /**
   * 创建关键错误实例
   */
  static createCritical(
    type: ExceptionRuleError,
    message: string,
    context?: any
  ): EnhancedExceptionRuleException {
    return new EnhancedExceptionRuleException(
      type,
      message,
      context,
      false,
      ['联系技术支持'],
      'critical',
      '系统遇到严重错误，请联系技术支持',
      { originalMessage: message }
    );
  }

  /**
   * 创建可恢复的错误实例
   */
  static createRecoverable(
    type: ExceptionRuleError,
    message: string,
    suggestedActions: string[],
    context?: any
  ): EnhancedExceptionRuleException {
    return new EnhancedExceptionRuleException(
      type,
      message,
      context,
      true,
      suggestedActions,
      'medium',
      message
    );
  }

  /**
   * 添加恢复建议
   */
  addSuggestedAction(action: string): this {
    if (!this.suggestedActions) {
      this.suggestedActions = [];
    }
    this.suggestedActions.push(action);
    return this;
  }

  /**
   * 设置严重程度
   */
  setSeverity(severity: 'low' | 'medium' | 'high' | 'critical'): this {
    this.severity = severity;
    return this;
  }

  /**
   * 设置用户消息
   */
  setUserMessage(message: string): this {
    this.userMessage = message;
    return this;
  }

  /**
   * 检查是否可恢复
   */
  isRecoverable(): boolean {
    return this.recoverable === true;
  }

  /**
   * 检查是否为关键错误
   */
  isCritical(): boolean {
    return this.severity === 'critical';
  }

  /**
   * 获取错误分类
   */
  getCategory(): 'user_error' | 'system_error' | 'data_error' | 'network_error' {
    switch (this.type) {
      case ExceptionRuleError.VALIDATION_ERROR:
      case ExceptionRuleError.DUPLICATE_RULE_NAME:
      case ExceptionRuleError.RULE_TYPE_MISMATCH:
        return 'user_error';
      
      case ExceptionRuleError.STORAGE_ERROR:
      case ExceptionRuleError.OPERATION_TIMEOUT:
      case ExceptionRuleError.CONCURRENT_MODIFICATION:
        return 'system_error';
      
      case ExceptionRuleError.DATA_INTEGRITY_ERROR:
      case ExceptionRuleError.RULE_STATE_INCONSISTENT:
      case ExceptionRuleError.TEMPORARY_ID_CONFLICT:
        return 'data_error';
      
      case ExceptionRuleError.NETWORK_ERROR:
        return 'network_error';
      
      default:
        return 'system_error';
    }
  }

  /**
   * 转换为JSON格式
   */
  toJSON(): any {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      userMessage: this.userMessage,
      severity: this.severity,
      recoverable: this.recoverable,
      suggestedActions: this.suggestedActions,
      context: this.context,
      technicalDetails: this.technicalDetails,
      category: this.getCategory(),
      timestamp: new Date().toISOString(),
      stack: this.stack
    };
  }

  /**
   * 从JSON创建实例
   */
  static fromJSON(data: any): EnhancedExceptionRuleException {
    const error = new EnhancedExceptionRuleException(
      data.type,
      data.message,
      data.context,
      data.recoverable,
      data.suggestedActions,
      data.severity,
      data.userMessage,
      data.technicalDetails
    );
    
    if (data.stack) {
      error.stack = data.stack;
    }
    
    return error;
  }
}

export type ViewState = 'dashboard' | 'editor' | 'focus' | 'detail' | 'group' | 'rsip' | 'taskgroup-editor';

export interface AppState {
  chains: Chain[];
  scheduledSessions: ScheduledSession[];
  activeSession: ActiveSession | null;
  currentView: ViewState;
  editingChain: Chain | null;
  viewingChainId: string | null;
  completionHistory: CompletionHistory[];
  // RSIP
  rsipNodes: RSIPNode[];
  rsipMeta: RSIPMeta;
  // 任务用时统计
  taskTimeStats: TaskTimeStats[];
  // 例外规则系统
  exceptionRules: ExceptionRule[];
  ruleUsageRecords: RuleUsageRecord[];
}