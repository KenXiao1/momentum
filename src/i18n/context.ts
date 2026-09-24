import { createContext } from 'react';
import type { Language } from './translations';
import type { Translator } from './translate';

export interface I18nContextValue {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  t: Translator;
}

export const I18nContext = createContext<I18nContextValue | null>(null);
