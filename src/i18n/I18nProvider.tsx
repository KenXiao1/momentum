import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Language } from './translations';
import { I18nContext, type I18nContextValue } from './context';
import { createTranslator } from './translate';
import { localPreferences } from '../utils/localPreferences';

const detectBrowserLanguage = (): Language => {
  if (typeof navigator === 'undefined') return 'en';

  const browserLanguages: readonly string[] = Array.isArray(navigator.languages)
    ? navigator.languages
    : [];
  const candidates: readonly string[] =
    browserLanguages.length > 0 ? browserLanguages : [navigator.language];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    if (candidate.toLowerCase().startsWith('zh')) return 'zh';
  }

  return 'en';
};

const getLocale = (language: Language): string => {
  return language === 'zh' ? 'zh-CN' : 'en-US';
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof localStorage === 'undefined') return detectBrowserLanguage();

    const stored = localPreferences.getLanguage();
    if (stored) return stored;
    return detectBrowserLanguage();
  });

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    localPreferences.setLanguage(next);
  }, []);

  const locale = useMemo(() => getLocale(language), [language]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useMemo(() => createTranslator(language), [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      locale,
      setLanguage,
      t,
    }),
    [language, locale, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
