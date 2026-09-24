import type { Language, TranslationKey } from '../i18n/translations';
import { translate, type TranslationArgs } from '../i18n/translate';
import { localPreferences } from './localPreferences';

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

export const getCurrentLanguage = (): Language => {
  const stored = localPreferences.getLanguage();
  if (stored) return stored;
  return detectBrowserLanguage();
};

export function t<Key extends TranslationKey>(
  key: Key,
  ...args: [...TranslationArgs<NoInfer<Key>>, language?: Language]
): string {
  const requestedLanguage = args[1];
  const language =
    requestedLanguage === 'zh'
      ? 'zh'
      : requestedLanguage === 'en'
        ? 'en'
        : getCurrentLanguage();
  return translate(
    language,
    key,
    ...([args[0]] as TranslationArgs<NoInfer<Key>>),
  );
}
