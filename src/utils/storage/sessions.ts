import { recoverOperationJournal } from './operationJournal';
import type { ActiveSession, ScheduledSession } from '../../types';
import {
  decodeActiveSession,
  decodeScheduledSession,
  type SerializedActiveSession,
  type SerializedScheduledSession,
} from '../../serialization';
import { completedSessionKey, STORAGE_KEYS } from './keys';

export function getScheduledSessions(): ScheduledSession[] {
  recoverOperationJournal();
  const data = localStorage.getItem(STORAGE_KEYS.SCHEDULED_SESSIONS);
  if (!data) return [];

  return (JSON.parse(data) as SerializedScheduledSession[]).map(
    decodeScheduledSession,
  );
}

export function saveScheduledSessions(sessions: ScheduledSession[]): void {
  recoverOperationJournal();
  localStorage.setItem(
    STORAGE_KEYS.SCHEDULED_SESSIONS,
    JSON.stringify(sessions),
  );
}

export function setScheduledSession(session: ScheduledSession): void {
  recoverOperationJournal();
  const sessions = getScheduledSessions();
  const nextSessions = sessions.filter(
    (item) => item.chainId !== session.chainId,
  );
  nextSessions.push(session);
  saveScheduledSessions(nextSessions);
}

export function removeScheduledSession(chainId: string): void {
  recoverOperationJournal();
  const sessions = getScheduledSessions();
  saveScheduledSessions(
    sessions.filter((session) => session.chainId !== chainId),
  );
}

export function getActiveSession(): ActiveSession | null {
  recoverOperationJournal();
  const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
  if (!data) return null;

  return decodeActiveSession(JSON.parse(data) as SerializedActiveSession);
}

export function saveActiveSession(session: ActiveSession | null): void {
  recoverOperationJournal();
  if (session) {
    if (localStorage.getItem(completedSessionKey(session))) {
      throw new Error(
        'This session is already completed. Reload before starting another task.',
      );
    }
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
  }
}
