import type { CompletionHistory } from '../types';

/** 0 is no successful completion; 1–4 step up with the day's count. */
export type ActivityLevel = 0 | 1 | 2 | 3 | 4;

export interface ActivityDay {
  /** Local calendar date, `YYYY-MM-DD`. */
  date: string;
  successes: number;
  failures: number;
  level: ActivityLevel;
  /** Later than today; drawn empty so the current week keeps its shape. */
  future: boolean;
}

export interface ActivityCalendar {
  /** Week columns, oldest first; each holds Monday through Sunday. */
  weeks: ActivityDay[][];
  totalSuccesses: number;
  activeDays: number;
  /** Most consecutive days with at least one success inside the range. */
  longestRun: number;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** The local calendar date of `date`, as `YYYY-MM-DD`. */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Fixed thresholds, so a cell keeps its shade as more history arrives. */
export function activityLevel(successes: number): ActivityLevel {
  if (successes <= 0) return 0;
  if (successes === 1) return 1;
  if (successes === 2) return 2;
  if (successes <= 4) return 3;
  return 4;
}

/**
 * A completion calendar of `weekCount` weeks ending with the week that
 * contains `today`. Dates are local, so a session finished late at night
 * counts on the day the user experienced it.
 */
export function buildActivityCalendar(
  history: CompletionHistory[],
  today: Date,
  weekCount: number,
): ActivityCalendar {
  const daysSinceMonday = (today.getDay() + 6) % 7;
  const firstDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - daysSinceMonday - (weekCount - 1) * 7,
  );
  const todayKey = localDateKey(today);

  const counts = new Map<string, { successes: number; failures: number }>();
  for (const record of history) {
    const key = localDateKey(record.completedAt);
    const count = counts.get(key) ?? { successes: 0, failures: 0 };
    if (record.wasSuccessful) count.successes += 1;
    else count.failures += 1;
    counts.set(key, count);
  }

  const weeks: ActivityDay[][] = [];
  for (let week = 0; week < weekCount; week += 1) {
    const column: ActivityDay[] = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = localDateKey(
        new Date(
          firstDay.getFullYear(),
          firstDay.getMonth(),
          firstDay.getDate() + week * 7 + weekday,
        ),
      );
      const future = date > todayKey;
      const { successes, failures } = (!future && counts.get(date)) || {
        successes: 0,
        failures: 0,
      };
      column.push({
        date,
        successes,
        failures,
        level: activityLevel(successes),
        future,
      });
    }
    weeks.push(column);
  }

  return { weeks, ...summarize(weeks.flat()) };
}

function summarize(days: ActivityDay[]) {
  let totalSuccesses = 0;
  let activeDays = 0;
  let run = 0;
  let longestRun = 0;
  for (const day of days) {
    if (day.future) continue;
    totalSuccesses += day.successes;
    run = day.successes > 0 ? run + 1 : 0;
    if (day.successes > 0) activeDays += 1;
    longestRun = Math.max(longestRun, run);
  }
  return { totalSuccesses, activeDays, longestRun };
}
