import { useEffect } from 'react';
import { useI18n } from '../../../i18n';
import { systemNotificationService } from '../../../services/platform/SystemNotificationService';
import type { ActiveSession, Chain } from '../../../types';
import { fireAndForget } from '../../../utils/fireAndForget';
import { isTauriDesktop } from '../../../utils/platform';
import { invokeCommand } from '../../../utils/tauri-bridge';

/** When a running timed session ends, in Unix milliseconds. */
export function sessionEndsAt(session: ActiveSession): number {
  return (
    session.startedAt.getTime() +
    session.duration * 60_000 +
    session.totalPausedTime
  );
}

/**
 * Has the desktop app post a system notification when a timed session ends.
 * The page's own timer can be suspended while the window is hidden; the
 * native timer cannot. Pausing, finishing or leaving the session cancels it.
 */
export function useSessionEndAlarm({
  chain,
  session,
  isDurationless,
}: {
  chain: Chain;
  session: ActiveSession;
  isDurationless: boolean;
}): void {
  const { t } = useI18n();
  const title = t('focusMode.sessionEndAlarm.title');
  const body = t('focusMode.sessionEndAlarm.body', { chainName: chain.name });
  const endsAt =
    isDurationless || session.isPaused ? null : sessionEndsAt(session);
  const key = `session:${chain.id}:${session.startedAt.toISOString()}`;

  useEffect(() => {
    if (!isTauriDesktop || endsAt === null || endsAt <= Date.now()) return;
    const { enabled, permission } = systemNotificationService.getState();
    if (!enabled || permission !== 'granted') return;

    fireAndForget(
      invokeCommand('schedule_session_end', {
        key,
        fireAtMs: endsAt,
        title,
        body,
      }),
      { label: 'session-end-alarm' },
    );
    return () => {
      fireAndForget(invokeCommand('cancel_session_end', { key }), {
        label: 'session-end-alarm',
      });
    };
  }, [key, endsAt, title, body]);
}
