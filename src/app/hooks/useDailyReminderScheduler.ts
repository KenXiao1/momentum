import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { nextReminderAt, parseReminderTime } from '../../domain/dailyReminder';
import { useSystemNotificationState } from '../../hooks/useSystemNotificationState';
import { useI18n } from '../../i18n';
import { systemNotificationService } from '../../services/platform/SystemNotificationService';
import type { Chain } from '../../types';
import { fireAndForget } from '../../utils/fireAndForget';
import {
  getDailyReminderTimes,
  subscribeDailyReminderTimes,
} from '../../utils/local-preferences/dailyReminders';
import { isTauri, isTauriDesktop } from '../../utils/platform';
import { invokeCommand } from '../../utils/tauri-bridge';

interface ScheduledReminder {
  key: string;
  time: string;
  hour: number;
  minute: number;
  title: string;
  body: string;
}

/**
 * Runs this device's daily chain reminders. The desktop app hands the list
 * to Rust, which keeps time while the window is hidden; the web app keeps a
 * timer while the page is open. Mobile has no scheduler yet.
 */
export function useDailyReminderScheduler(
  chains: Chain[],
  enabled: boolean,
): void {
  const { t } = useI18n();
  const times = useSyncExternalStore(
    subscribeDailyReminderTimes,
    getDailyReminderTimes,
  );
  const notifications = useSystemNotificationState();
  const canNotify =
    notifications.enabled && notifications.permission === 'granted';

  const reminders = useMemo<ScheduledReminder[]>(
    () =>
      chains.flatMap((chain) => {
        const time = times[chain.id];
        const parsed = time ? parseReminderTime(time) : null;
        if (!time || !parsed || chain.deletedAt) return [];
        return [
          {
            key: chain.id,
            time,
            ...parsed,
            title: t('dailyReminder.notificationTitle', {
              chainName: chain.name,
            }),
            body: chain.trigger
              ? t('dailyReminder.notificationBody', { trigger: chain.trigger })
              : t('dailyReminder.notificationBodyPlain'),
          },
        ];
      }),
    [chains, times, t],
  );

  useEffect(() => {
    if (!isTauriDesktop || !enabled) return;
    const list = canNotify
      ? reminders.map(({ key, hour, minute, title, body }) => ({
          key,
          hour,
          minute,
          title,
          body,
        }))
      : [];
    fireAndForget(invokeCommand('set_daily_reminders', { reminders: list }), {
      label: 'daily-reminders',
    });
  }, [canNotify, enabled, reminders]);

  useEffect(() => {
    if (isTauri || !enabled || !canNotify || reminders.length === 0) return;
    let timer: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      const now = new Date();
      const upcoming = reminders.map((reminder) => ({
        reminder,
        at: nextReminderAt(reminder.time, now)!.getTime(),
      }));
      const soonest = Math.min(...upcoming.map((item) => item.at));
      timer = setTimeout(() => {
        for (const { reminder, at } of upcoming)
          if (at === soonest)
            fireAndForget(
              systemNotificationService.notifyDailyReminder(
                reminder.title,
                reminder.body,
              ),
              { label: 'daily-reminder' },
            );
        scheduleNext();
      }, soonest - now.getTime());
    };
    scheduleNext();
    return () => clearTimeout(timer);
  }, [canNotify, enabled, reminders]);
}
