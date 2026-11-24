import { logger } from '../logger';
import { LOCAL_STORAGE_KEYS } from './keys';
import type { TimerPersistData } from './types';

export function getTimerState(sessionId: string): TimerPersistData | null {
  try {
    const key = `${LOCAL_STORAGE_KEYS.TIMER_PREFIX}${sessionId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored) as TimerPersistData;
  } catch {
    return null;
  }
}

export function setTimerState(sessionId: string, data: TimerPersistData): void {
  try {
    const key = `${LOCAL_STORAGE_KEYS.TIMER_PREFIX}${sessionId}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn(
      'LOCAL_PREFERENCES',
      'Failed to persist timer state',
      { sessionId },
      err,
    );
  }
}

export function clearTimerState(sessionId: string): void {
  try {
    const key = `${LOCAL_STORAGE_KEYS.TIMER_PREFIX}${sessionId}`;
    localStorage.removeItem(key);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn(
      'LOCAL_PREFERENCES',
      'Failed to remove timer state',
      { sessionId },
      err,
    );
  }
}

export function getAllTimerKeys(): string[] {
  try {
    const keys: string[] = [];
    const storage = localStorage as unknown;
    const storageLike = storage as Partial<Storage>;

    if (
      typeof storageLike.length === 'number' &&
      typeof storageLike.key === 'function'
    ) {
      for (let i = 0; i < storageLike.length; i++) {
        const key = storageLike.key(i);
        if (key && key.startsWith(LOCAL_STORAGE_KEYS.TIMER_PREFIX)) {
          keys.push(key);
        }
      }
    } else if (storage && typeof storage === 'object') {
      const allKeys = Object.keys(storage);
      keys.push(
        ...allKeys.filter((key) =>
          key.startsWith(LOCAL_STORAGE_KEYS.TIMER_PREFIX),
        ),
      );
    }

    return keys;
  } catch {
    return [];
  }
}

export function cleanupExpiredTimers(
  maxAgeMs: number = 24 * 60 * 60 * 1000,
): void {
  try {
    const keys = getAllTimerKeys();
    const now = Date.now();

    keys.forEach((key) => {
      try {
        const dataStr = localStorage.getItem(key);
        if (dataStr) {
          const data = JSON.parse(dataStr) as TimerPersistData;
          if (now - data.timestamp > maxAgeMs) {
            localStorage.removeItem(key);
          }
        }
      } catch {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn(
      'LOCAL_PREFERENCES',
      'Failed to cleanup expired timers',
      undefined,
      err,
    );
  }
}
