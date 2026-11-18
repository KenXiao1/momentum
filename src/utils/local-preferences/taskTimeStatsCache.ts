import { LOCAL_STORAGE_KEYS } from './keys';

export function getTaskTimeStats(): string | null {
  try {
    return localStorage.getItem(LOCAL_STORAGE_KEYS.TASK_TIME_STATS);
  } catch {
    return null;
  }
}

export function setTaskTimeStats(data: string): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEYS.TASK_TIME_STATS, data);
  } catch {
    // best-effort: these stats only feed duration hints and are not user data
  }
}
