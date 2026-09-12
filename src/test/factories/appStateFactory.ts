import type { AppState } from '../../types';

export function createAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    chains: [],
    scheduledSessions: [],
    activeSession: null,
    completionHistory: [],
    rsipNodes: [],
    rsipMeta: {},
    taskTimeStats: [],
    exceptionRules: [],
    ruleUsageRecords: [],
    ...overrides,
  };
}
