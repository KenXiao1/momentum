import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentLanguage, t } from '../runtimeI18n';

const originalLanguages = Object.getOwnPropertyDescriptor(
  navigator,
  'languages',
);
const originalLanguage = Object.getOwnPropertyDescriptor(navigator, 'language');

function browserLanguages(languages: string[], language = 'en-US') {
  Object.defineProperty(navigator, 'languages', {
    configurable: true,
    value: languages,
  });
  Object.defineProperty(navigator, 'language', {
    configurable: true,
    value: language,
  });
}

describe('runtimeI18n', () => {
  beforeEach(() => localStorage.removeItem('language'));
  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalLanguages)
      Object.defineProperty(navigator, 'languages', originalLanguages);
    else Reflect.deleteProperty(navigator, 'languages');
    if (originalLanguage)
      Object.defineProperty(navigator, 'language', originalLanguage);
    else Reflect.deleteProperty(navigator, 'language');
  });

  it('uses persisted language before browser detection', () => {
    browserLanguages(['zh-CN']);
    localStorage.setItem('language', 'en');
    expect(getCurrentLanguage()).toBe('en');
    expect(t('common.back')).toBe('Back');
    localStorage.setItem('language', 'zh');
    expect(t('common.back')).toBe('返回');
  });

  it('detects Chinese across browser candidates and ignores invalid saved values', () => {
    browserLanguages(['en-US', 'zh-TW']);
    localStorage.setItem('language', 'unsupported');
    expect(getCurrentLanguage()).toBe('zh');
    expect(t('common.back')).toBe('返回');
  });

  it('falls back to navigator.language and then English without browser support', () => {
    browserLanguages([], 'zh-CN');
    expect(getCurrentLanguage()).toBe('zh');
    browserLanguages(['fr-FR']);
    expect(getCurrentLanguage()).toBe('en');
    vi.stubGlobal('navigator', undefined);
    expect(getCurrentLanguage()).toBe('en');
  });

  it('allows explicit language and performs the same interpolation as the provider', () => {
    localStorage.setItem('language', 'zh');
    expect(t('common.back', undefined, 'en')).toBe('Back');
    expect(
      t(
        'auxiliaryJudgment.chainAuxiliaryDurationMin',
        { chainAuxiliaryDuration: 12 },
        'en',
      ),
    ).toBe('12 min');
    expect(getCurrentLanguage()).toBe('zh');
  });
});
