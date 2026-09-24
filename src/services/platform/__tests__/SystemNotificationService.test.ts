import { createTranslator } from '../../../i18n/translate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type PermissionState = 'default' | 'granted' | 'denied';

interface LoadServiceOptions {
  supported?: boolean;
  placement?: 'topbar' | 'settings' | 'hidden';
  permission?: PermissionState;
  requestPermissionResult?: PermissionState;
  storedEnabled?: boolean | null;
}

async function loadService(options: LoadServiceOptions = {}) {
  const {
    supported = true,
    placement = 'topbar',
    permission = 'default',
    requestPermissionResult = 'granted',
    storedEnabled = false,
  } = options;

  vi.resetModules();

  const showMock = vi.fn(async () => undefined);
  const requestPermissionMock = vi.fn(async () => requestPermissionResult);
  const getPermissionStateMock = vi.fn(async () => permission);
  const setNotificationsEnabledMock = vi.fn();
  const getNotificationsEnabledMock = vi.fn(() => storedEnabled);
  const loggerInfo = vi.fn();
  const loggerWarn = vi.fn();
  const loggerError = vi.fn();

  const center = {
    getCapabilities: vi.fn(async () => ({
      notification: {
        supported,
        canRequestPermission: supported,
        canShow: supported,
        togglePlacement: supported ? placement : 'hidden',
      },
      window: {
        canSetFullscreen: true,
        canMinimizeToTray: true,
        canFocus: true,
      },
      file: {
        canSaveFile: true,
        canOpenFile: true,
      },
      haptics: {
        canImpact: true,
        canNotification: true,
        canSelectionChanged: true,
      },
    })),
    notification: {
      getPermissionState: getPermissionStateMock,
      requestPermission: requestPermissionMock,
      show: showMock,
    },
  };

  vi.doMock('../../../utils/platform-capabilities/center', () => ({
    getPlatformCapabilityCenter: () => center,
  }));
  vi.doMock('../../../utils/localPreferences', () => ({
    localPreferences: {
      getNotificationsEnabled: getNotificationsEnabledMock,
      setNotificationsEnabled: setNotificationsEnabledMock,
    },
  }));
  vi.doMock('../../../utils/runtimeI18n', () => ({
    getCurrentLanguage: vi.fn(() => 'en'),
    t: createTranslator('en'),
  }));
  vi.doMock('../../../utils/random', () => ({
    randomId: vi.fn((prefix: string) => `${prefix}-test-id`),
  }));
  vi.doMock('../../../utils/logger', () => ({
    logger: {
      info: loggerInfo,
      warn: loggerWarn,
      error: loggerError,
      debug: vi.fn(),
    },
  }));

  const mod = await import('../SystemNotificationService');
  return {
    service: mod.systemNotificationService,
    showMock,
    requestPermissionMock,
    getPermissionStateMock,
    setNotificationsEnabledMock,
    getNotificationsEnabledMock,
    loggerInfo,
    loggerWarn,
    loggerError,
  };
}

describe('SystemNotificationService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('initializes from capability center and stored preference', async () => {
    const loaded = await loadService({
      supported: true,
      permission: 'granted',
      storedEnabled: true,
      placement: 'topbar',
    });

    const state = await loaded.service.init();

    expect(state.supported).toBe(true);
    expect(state.permission).toBe('granted');
    expect(state.enabled).toBe(true);
    expect(state.togglePlacement).toBe('topbar');
  });

  it('enable requests permission and persists enabled state', async () => {
    const loaded = await loadService({
      permission: 'default',
      requestPermissionResult: 'granted',
      storedEnabled: false,
    });

    await loaded.service.init();
    await expect(loaded.service.enable()).resolves.toBe(true);

    expect(loaded.requestPermissionMock).toHaveBeenCalledTimes(1);
    expect(loaded.setNotificationsEnabledMock).toHaveBeenCalledWith(true);
    expect(loaded.service.isEnabled()).toBe(true);
  });

  it('disable persists disabled state', async () => {
    const loaded = await loadService({
      permission: 'granted',
      storedEnabled: true,
    });
    await loaded.service.init();

    loaded.service.disable();

    expect(loaded.setNotificationsEnabledMock).toHaveBeenCalledWith(false);
    expect(loaded.service.isEnabled()).toBe(false);
  });

  it('requestPermission supports feature source without forcing enable', async () => {
    const loaded = await loadService({
      permission: 'default',
      requestPermissionResult: 'granted',
      storedEnabled: false,
    });
    await loaded.service.init();

    await expect(loaded.service.requestPermission('feature')).resolves.toBe(
      true,
    );

    expect(loaded.requestPermissionMock).toHaveBeenCalledTimes(1);
    expect(loaded.service.isEnabled()).toBe(false);
  });

  it('sends notifications only when enabled and granted', async () => {
    const loaded = await loadService({
      permission: 'granted',
      storedEnabled: true,
    });
    await loaded.service.init();

    await loaded.service.notifyTaskCompleted('Alpha', 3);

    expect(loaded.showMock).toHaveBeenCalledTimes(1);
  });

  it('does not send notification when unsupported', async () => {
    const loaded = await loadService({
      supported: false,
      permission: 'default',
      storedEnabled: true,
      placement: 'hidden',
    });
    await loaded.service.init();

    await loaded.service.notifyTaskFailed('Alpha', 'timeout');

    expect(loaded.showMock).not.toHaveBeenCalled();
  });
});
