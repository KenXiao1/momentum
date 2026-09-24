import { vi, type Mock } from 'vitest';
import { createTranslator, type Translator } from '../i18n/translate';
import type { Language } from '../i18n/translations';

/** Preserve the generic key/parameter contract that Vitest's Mock type erases. */
export function createTranslationMock(
  language: Language,
): Mock<Translator> & Translator {
  return vi.fn(createTranslator(language)) as Mock<Translator> & Translator;
}
