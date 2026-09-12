import type { Chain } from './chain';
import type { ExceptionRule, RuleUsageRecord } from './exception-rule';
import type {
  RSIPExecutionRecord,
  RSIPLibraryEntry,
  RSIPMeta,
  RSIPNode,
  RSIPNodeGroup,
  RSIPRunRecord,
} from './rsip';
import type { RSIPTaskLink } from './rsipIntegration';
import type {
  ActiveSession,
  CompletionHistory,
  ScheduledSession,
} from './session';
import type { TaskTimeStats } from './taskTimeStats';

export type ViewState =
  | 'dashboard'
  | 'editor'
  | 'focus'
  | 'detail'
  | 'group'
  | 'rsip'
  | 'taskgroup-editor';

export interface TaskRuntimeState {
  chains: Chain[];
  scheduledSessions: ScheduledSession[];
  activeSession: ActiveSession | null;
  completionHistory: CompletionHistory[];
  taskTimeStats: TaskTimeStats[];
}

export interface RsipState {
  rsipNodes: RSIPNode[];
  rsipMeta: RSIPMeta;
  rsipExecutionRecords: RSIPExecutionRecord[];
  rsipGroups: RSIPNodeGroup[];
  rsipPolicyLibrary: RSIPLibraryEntry[];
  rsipRunHistory: RSIPRunRecord[];
  rsipTaskLinks: RSIPTaskLink[];
}

export interface RuleState {
  // 例外规则系统
  exceptionRules: ExceptionRule[];
  ruleUsageRecords: RuleUsageRecord[];
}

export interface AppState extends TaskRuntimeState, RsipState, RuleState {}
