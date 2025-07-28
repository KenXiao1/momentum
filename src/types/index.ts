export interface Chain {
  id: string;
  name: string;
  trigger: string;
  duration: number; // in minutes
  description: string;
  currentStreak: number;
  auxiliaryStreak: number; // 辅助链连续成功记录
  totalCompletions: number;
  totalFailures: number;
  auxiliaryFailures: number; // 辅助链失败次数
  exceptions: ExceptionRule[];
  auxiliaryExceptions: ExceptionRule[]; // 辅助链例外规则
  // 辅助链设置
  auxiliarySignal: string; // 预约信号，如"打响指"、"设置闹钟"
  auxiliaryDuration: number; // 预约时长（分钟）
  auxiliaryCompletionTrigger: string; // 预约完成条件，通常与主链trigger相同
  createdAt: Date;
  lastCompletedAt?: Date;
}

export interface ExceptionRule {
  id: string;
  name: string;
  condition: string;
  editable: boolean;
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
  learnedDuration?: number; // 单位：分钟
  plannedDuration?: number; // 计划时长（分钟）
  extraDuration?: number; // 额外时长（分钟）
}

export interface CompletionHistory {
  chainId: string;
  completedAt: Date;
  plannedDuration: number; // 计划时长（分钟）
  extraDuration: number; // 额外时长（分钟）
  actualDuration: number; // 实际学习时长（分钟）
  wasSuccessful: boolean;
  reasonForFailure?: string;
}

export type ViewState = 'dashboard' | 'editor' | 'focus' | 'detail';

export interface SerializedChain {
  id: string;
  name: string;
  trigger: string;
  duration: number;
  description: string;
  currentStreak: number;
  auxiliaryStreak: number;
  totalCompletions: number;
  totalFailures: number;
  auxiliaryFailures: number;
  exceptions: Array<{
    id: string;
    name: string;
    condition: string;
    editable: boolean;
  }>;
  auxiliaryExceptions: Array<{
    id: string;
    name: string;
    condition: string;
    editable: boolean;
  }>;
  auxiliarySignal: string;
  auxiliaryDuration: number;
  auxiliaryCompletionTrigger: string;
  createdAt: string;
  lastCompletedAt?: string;
}

export interface SerializedSession {
  chainId: string;
  scheduledAt: string;
  expiresAt: string;
  auxiliarySignal: string;
}

export interface SerializedActiveSession {
  chainId: string;
  startedAt: string;
  duration: number;
  isPaused: boolean;
  pausedAt?: string;
  totalPausedTime: number;
}

export interface SerializedCompletionHistory {
  chainId: string;
  completedAt: string;
  duration: number;
  wasSuccessful: boolean;
  reasonForFailure?: string;
}

export interface AppState {
  chains: Chain[];
  scheduledSessions: ScheduledSession[];
  activeSession: ActiveSession | null;
  currentView: ViewState;
  editingChain: Chain | null;
  viewingChainId: string | null;
  completionHistory: CompletionHistory[];
}
