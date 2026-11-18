import { LOCAL_STORAGE_KEYS } from './keys';
import type { AutoResumeData } from './types';

export function getAutoResume(): AutoResumeData | null {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.AUTO_RESUME);
    if (!stored) return null;
    return JSON.parse(stored) as AutoResumeData;
  } catch {
    return null;
  }
}

export function setAutoResume(data: AutoResumeData): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEYS.AUTO_RESUME, JSON.stringify(data));
  } catch {
    // best-effort: a lost auto-resume flag only means a paused task must be resumed by hand
  }
}

export function clearAutoResume(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.AUTO_RESUME);
  } catch {
    // best-effort: a lost auto-resume flag only means a paused task must be resumed by hand
  }
}
