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
  const adapterLoaders = {
    getNotificationAdapter: vi.fn(async () => notificationAdapter),
    getWindowAdapter: vi.fn(async () => windowAdapter),
    getFileAdapter: vi.fn(async () => fileAdapter),
    getHapticsAdapter: vi.fn(async () => hapticsAdapter),
  };
  vi.doMock('../../platform-adapters', () => adapterLoaders);

  const module = await import('../center');
  return {
    center: module.getPlatformCapabilityCenter(),
    adapterLoaders,
    notificationAdapter,
    windowAdapter,
    fileAdapter,
    hapticsAdapter,
    loggerWarn,
    loggerError,
  };
}

async function loadOnlyCapability(
  available: keyof Awaited<ReturnType<typeof loadCenter>>['adapterLoaders'],
) {
  const loaded = await loadCenter();
  for (const [name, loader] of Object.entries(loaded.adapterLoaders)) {
    if (name !== available) {
      loader.mockRejectedValue(new Error(`${name} unavailable`));
    }
  }
  return loaded;
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

  it('keeps notifications usable when unrelated adapters cannot load', async () => {
    const loaded = await loadOnlyCapability('getNotificationAdapter');

    await expect(loaded.center.notification.isSupported()).resolves.toBe(true);
    await expect(loaded.center.notification.getPermissionState()).resolves.toBe(
      'default',
    );
    await expect(loaded.center.notification.requestPermission()).resolves.toBe(
      'granted',
    );
    await loaded.center.notification.show({ title: 'Ready', body: 'Done' });
    expect(loaded.notificationAdapter.show).toHaveBeenCalledWith({
      title: 'Ready',
      body: 'Done',
    });
  });

  it('keeps window controls usable when unrelated adapters cannot load', async () => {
    const loaded = await loadOnlyCapability('getWindowAdapter');

    await expect(loaded.center.window.setFullscreen(true)).resolves.toBe(true);
    await expect(loaded.center.window.minimizeToTray()).resolves.toBe(true);
    await expect(loaded.center.window.focus()).resolves.toBe(true);
    expect(loaded.windowAdapter.setFullscreen).toHaveBeenCalledWith(true);
    expect(loaded.windowAdapter.minimizeToTray).toHaveBeenCalledOnce();
    expect(loaded.windowAdapter.focus).toHaveBeenCalledOnce();
  });

  it('keeps file operations usable when unrelated adapters cannot load', async () => {
    const loaded = await loadOnlyCapability('getFileAdapter');

    await expect(loaded.center.file.saveFile('{}', 'data.json')).resolves.toBe(
      true,
    );
    await expect(loaded.center.file.openFile(['json'])).resolves.toBe(
      '{"ok":true}',
    );
    expect(loaded.fileAdapter.saveFile).toHaveBeenCalledWith('{}', 'data.json');
    expect(loaded.fileAdapter.openFile).toHaveBeenCalledWith(['json']);
  });

  it('keeps haptics usable when unrelated adapters cannot load', async () => {
    const loaded = await loadOnlyCapability('getHapticsAdapter');

    await expect(loaded.center.haptics.impact('light')).resolves.toBe(true);
    await expect(loaded.center.haptics.notification('success')).resolves.toBe(
      true,
    );
    await expect(loaded.center.haptics.selectionChanged()).resolves.toBe(true);
    expect(loaded.hapticsAdapter.impact).toHaveBeenCalledWith('light');
    expect(loaded.hapticsAdapter.notification).toHaveBeenCalledWith('success');
    expect(loaded.hapticsAdapter.selectionChanged).toHaveBeenCalledOnce();
  });

  it.each([
    { supported: false, canRequestPermission: true, canShow: true },
    { supported: true, canRequestPermission: false, canShow: false },
  ])(
    'requires notification support and each operation flag: %j',
    async (caps) => {
      const loaded = await loadCenter();
      loaded.notificationAdapter.isSupported.mockReturnValue(caps.supported);
      loaded.notificationAdapter.getCapabilities.mockReturnValue(caps);

      await expect(
        loaded.center.notification.requestPermission(),
      ).resolves.toBe('default');
      await loaded.center.notification.show({ title: 'Ready', body: 'Done' });
      expect(
        loaded.notificationAdapter.requestPermission,
      ).not.toHaveBeenCalled();
      expect(loaded.notificationAdapter.show).not.toHaveBeenCalled();
    },
  );

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

  it('returns false/null for a canceled file dialog and rejects a failed one', async () => {
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
    await expect(
      loaded.center.file.saveFile('{}', 'data.json'),
    ).rejects.toThrow('disk full');
    await expect(loaded.center.file.openFile(['json'])).rejects.toThrow(
      'read failed',
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
