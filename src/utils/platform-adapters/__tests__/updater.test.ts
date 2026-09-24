import { createTranslationMock } from '../../../test/i18n';
import { createTranslator } from '../../../i18n/translate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface LoadUpdaterOptions {
  isTauriDesktop: boolean;
  isTauriMobile: boolean;
}

async function loadUpdater(options: LoadUpdaterOptions) {
  const { isTauriDesktop, isTauriMobile } = options;

  vi.resetModules();

  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  const toastInfo = vi.fn();
  const update = {
    version: '0.3.2',
    downloadAndInstall: vi.fn(async () => undefined),
  };
  const check = vi.fn(async () => update);
  const relaunch = vi.fn(async () => undefined);

  vi.doMock('../../platform', () => ({
    isTauriDesktop,
    isTauriMobile,
  }));
  vi.doMock('../../logger', () => ({ logger }));
  vi.doMock('../../toast', () => ({
    toast: {
      info: toastInfo,
      warning: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
    },
  }));
  vi.doMock('../../runtimeI18n', () => ({
    getCurrentLanguage: vi.fn(() => 'en'),
    t: createTranslationMock('en'),
  }));
  vi.doMock('@tauri-apps/plugin-updater', () => ({
    check,
  }));
  vi.doMock('@tauri-apps/plugin-process', () => ({
    relaunch,
  }));
  const updaterModule = await import('../updater');
  return {
    checkForUpdates: updaterModule.checkForUpdates,
    update,
    check,
    relaunch,
    toastInfo,
    logger,
  };
}

describe('updater platform adapter', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('checks and installs updates on tauri desktop', async () => {
    const loaded = await loadUpdater({
      isTauriDesktop: true,
      isTauriMobile: false,
    });

    await loaded.checkForUpdates();

    expect(loaded.check).toHaveBeenCalledTimes(1);
    expect(loaded.update.downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(loaded.relaunch).toHaveBeenCalledTimes(1);
  });

  it('does not auto-update on tauri mobile', async () => {
    const loaded = await loadUpdater({
      isTauriDesktop: false,
      isTauriMobile: true,
    });

    await loaded.checkForUpdates();

    expect(loaded.check).not.toHaveBeenCalled();
    expect(loaded.update.downloadAndInstall).not.toHaveBeenCalled();
    expect(loaded.relaunch).not.toHaveBeenCalled();
    expect(loaded.toastInfo).not.toHaveBeenCalled();
  });
});
