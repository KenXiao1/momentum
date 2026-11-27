import type { Chain, CompletionHistory } from '../types';
import { localDateKey } from './activityCalendar';

export interface HourBucket {
  hour: number;
  successes: number;
  failures: number;
}

/** Completions by the local hour they finished in, 0–23. */
export function hourlyDistribution(history: CompletionHistory[]): HourBucket[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    successes: 0,
    failures: 0,
  }));
  for (const record of history) {
    const bucket = buckets[record.completedAt.getHours()];
    if (record.wasSuccessful) bucket.successes += 1;
    else bucket.failures += 1;
  }
  return buckets;
}

export interface StreakPoint {
  completedAt: Date;
  streak: number;
  wasSuccessful: boolean;
}

/**
 * The streak after each record, oldest first: a success extends it and a
 * failure resets it. Computed over all of `history`, then the last `limit`
 * points are returned so a long history still starts from the true streak.
 */
export function streakSeries(
  history: CompletionHistory[],
  limit: number,
): StreakPoint[] {
  const ordered = [...history].sort(
    (a, b) => a.completedAt.getTime() - b.completedAt.getTime(),
  );
  let streak = 0;
  const points = ordered.map((record) => {
    streak = record.wasSuccessful ? streak + 1 : 0;
    return {
      completedAt: record.completedAt,
      streak,
      wasSuccessful: record.wasSuccessful,
    };
  });
  return points.slice(-limit);
}

export interface PeriodStats {
  completions: number;
  failures: number;
  focusMinutes: number;
  activeDays: number;
  /** Share of finished sessions that succeeded; `null` with none. */
  successRate: number | null;
}

interface ReviewDay {
  date: string;
  completions: number;
  focusMinutes: number;
  future: boolean;
}

interface ChainSummary {
  chainId: string;
  /** `null` when the chain no longer exists. */
  name: string | null;
  completions: number;
  focusMinutes: number;
}

export interface WeeklyReview {
  /** Monday of the current week, `YYYY-MM-DD`. */
  weekStart: string;
  thisWeek: PeriodStats;
  lastWeek: PeriodStats;
  /** Monday through Sunday of the current week. */
  days: ReviewDay[];
  /** Up to three chains with the most completions this week. */
  topChains: ChainSummary[];
}

function focusMinutes(record: CompletionHistory): number {
  return record.wasSuccessful ? (record.actualDuration ?? record.duration) : 0;
}

function periodStats(records: CompletionHistory[]): PeriodStats {
  const completions = records.filter((record) => record.wasSuccessful);
  const finished = records.length;
  return {
    completions: completions.length,
    failures: finished - completions.length,
    focusMinutes: completions.reduce(
      (sum, record) => sum + focusMinutes(record),
      0,
    ),
    activeDays: new Set(
      completions.map((record) => localDateKey(record.completedAt)),
    ).size,
    successRate: finished === 0 ? null : completions.length / finished,
  };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * This week (Monday to `today`'s Sunday, local time) against last week.
 * Records of group chains are left out: their units are already counted.
 */
export function weeklyReview(
  history: CompletionHistory[],
  chains: Chain[],
  today: Date,
): WeeklyReview {
  const groups = new Set(
    chains.filter((chain) => chain.type === 'group').map((chain) => chain.id),
  );
  const names = new Map(chains.map((chain) => [chain.id, chain.name]));
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  const weekStart = localDateKey(monday);
  const lastWeekStart = localDateKey(addDays(monday, -7));
  const todayKey = localDateKey(today);

  const thisWeekRecords: CompletionHistory[] = [];
  const lastWeekRecords: CompletionHistory[] = [];
  for (const record of history) {
    if (groups.has(record.chainId)) continue;
    const day = localDateKey(record.completedAt);
    if (day >= weekStart && day <= todayKey) thisWeekRecords.push(record);
    else if (day >= lastWeekStart && day < weekStart)
      lastWeekRecords.push(record);
  }

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = localDateKey(addDays(monday, index));
    const onDay = thisWeekRecords.filter(
      (record) =>
        record.wasSuccessful && localDateKey(record.completedAt) === date,
    );
    return {
      date,
      completions: onDay.length,
      focusMinutes: onDay.reduce(
        (sum, record) => sum + focusMinutes(record),
        0,
      ),
      future: date > todayKey,
    };
  });

  const byChain = new Map<string, ChainSummary>();
  for (const record of thisWeekRecords) {
    if (!record.wasSuccessful) continue;
    const summary = byChain.get(record.chainId) ?? {
      chainId: record.chainId,
      name: names.get(record.chainId) ?? null,
      completions: 0,
      focusMinutes: 0,
    };
    summary.completions += 1;
    summary.focusMinutes += focusMinutes(record);
    byChain.set(record.chainId, summary);
  }
  const topChains = [...byChain.values()]
    .sort(
      (a, b) =>
        b.completions - a.completions || b.focusMinutes - a.focusMinutes,
    )
    .slice(0, 3);

  return {
    weekStart,
    thisWeek: periodStats(thisWeekRecords),
    lastWeek: periodStats(lastWeekRecords),
    days,
    topChains,
  };
}
