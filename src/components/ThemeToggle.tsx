import React, { useLayoutEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useI18n } from '../i18n';
import { localPreferences } from '../utils/localPreferences';

type Theme = 'light' | 'dark';

export const ThemeToggle: React.FC = () => {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localPreferences.getTheme();
      if (stored) return stored;

      // Migrate old `system` value (or unset/invalid) to an explicit theme.
      const prefersDark =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    }
    return 'light';
  });

  useLayoutEffect(() => {
    const root = window.document.documentElement;
    const isDarkTheme = theme === 'dark';
    root.classList.toggle('dark', isDarkTheme);
    root.style.colorScheme = isDarkTheme ? 'dark' : 'light';
    localPreferences.setTheme(theme);
  }, [theme]);

  const cycleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <button
      onClick={cycleTheme}
      className="rounded-xl p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
      aria-label={t('themeToggle.toggleTheme')}
      title={t('themeToggle.toggleTheme')}
    >
      {theme === 'light' && <Sun size={18} strokeWidth={2} />}
      {theme === 'dark' && <Moon size={18} strokeWidth={2} />}
    </button>
  );
};
