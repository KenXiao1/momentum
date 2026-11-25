import { LOCAL_STORAGE_KEYS } from './keys';

/** Error reports are sent only after the user turns them on. */
export function getErrorReportingEnabled(): boolean {
  try {
    return (
      localStorage.getItem(LOCAL_STORAGE_KEYS.ERROR_REPORTING_ENABLED) ===
      'true'
    );
  } catch {
    return false;
  }
}

export function setErrorReportingEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.ERROR_REPORTING_ENABLED,
      String(enabled),
    );
  } catch {
    // best-effort: the choice still applies until the app reloads
  }
}
