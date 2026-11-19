import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webNotificationAdapter } from '../web';

const notifications: FakeNotification[] = [];

class FakeNotification {
  static permission: NotificationPermission = 'default';
  static requestPermission = vi.fn<() => Promise<NotificationPermission>>();

  onclick: ((event: Event) => void) | null = null;
  close = vi.fn();

  constructor(
    readonly title: string,
    readonly options?: NotificationOptions,
  ) {
    notifications.push(this);
  }
}

describe('webNotificationAdapter', () => {
  beforeEach(() => {
    notifications.length = 0;
    FakeNotification.permission = 'default';
    FakeNotification.requestPermission.mockReset().mockResolvedValue('granted');
    vi.stubGlobal('Notification', FakeNotification);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reports notification capabilities when the browser API is present', async () => {
    expect(webNotificationAdapter.isSupported()).toBe(true);
    expect(webNotificationAdapter.getCapabilities()).toEqual({
      canRequestPermission: true,
      canShow: true,
    });
    await expect(webNotificationAdapter.getPermissionState()).resolves.toBe(
      'default',
    );
  });

  it('returns safe defaults without touching Notification outside a browser', async () => {
    vi.stubGlobal('window', undefined);

    expect(webNotificationAdapter.isSupported()).toBe(false);
    expect(webNotificationAdapter.getCapabilities()).toEqual({
      canRequestPermission: false,
      canShow: false,
    });
    await expect(webNotificationAdapter.getPermissionState()).resolves.toBe(
      'default',
    );
    await expect(webNotificationAdapter.requestPermission()).resolves.toBe(
      'default',
    );
    await expect(
      webNotificationAdapter.show({ title: 'Task done', body: 'Body' }),
    ).resolves.toBeUndefined();
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled();
    expect(notifications).toHaveLength(0);
  });

  it('does not prompt again after permission was granted or denied', async () => {
    FakeNotification.permission = 'granted';
    await expect(webNotificationAdapter.requestPermission()).resolves.toBe(
      'granted',
    );

    FakeNotification.permission = 'denied';
    await expect(webNotificationAdapter.requestPermission()).resolves.toBe(
      'denied',
    );

    expect(FakeNotification.requestPermission).not.toHaveBeenCalled();
  });

  it('returns the browser prompt result for an undecided permission', async () => {
    FakeNotification.requestPermission.mockResolvedValue('denied');

    await expect(webNotificationAdapter.requestPermission()).resolves.toBe(
      'denied',
    );
    expect(FakeNotification.requestPermission).toHaveBeenCalledOnce();
  });

  it('does not construct a notification without permission', async () => {
    FakeNotification.permission = 'denied';

    await webNotificationAdapter.show({ title: 'Task done', body: 'Body' });

    expect(notifications).toHaveLength(0);
  });

  it('shows, focuses, and automatically closes a transient notification', async () => {
    vi.useFakeTimers();
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => undefined);
    FakeNotification.permission = 'granted';

    await webNotificationAdapter.show({
      title: 'Task done',
      body: 'You earned points',
    });

    expect(notifications).toHaveLength(1);
    const notification = notifications[0];
    expect(notification.title).toBe('Task done');
    expect(notification.options).toEqual({
      body: 'You earned points',
      icon: undefined,
      tag: undefined,
      requireInteraction: false,
      silent: false,
    });

    notification.onclick?.(new Event('click'));
    expect(focus).toHaveBeenCalledOnce();
    expect(notification.close).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(4_999);
    expect(notification.close).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(notification.close).toHaveBeenCalledTimes(2);
  });

  it('keeps an explicitly persistent notification open', async () => {
    vi.useFakeTimers();
    FakeNotification.permission = 'granted';

    await webNotificationAdapter.show({
      title: 'Attention required',
      body: 'Review this task',
      icon: '/icon.png',
      tag: 'review-task',
      requireInteraction: true,
      silent: true,
    });

    const notification = notifications[0];
    expect(notification.options).toEqual({
      body: 'Review this task',
      icon: '/icon.png',
      tag: 'review-task',
      requireInteraction: true,
      silent: true,
    });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(notification.close).not.toHaveBeenCalled();
  });
});
