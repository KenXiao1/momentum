import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUnitChain } from '../../../test/factories';

const bridge = vi.hoisted(() => ({ invokeCommand: vi.fn(async () => null) }));
const native = vi.hoisted(() => ({ show: vi.fn(async () => undefined) }));
vi.mock('../../../utils/tauri-bridge', () => bridge);
// The native notification boundary: supported and already permitted.
vi.mock('../../../utils/platform-capabilities/center', () => ({
  getPlatformCapabilityCenter: () => ({
    getCapabilities: async () => ({
      notification: { supported: true, togglePlacement: 'settings' },
    }),
    notification: {
      getPermissionState: async () => 'granted',
      show: native.show,
    },
  }),
}));

const chain = createUnitChain({
  id: 'write',
  name: 'Write thesis',
  trigger: 'Sit at your desk',
});

/** Loads the scheduler as the desktop app or the browser would. */
async function load({
  desktop = false,
  notificationsOn = true,
}: { desktop?: boolean; notificationsOn?: boolean } = {}) {
  vi.resetModules();
  if (desktop) Object.assign(window, { __TAURI_INTERNALS__: {} });
  localStorage.setItem('language', 'en');
  localStorage.setItem('notifications_enabled', String(notificationsOn));
  localStorage.setItem(
    'momentum_daily_reminders',
    JSON.stringify({ write: '20:00', gone: '08:00' }),
  );
  const { useDailyReminderScheduler } =
    await import('../useDailyReminderScheduler');
  const { I18nProvider } = await import('../../../i18n');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider>{children}</I18nProvider>
  );
  const view = renderHook(() => useDailyReminderScheduler([chain], true), {
    wrapper,
  });
  // Let the notification service finish its asynchronous init.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  return view;
}

describe('useDailyReminderScheduler', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
    bridge.invokeCommand.mockClear();
    native.show.mockClear();
    vi.useRealTimers();
  });

  it('notifies in the browser at the reminder time, then again the next day', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 25, 19, 59));
    await load();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_000);
    });
    expect(native.show).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(native.show).toHaveBeenCalledTimes(1);
    expect(native.show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Time for "Write thesis"',
        body: 'Start at your sacred seat: Sit at your desk',
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(24 * 60 * 60_000);
    });
    expect(native.show).toHaveBeenCalledTimes(2);
  });

  it('hands the desktop app only reminders for existing chains', async () => {
    vi.useFakeTimers();
    await load({ desktop: true });

    expect(bridge.invokeCommand).toHaveBeenLastCalledWith(
      'set_daily_reminders',
      {
        reminders: [
          {
            key: 'write',
            hour: 20,
            minute: 0,
            title: 'Time for "Write thesis"',
            body: 'Start at your sacred seat: Sit at your desk',
          },
        ],
      },
    );
  });

  it('clears the desktop list while notifications are off', async () => {
    vi.useFakeTimers();
    await load({ desktop: true, notificationsOn: false });

    expect(bridge.invokeCommand).toHaveBeenLastCalledWith(
      'set_daily_reminders',
      { reminders: [] },
    );
  });
});
