import { LOCAL_STORAGE_KEYS } from './keys';

export function getNotificationsEnabled(): boolean | null {
  try {
    const stored = localStorage.getItem(
      LOCAL_STORAGE_KEYS.NOTIFICATIONS_ENABLED,
    );
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return null;
  } catch {
    return null;
  }
}

export function setNotificationsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.NOTIFICATIONS_ENABLED,
      enabled.toString(),
    );
  } catch {
    // best-effort: a lost toggle falls back to the default notification setting
  }
}
