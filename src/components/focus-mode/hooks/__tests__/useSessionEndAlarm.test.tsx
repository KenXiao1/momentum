import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUnitChain } from '../../../../test/factories';
import type { ActiveSession } from '../../../../types';

const bridge = vi.hoisted(() => ({ invokeCommand: vi.fn(async () => null) }));
vi.mock('../../../../utils/tauri-bridge', () => bridge);
// The native notification boundary: supported and already permitted.
vi.mock('../../../../utils/platform-capabilities/center', () => ({
  getPlatformCapabilityCenter: () => ({
    getCapabilities: async () => ({
      notification: { supported: true, togglePlacement: 'settings' },
    }),
    notification: { getPermissionState: async () => 'granted' },
  }),
}));

const chain = createUnitChain({ id: 'chain-1', name: 'Deep work' });

function runningSession(overrides: Partial<ActiveSession> = {}): ActiveSession {
  return {
    chainId: chain.id,
    startedAt: new Date(Date.now() - 60_000),
    duration: 25,
    isPaused: false,
    totalPausedTime: 30_000,
    ...overrides,
  };
}

/** Loads the hook as the desktop app or the browser would. */
async function load({
  desktop = true,
  notificationsOn = true,
}: { desktop?: boolean; notificationsOn?: boolean } = {}) {
  vi.resetModules();
  if (desktop) Object.assign(window, { __TAURI_INTERNALS__: {} });
  localStorage.setItem('language', 'en');
  localStorage.setItem('notifications_enabled', String(notificationsOn));
  const { systemNotificationService } =
    await import('../../../../services/platform/SystemNotificationService');
  await systemNotificationService.init();
  const hook = await import('../useSessionEndAlarm');
  const { I18nProvider } = await import('../../../../i18n');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider>{children}</I18nProvider>
  );
  return { ...hook, wrapper };
}

describe('useSessionEndAlarm', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
    bridge.invokeCommand.mockClear();
  });

  it('schedules the end of a running session and cancels it when paused', async () => {
    const { useSessionEndAlarm, wrapper } = await load();
    const session = runningSession();
    const { rerender } = renderHook(
      ({ current }) =>
        useSessionEndAlarm({ chain, session: current, isDurationless: false }),
      { wrapper, initialProps: { current: session } },
    );

    expect(bridge.invokeCommand).toHaveBeenCalledWith('schedule_session_end', {
      key: `session:chain-1:${session.startedAt.toISOString()}`,
      fireAtMs: session.startedAt.getTime() + 25 * 60_000 + 30_000,
      title: 'Focus session complete',
      body: '"Deep work" reached its planned time. Come back to record it.',
    });

    rerender({ current: { ...session, isPaused: true, pausedAt: new Date() } });

    expect(bridge.invokeCommand).toHaveBeenLastCalledWith(
      'cancel_session_end',
      { key: `session:chain-1:${session.startedAt.toISOString()}` },
    );
  });

  it('cancels the alarm when the session view closes', async () => {
    const { useSessionEndAlarm, wrapper } = await load();
    const { unmount } = renderHook(
      () =>
        useSessionEndAlarm({
          chain,
          session: runningSession(),
          isDurationless: false,
        }),
      { wrapper },
    );

    unmount();

    expect(bridge.invokeCommand).toHaveBeenLastCalledWith(
      'cancel_session_end',
      expect.any(Object),
    );
  });

  it.each([
    ['outside the desktop app', { desktop: false }, {}],
    ['when notifications are off', { notificationsOn: false }, {}],
    ['for a durationless session', {}, { isDurationless: true }],
    [
      'after the session already ended',
      {},
      { session: runningSession({ startedAt: new Date(0) }) },
    ],
  ])('does not schedule %s', async (_label, environment, props) => {
    const { useSessionEndAlarm, wrapper } = await load(environment);

    renderHook(
      () =>
        useSessionEndAlarm({
          chain,
          session: runningSession(),
          isDurationless: false,
          ...props,
        }),
      { wrapper },
    );

    expect(bridge.invokeCommand).not.toHaveBeenCalled();
  });

  it('adds paused time to the planned end', async () => {
    const { sessionEndsAt } = await load();

    expect(
      sessionEndsAt(
        runningSession({
          startedAt: new Date(0),
          duration: 1,
          totalPausedTime: 5_000,
        }),
      ),
    ).toBe(65_000);
  });
});
