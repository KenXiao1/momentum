// Maps an English UI string to the app's Chinese translation, so capture
// scripts can be written against the English e2e selectors while recording
// the Chinese interface.
import { translations } from '../../src/i18n/translations.ts';

const byEnglish = new Map();
for (const [key, en] of Object.entries(translations.en)) {
  if (!byEnglish.has(en)) byEnglish.set(en, []);
  byEnglish.get(en).push(key);
}

export function makeL(lang) {
  return (en, key) => {
    if (lang === 'en') return en;
    const k = key ?? byEnglish.get(en)?.[0];
    const zh = k ? translations.zh[k] : undefined;
    if (!zh) throw new Error(`No zh translation for "${en}"`);
    return zh;
  };
}
