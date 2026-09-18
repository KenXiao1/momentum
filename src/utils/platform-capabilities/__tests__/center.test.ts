import { afterEach, describe, expect, it, vi } from 'vitest';

type PermissionState = 'default' | 'granted' | 'denied';

interface LoadCenterOptions {
  isTauriMobile?: boolean;
  notificationSupported?: boolean;
  notificationPermission?: PermissionState;
  notificationRequestResult?: PermissionState;
  windowCapabilities?: {
    canSetFullscreen: boolean;
    canMinimizeToTray: boolean;
    canFocus: boolean;
  };
  fileCapabilities?: {
    canSaveFile: boolean;
    canOpenFile: boolean;
  };
  hapticsCapabilities?: {
    canImpact: boolean;
    canNotification: boolean;
    canSelectionChanged: boolean;
  };
}

async function loadCenter(options: LoadCenterOptions = {}) {
  const {
    isTauriMobile = false,
    notificationSupported = true,
    notificationPermission = 'default',
    notificationRequestResult = 'granted',
    windowCapabilities = {
      canSetFullscreen: true,
      canMinimizeToTray: true,
      canFocus: true,
    },
    fileCapabilities = {
      canSaveFile: true,
      canOpenFile: true,
    },
    hapticsCapabilities = {
      canImpact: true,
      canNotification: true,
      canSelectionChanged: true,
    },
  } = options;

  vi.resetModules();

  const loggerWarn = vi.fn();
  const loggerError = vi.fn();

  const notificationAdapter = {
    isSupported: vi.fn(() => notificationSupported),
    getCapabilities: vi.fn(() => ({
      canRequestPermission: notificationSupported,
      canShow: notificationSupported,
    })),
    getPermissionState: vi.fn(async () => notificationPermission),
    requestPermission: vi.fn(async () => notificationRequestResult),
    show: vi.fn(async () => undefined),
  };

  const windowAdapter = {
    getCapabilities: vi.fn(() => windowCapabilities),
    setFullscreen: vi.fn(async () => undefined),
    minimizeToTray: vi.fn(async () => undefined),
    focus: vi.fn(async () => undefined),
  };

  const fileAdapter = {
    getCapabilities: vi.fn(() => fileCapabilities),
    saveFile: vi.fn(async () => true),
    openFile: vi.fn(async (): Promise<string | null> => '{"ok":true}'),
  };

  const hapticsAdapter = {
    getCapabilities: vi.fn(() => hapticsCapabilities),
    impact: vi.fn(async () => undefined),
    notification: vi.fn(async () => undefined),
    selectionChanged: vi.fn(async () => undefined),
  };

  vi.doMock('../../platform', () => ({
    isTauriMobile,
  }));
  vi.doMock('../../logger', () => ({
    logger: {
      warn: loggerWarn,
      error: loggerError,
      info: vi.fn(),
      debug: vi.fn(),
    },
  }));
  vi.doMock('../../platform-adapters', () => ({
    getNotificationAdapter: vi.fn(async () => notificationAdapter),
    getWindowAdapter: vi.fn(async () => windowAdapter),
    getFileAdapter: vi.fn(async () => fileAdapter),
    getHapticsAdapter: vi.fn(async () => hapticsAdapter),
  }));

  const module = await import('../center');
  return {
    center: module.getPlatformCapabilityCenter(),
    notificationAdapter,
    windowAdapter,
    fileAdapter,
    hapticsAdapter,
    loggerWarn,
    loggerError,
  };
}

