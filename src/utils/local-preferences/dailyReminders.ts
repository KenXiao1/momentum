import { parseReminderTime } from '../../domain/dailyReminder';
import { LOCAL_STORAGE_KEYS } from './keys';

/** Reminder time (`HH:MM`) by chain id, kept on this device only. */
export type DailyReminderTimes = Readonly<Record<string, string>>;

const EMPTY: DailyReminderTimes = {};
let snapshot: DailyReminderTimes | null = null;
const listeners = new Set<() => void>();

function read(): DailyReminderTimes {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.DAILY_REMINDERS);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === 'string' && parseReminderTime(entry[1]) !== null,
      ),
    );
  } catch {
    return EMPTY;
  }
}

/** A stable snapshot, so React can subscribe with useSyncExternalStore. */
export function getDailyReminderTimes(): DailyReminderTimes {
  snapshot ??= read();
  return snapshot;
}

/** Sets, or with `null` removes, a chain's reminder on this device. */
export function setDailyReminderTime(
  chainId: string,
  time: string | null,
): void {
  if (time !== null && !parseReminderTime(time)) return;
  const next: Record<string, string> = { ...getDailyReminderTimes() };
  if (time === null) delete next[chainId];
  else next[chainId] = time;
  snapshot = next;
  try {
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.DAILY_REMINDERS,
      JSON.stringify(next),
    );
  } catch {
    // best-effort: the reminder still runs until the app reloads
  }
  listeners.forEach((listener) => listener());
}

export function subscribeDailyReminderTimes(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
