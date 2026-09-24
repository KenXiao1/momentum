import { createTranslator } from '../translate';
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../I18nProvider';
import { I18nContext, type I18nContextValue } from '../context';
import { useI18n } from '../useI18n';

describe('useI18n', () => {
  it('should return current context value when a custom provider is used', () => {
    const value: I18nContextValue = {
      language: 'en',
      locale: 'en-US',
      setLanguage: vi.fn(),
      t: createTranslator('en'),
    };

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(I18nContext.Provider, { value }, children);

    const { result } = renderHook(() => useI18n(), { wrapper });

    expect(result.current).toBe(value);
  });

  it('should expose translation helpers when wrapped with I18nProvider', () => {
    localStorage.setItem('language', 'en');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(I18nProvider, null, children);

    const { result } = renderHook(() => useI18n(), { wrapper });

    expect(result.current.language).toBe('en');
    expect(result.current.locale).toBe('en-US');
    expect(result.current.t('settings.title')).toBe('Personal Settings');
    expect(result.current.t('common.back')).toBe('Back');

    act(() => {
      result.current.setLanguage('zh');
    });

    expect(result.current.language).toBe('zh');
    expect(result.current.locale).toBe('zh-CN');
    expect(result.current.t('common.back')).toBe('返回');
  });
});
