import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  createTranslator,
  translate,
  type TranslationArgs,
  type TranslationValue,
} from '../translate';
import { translations } from '../translations';

describe('translate', () => {
  it('shares language selection between pure and bound translators', () => {
    expect(translate('en', 'common.back')).toBe('Back');
    expect(translate('zh', 'common.back')).toBe('返回');
    expect(createTranslator('en')('common.back')).toBe('Back');
    expect(createTranslator('zh')('common.back')).toBe('返回');
  });

  it('interpolates named values without translating user content', () => {
    const key = 'ruleSelectionDialog.ruleNameCleanNameAlreadyExists';
    const name = '中文 Rule $& {other}';
    expect(translate('en', key, { cleanName: name })).toBe(
      `Rule name "${name}" already exists`,
    );
    expect(translate('zh', key, { cleanName: name })).toContain(name);
  });

  it('preserves falsy values and renders absent values as empty text', () => {
    const key = 'auxiliaryJudgment.chainAuxiliaryDurationMin';
    expect(translate('en', key, { chainAuxiliaryDuration: 0 })).toBe('0 min');
    expect(translate('en', key, { chainAuxiliaryDuration: false })).toBe(
      'false min',
    );
    expect(translate('en', key, { chainAuxiliaryDuration: null })).toBe(' min');
    expect(translate('en', key, { chainAuxiliaryDuration: undefined })).toBe(
      ' min',
    );
  });

  it('falls back to English if a translated entry is absent at runtime', () => {
    const original = translations.zh['common.back'];
    Object.defineProperty(translations.zh, 'common.back', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    try {
      expect(translate('zh', 'common.back')).toBe('Back');
    } finally {
      translations.zh['common.back'] = original;
    }
  });

  it('retains unknown external keys as a final runtime fallback', () => {
    // @ts-expect-error Runtime data can contain an unknown key despite the typed API.
    expect(translate('zh', 'External {name}: {name}', { name: 'Neo' })).toBe(
      'External Neo: Neo',
    );
  });

  it('infers required parameter names from the English dictionary', () => {
    expectTypeOf<TranslationArgs<'common.back'>>().toEqualTypeOf<
      [params?: undefined]
    >();
    expectTypeOf<
      TranslationArgs<'auxiliaryJudgment.chainAuxiliaryDurationMin'>
    >().toEqualTypeOf<[params: { chainAuxiliaryDuration: TranslationValue }]>();
    const translator = createTranslator('en');
    // @ts-expect-error Existing keys with placeholders require their parameters.
    translator('auxiliaryJudgment.chainAuxiliaryDurationMin');
    // @ts-expect-error Misspelled parameter names must not silently omit content.
    translator('auxiliaryJudgment.chainAuxiliaryDurationMin', { duration: 3 });
    // @ts-expect-error Static translations do not accept unrelated parameters.
    translator('common.back', { name: 'unused' });
    expect(
      translator('auxiliaryJudgment.chainAuxiliaryDurationMin', {
        chainAuxiliaryDuration: 3,
      }),
    ).toBe('3 min');
  });
});
