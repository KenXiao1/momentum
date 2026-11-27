import { describe, expect, it } from 'vitest';
import { createGroupChain, createUnitChain } from '../../test/factories';
import type { CompletionHistory } from '../../types';
import {
  hourlyDistribution,
  streakSeries,
  weeklyReview,
} from '../completionStats';

function record(
  chainId: string,
  completedAt: Date,
  wasSuccessful = true,
  extra: Partial<CompletionHistory> = {},
): CompletionHistory {
  return { chainId, completedAt, duration: 25, wasSuccessful, ...extra };
}

const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 30);
// Wednesday 2026-11-25; this week starts Monday the 23rd.
const TODAY = new Date(2026, 10, 25, 15);

describe('hourlyDistribution', () => {
  it('counts completions and failures by local hour', () => {
    const buckets = hourlyDistribution([
      record('a', at(20, 9)),
      record('a', at(21, 9)),
      record('a', at(21, 9), false),
      record('a', at(21, 23)),
    ]);

    expect(buckets).toHaveLength(24);
    expect(buckets[9]).toEqual({ hour: 9, successes: 2, failures: 1 });
    expect(buckets[23].successes).toBe(1);
    expect(buckets[0]).toEqual({ hour: 0, successes: 0, failures: 0 });
  });
});

describe('streakSeries', () => {
  it('extends on success, resets on failure, and keeps the true streak when trimmed', () => {
    const history = [
      record('a', at(20, 9)),
      record('a', at(22, 9)),
      record('a', at(21, 9)),
      record('a', at(23, 9), false),
      record('a', at(24, 9)),
    ];

    expect(streakSeries(history, 10).map((point) => point.streak)).toEqual([
      1, 2, 3, 0, 1,
    ]);
    expect(streakSeries(history.slice(0, 3), 2).map((p) => p.streak)).toEqual([
      2, 3,
    ]);
  });
});

describe('weeklyReview', () => {
  const unit = createUnitChain({ id: 'unit', name: 'Write' });
  const other = createUnitChain({ id: 'other', name: 'Read' });
  const group = createGroupChain({ id: 'group', name: 'Morning' });

  it('compares this week with last week', () => {
    const review = weeklyReview(
      [
        record('unit', at(23, 9), true, { actualDuration: 40 }),
        record('unit', at(23, 20)),
        record('unit', at(24, 9), false),
        record('other', at(25, 8)),
        record('group', at(25, 9)),
        record('unit', at(18, 9)),
        record('unit', at(15, 9)),
      ],
      [unit, other, group],
      TODAY,
    );

    expect(review.weekStart).toBe('2026-11-23');
    expect(review.thisWeek).toEqual({
      completions: 3,
      failures: 1,
      focusMinutes: 90,
      activeDays: 2,
      successRate: 0.75,
    });
    expect(review.lastWeek).toMatchObject({ completions: 1, activeDays: 1 });
    expect(review.days.map((day) => day.completions)).toEqual([
      2, 0, 1, 0, 0, 0, 0,
    ]);
    expect(review.days.map((day) => day.future)).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
    expect(review.topChains).toEqual([
      { chainId: 'unit', name: 'Write', completions: 2, focusMinutes: 65 },
      { chainId: 'other', name: 'Read', completions: 1, focusMinutes: 25 },
    ]);
  });

  it('names deleted chains as null and reports no rate without sessions', () => {
    const review = weeklyReview([record('gone', at(24, 9))], [], TODAY);

    expect(review.topChains[0].name).toBeNull();
    expect(review.lastWeek.successRate).toBeNull();
  });
});
