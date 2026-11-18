import { LOCAL_STORAGE_KEYS } from './keys';
import type { Language } from './types';

export function getLanguage(): Language | null {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.LANGUAGE);
    if (stored === 'en' || stored === 'zh') return stored;
    return null;
  } catch {
    return null;
  }
}

export function setLanguage(language: Language): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEYS.LANGUAGE, language);
  } catch {
    // best-effort: a lost choice falls back to the browser language
  }
}
