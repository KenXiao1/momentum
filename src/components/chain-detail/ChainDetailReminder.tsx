import { BellRing } from 'lucide-react';
import { Switch } from '../Switch';
import type { ReminderSettings, TranslationFn } from './types';

const DEFAULT_TIME = '20:00';

/** Turns this device's daily reminder for the chain on or off. */
export function ChainDetailReminder({
  reminder,
  t,
}: {
  reminder: ReminderSettings;
  t: TranslationFn;
}) {
  if (reminder.support === 'none') return null;
  const enabled = reminder.time !== null;

  return (
    <div className="bento-card animate-scale-in">
      <h3 className="mb-6 flex items-center space-x-3 font-chinese text-xl font-bold text-[#161615] dark:text-slate-100">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10">
          <BellRing className="text-violet-500" size={20} />
        </div>
        <div>
          <span>{t('dailyReminder.title')}</span>
          <p className="font-mono text-xs tracking-wide text-gray-500 dark:text-slate-400">
            {t('dailyReminder.subtitle')}
          </p>
        </div>
      </h3>

      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-gray-700 dark:text-slate-300">
          {t('dailyReminder.toggle')}
        </span>
        <Switch
          checked={enabled}
          onCheckedChange={(next) =>
            reminder.onChange(next ? (reminder.time ?? DEFAULT_TIME) : null)
          }
          aria-label={t('dailyReminder.toggle')}
        />
      </div>

      {enabled && (
        <label className="mt-4 flex items-center justify-between gap-4 text-sm text-gray-700 dark:text-slate-300">
          <span>{t('dailyReminder.time')}</span>
          <input
            type="time"
            value={reminder.time ?? DEFAULT_TIME}
            onChange={(event) => {
              if (event.target.value) reminder.onChange(event.target.value);
            }}
            className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
      )}

      {enabled && !reminder.canNotify && (
        <p
          role="status"
          className="mt-4 text-xs text-amber-700 dark:text-amber-400"
        >
          {t('dailyReminder.needsNotifications')}
        </p>
      )}
      {enabled && reminder.support === 'web' && (
        <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
          {t('dailyReminder.webHint')}
        </p>
      )}
    </div>
  );
}
