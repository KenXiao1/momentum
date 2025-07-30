export interface ExceptionRule {
  id: string;
  name: string;
  editable: boolean;
  condition?: string; // 改为可选属性
}

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

export type ViewState = 'dashboard' | 'editor' | 'focus' | 'detail';

export interface AppState {
  chains: Chain[];
  scheduledSessions: ScheduledSession[];
  activeSession: ActiveSession | null;
  currentView: ViewState;
  editingChain: Chain | null;
  viewingChainId: string | null;
  completionHistory: CompletionHistory[];
}
