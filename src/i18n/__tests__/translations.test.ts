import { describe, expect, it } from 'vitest';
import { translations } from '../translations';

describe('translations', () => {
  it('should define the same translation keys for english and chinese', () => {
    const enKeys = Object.keys(translations.en).sort();
    const zhKeys = Object.keys(translations.zh).sort();

    expect(zhKeys).toEqual(enKeys);
  });

  it('should include required language and settings labels', () => {
    expect(translations.en['language.english']).toBe('English');
    expect(translations.en['language.chinese']).toBe('Chinese');
    expect(translations.en['settings.title']).toBe('Personal Settings');
    expect(translations.en['settings.language.title']).toBe('Language');

    expect(translations.zh['language.english']).toEqual(expect.any(String));
    expect(translations.zh['language.chinese']).toEqual(expect.any(String));
    expect(translations.zh['settings.title']).toEqual(expect.any(String));
    expect(translations.zh['settings.language.title']).toEqual(
      expect.any(String),
    );
    expect(translations.zh['language.english'].trim().length).toBeGreaterThan(
      0,
    );
    expect(translations.zh['language.chinese'].trim().length).toBeGreaterThan(
      0,
    );
    expect(translations.zh['settings.title'].trim().length).toBeGreaterThan(0);
    expect(
      translations.zh['settings.language.title'].trim().length,
    ).toBeGreaterThan(0);
  });

  it('should not contain empty translation values', () => {
    for (const [key, value] of Object.entries(translations.en)) {
      expect(value.length, `en:${key}`).toBeGreaterThan(0);
    }

    for (const [key, value] of Object.entries(translations.zh)) {
      expect(value.length, `zh:${key}`).toBeGreaterThan(0);
    }
  });

  it('uses identical named placeholders in each language', () => {
    const names = (value: string) =>
      [
        ...new Set([...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1])),
      ].sort();
    for (const key of Object.keys(translations.en) as Array<
      keyof typeof translations.en
    >) {
      expect(names(translations.zh[key]), key).toEqual(
        names(translations.en[key]),
      );
    }
  });
});
