import { LOCAL_STORAGE_KEYS } from './keys';
import type { Theme } from './types';

export function getTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.THEME);
    if (stored === 'light' || stored === 'dark') return stored;
    return null;
  } catch {
    return null;
  }
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEYS.THEME, theme);
  } catch {
    // best-effort: a lost choice falls back to the system theme
  }
}