describe('platform capability center', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves topbar placement on non-mobile when notifications are supported', async () => {
    const loaded = await loadCenter({
      isTauriMobile: false,
      notificationSupported: true,
    });

    const capabilities = await loaded.center.getCapabilities();

    expect(capabilities.notification.supported).toBe(true);
    expect(capabilities.notification.togglePlacement).toBe('topbar');
  });

  it('resolves settings placement on tauri-mobile when notifications are supported', async () => {
    const loaded = await loadCenter({
      isTauriMobile: true,
      notificationSupported: true,
    });

    const capabilities = await loaded.center.getCapabilities();

    expect(capabilities.notification.togglePlacement).toBe('settings');
  });

  it('resolves hidden placement when notifications are unsupported', async () => {
    const loaded = await loadCenter({
      notificationSupported: false,
    });

    const capabilities = await loaded.center.getCapabilities();

    expect(capabilities.notification.supported).toBe(false);
    expect(capabilities.notification.togglePlacement).toBe('hidden');
  });

  it('delegates notification permission and show operations', async () => {
    const loaded = await loadCenter({
      notificationPermission: 'default',
      notificationRequestResult: 'granted',
    });

    await expect(loaded.center.notification.getPermissionState()).resolves.toBe(
      'default',
    );
    await expect(loaded.center.notification.requestPermission()).resolves.toBe(
      'granted',
    );
    await loaded.center.notification.show({
      title: 'Task completed',
      body: 'Done',
    });

    expect(loaded.notificationAdapter.getPermissionState).toHaveBeenCalledTimes(
      1,
    );
    expect(loaded.notificationAdapter.requestPermission).toHaveBeenCalledTimes(
      1,
    );
    expect(loaded.notificationAdapter.show).toHaveBeenCalledWith({
      title: 'Task completed',
      body: 'Done',
    });
  });

  it('returns false and logs warning for unsupported operations', async () => {
    const loaded = await loadCenter({
      windowCapabilities: {
        canSetFullscreen: false,
        canMinimizeToTray: false,
        canFocus: true,
      },
      fileCapabilities: {
        canSaveFile: false,
        canOpenFile: false,
      },
      hapticsCapabilities: {
        canImpact: false,
        canNotification: false,
        canSelectionChanged: false,
      },
    });

    await expect(loaded.center.window.setFullscreen(true)).resolves.toBe(false);
    await expect(loaded.center.window.minimizeToTray()).resolves.toBe(false);
    await expect(loaded.center.file.saveFile('{}', 'a.json')).resolves.toBe(
      false,
    );
    await expect(loaded.center.file.openFile(['json'])).resolves.toBeNull();
    await expect(loaded.center.haptics.impact('light')).resolves.toBe(false);
    await expect(loaded.center.haptics.notification('success')).resolves.toBe(
      false,
    );
    await expect(loaded.center.haptics.selectionChanged()).resolves.toBe(false);

    expect(loaded.loggerWarn).toHaveBeenCalled();
  });
  it('reads notification permission changes instead of treating capability support as permission', async () => {
    const loaded = await loadCenter();
    await loaded.center.getCapabilities();
    loaded.notificationAdapter.getPermissionState
      .mockResolvedValueOnce('denied')
      .mockResolvedValueOnce('granted');
    await expect(loaded.center.notification.getPermissionState()).resolves.toBe(
      'denied',
    );
    await expect(loaded.center.notification.getPermissionState()).resolves.toBe(
      'granted',
    );
  });

  it('uses current adapter capabilities after an environment change', async () => {
    const loaded = await loadCenter();
    expect(
      (await loaded.center.getCapabilities()).window.canSetFullscreen,
    ).toBe(true);
    loaded.windowAdapter.getCapabilities.mockReturnValue({
      canSetFullscreen: false,
      canMinimizeToTray: false,
      canFocus: true,
    });
    await expect(loaded.center.window.setFullscreen(true)).resolves.toBe(false);
    expect(loaded.windowAdapter.setFullscreen).not.toHaveBeenCalled();
    loaded.notificationAdapter.isSupported.mockReturnValue(false);
    expect(
      (await loaded.center.getCapabilities()).notification.togglePlacement,
    ).toBe('hidden');
  });

  it('keeps file cancellation distinct from success and normalizes operation failures', async () => {
    const loaded = await loadCenter();
    loaded.fileAdapter.saveFile
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('disk full'));
    loaded.fileAdapter.openFile
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('read failed'));
    await expect(loaded.center.file.saveFile('{}', 'data.json')).resolves.toBe(
      false,
    );
    await expect(loaded.center.file.openFile(['json'])).resolves.toBeNull();
    await expect(loaded.center.file.saveFile('{}', 'data.json')).resolves.toBe(
      false,
    );
    await expect(loaded.center.file.openFile(['json'])).resolves.toBeNull();
    expect(loaded.loggerError).toHaveBeenCalledWith(
      'PLATFORM_CAPABILITIES',
      'Failed to save file',
      { defaultName: 'data.json' },
      expect.objectContaining({ message: 'disk full' }),
    );
    expect(loaded.loggerError).toHaveBeenCalledWith(
      'PLATFORM_CAPABILITIES',
      'Failed to open file',
      { extensions: ['json'] },
      expect.objectContaining({ message: 'read failed' }),
    );
  });

  it('reports unsupported and failed boolean operations without claiming success', async () => {
    const loaded = await loadCenter();
    loaded.windowAdapter.focus.mockRejectedValueOnce(new Error('window gone'));
    loaded.hapticsAdapter.impact.mockRejectedValueOnce('unavailable');
    await expect(loaded.center.window.focus()).resolves.toBe(false);
    await expect(loaded.center.haptics.impact('light')).resolves.toBe(false);
  });
});
