import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const bridge = vi.hoisted(() => ({ invokeCommand: vi.fn(async () => null) }));
vi.mock('../../../utils/tauri-bridge', () => bridge);

/** Loads the hook as the desktop app or the browser would. */
async function load({ desktop }: { desktop: boolean }) {
  vi.resetModules();
  if (desktop) Object.assign(window, { __TAURI_INTERNALS__: {} });
  const { useTrayMenuLanguage } = await import('../tauri-tray');
  const { I18nProvider } = await import('../../../i18n');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider>{children}</I18nProvider>
  );
  return { useTrayMenuLanguage, wrapper };
}

describe('useTrayMenuLanguage', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
    bridge.invokeCommand.mockClear();
  });

  it('sends the tray labels in the app language on desktop', async () => {
    localStorage.setItem('language', 'en');
    const { useTrayMenuLanguage, wrapper } = await load({ desktop: true });

    renderHook(() => useTrayMenuLanguage(), { wrapper });

    expect(bridge.invokeCommand).toHaveBeenCalledWith('set_tray_labels', {
      show: 'Show Momentum',
      quit: 'Quit',
    });
  });

  it('does nothing outside the desktop app', async () => {
    const { useTrayMenuLanguage, wrapper } = await load({ desktop: false });

    renderHook(() => useTrayMenuLanguage(), { wrapper });

    expect(bridge.invokeCommand).not.toHaveBeenCalled();
  });
});
