import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../I18nProvider';
import { useI18n } from '../useI18n';

function createWrapper() {
  return ({ children }: { children: React.ReactNode }) => (
    <I18nProvider>{children}</I18nProvider>
  );
}

describe('I18nProvider', () => {
  it('detects zh from browser language when no persisted language exists', async () => {
    localStorage.removeItem('language');
    Object.defineProperty(navigator, 'languages', {
      configurable: true,
      value: ['zh-CN', 'en-US'],
    });

    const { result } = renderHook(() => useI18n(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.language).toBe('zh');
      expect(result.current.locale).toBe('zh-CN');
      expect(document.documentElement.lang).toBe('zh-CN');
    });
  });

  it('supports fallback interpolation and updates persisted language', async () => {
    localStorage.setItem('language', 'en');
    const { result } = renderHook(() => useI18n(), {
      wrapper: createWrapper(),
    });

    // @ts-expect-error Exercise the runtime fallback for external, unknown keys.
    expect(result.current.t('missing {name}', { name: 'Neo' })).toBe(
      'missing Neo',
    );
    expect(result.current.t('settings.title')).toBe('Personal Settings');

    act(() => {
      result.current.setLanguage('zh');
    });

    await waitFor(() => {
      expect(result.current.language).toBe('zh');
      expect(document.documentElement.lang).toBe('zh-CN');
      expect(localStorage.getItem('language')).toBe('zh');
    });
  });

  it('normalizes mojibake-style zh inline translations when language is zh', () => {
    localStorage.setItem('language', 'zh');
    const { result } = renderHook(() => useI18n(), {
      wrapper: createWrapper(),
    });

    expect(result.current.tr('ä½ å¥½', 'Hello')).toBe('你好');
    expect(result.current.tr('你好', 'Hello')).toBe('你好');
  });
});
