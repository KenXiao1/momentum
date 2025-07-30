import { Chain, ScheduledSession, ActiveSession, CompletionHistory } from '../types';

const STORAGE_KEYS = {
  CHAINS: 'momentum_chains',
  SCHEDULED_SESSIONS: 'momentum_scheduled_sessions',
  ACTIVE_SESSION: 'momentum_active_session',
  COMPLETION_HISTORY: 'momentum_completion_history',
};

export const storage = {
  getChains: (): Chain[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CHAINS);
    if (!data) return [];
    return JSON.parse(data).map((chain: any) => ({
      ...chain,
      auxiliaryStreak: chain.auxiliaryStreak || 0,
      auxiliaryFailures: chain.auxiliaryFailures || 0,
      auxiliaryExceptions: chain.auxiliaryExceptions || [],
      createdAt: new Date(chain.createdAt),
      lastCompletedAt: chain.lastCompletedAt ? new Date(chain.lastCompletedAt) : undefined,
    }));
  },

  saveChains: (chains: Chain[]): void => {
    localStorage.setItem(STORAGE_KEYS.CHAINS, JSON.stringify(chains));
  },

  getScheduledSessions: (): ScheduledSession[] => {
    const data = localStorage.getItem(STORAGE_KEYS.SCHEDULED_SESSIONS);
    if (!data) return [];
    return JSON.parse(data).map((session: any) => ({
      ...session,
      auxiliarySignal: session.auxiliarySignal || '预约信号',
      scheduledAt: new Date(session.scheduledAt),
      expiresAt: new Date(session.expiresAt),
    }));
  },

  saveScheduledSessions: (sessions: ScheduledSession[]): void => {
    localStorage.setItem(STORAGE_KEYS.SCHEDULED_SESSIONS, JSON.stringify(sessions));
  },

  getActiveSession: (): ActiveSession | null => {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    if (!data) return null;
    const session = JSON.parse(data);
    return {
      ...session,
      startedAt: new Date(session.startedAt),
      pausedAt: session.pausedAt ? new Date(session.pausedAt) : undefined,
    };
  },

  saveActiveSession: (session: ActiveSession | null): void => {
    if (session) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    }
  },

  getCompletionHistory: (): CompletionHistory[] => {
    const data = localStorage.getItem(STORAGE_KEYS.COMPLETION_HISTORY);
    if (!data) return [];
    return JSON.parse(data).map((history: any) => ({
      ...history,
      completedAt: new Date(history.completedAt),
    }));
  },

  saveCompletionHistory: (history: CompletionHistory[]): void => {
    localStorage.setItem(STORAGE_KEYS.COMPLETION_HISTORY, JSON.stringify(history));
  },
};