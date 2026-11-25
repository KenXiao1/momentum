import { describe, expect, it } from 'vitest';
import type { CompletionHistory } from '../../types';
import {
  activityLevel,
  buildActivityCalendar,
  localDateKey,
} from '../activityCalendar';

function record(
  year: number,
  month: number,
  day: number,
  hour: number,
  wasSuccessful = true,
): CompletionHistory {
  return {
    chainId: 'chain-1',
    completedAt: new Date(year, month - 1, day, hour),
    duration: 25,
    wasSuccessful,
  };
}

// Wednesday 2026-11-25, local time.
const TODAY = new Date(2026, 10, 25, 15);

describe('buildActivityCalendar', () => {
  it('lays out whole Monday-first weeks ending with the current week', () => {
    const calendar = buildActivityCalendar([], TODAY, 2);

    expect(calendar.weeks).toHaveLength(2);
    expect(calendar.weeks.map((week) => week[0].date)).toEqual([
      '2026-11-16',
      '2026-11-23',
    ]);
    expect(calendar.weeks[1].map((day) => day.future)).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
  });

  it('counts completions on the local day they happened', () => {
    const calendar = buildActivityCalendar(
      [
        record(2026, 11, 24, 23),
        record(2026, 11, 24, 8),
        record(2026, 11, 24, 9, false),
        record(2026, 11, 25, 0),
      ],
      TODAY,
      1,
    );
    const [, tuesday, wednesday] = calendar.weeks[0];

    expect(tuesday).toMatchObject({
      date: '2026-11-24',
      successes: 2,
      failures: 1,
      level: 2,
    });
    expect(wednesday).toMatchObject({ successes: 1, level: 1 });
  });

  it('summarises completions, active days and the longest daily run', () => {
    const calendar = buildActivityCalendar(
      [
        record(2026, 11, 16, 10),
        record(2026, 11, 17, 10),
        record(2026, 11, 18, 10),
        record(2026, 11, 18, 11),
        record(2026, 11, 20, 10),
        record(2026, 11, 21, 10, false),
        record(2026, 10, 1, 10),
      ],
      TODAY,
      2,
    );

    expect(calendar.totalSuccesses).toBe(5);
    expect(calendar.activeDays).toBe(4);
    expect(calendar.longestRun).toBe(3);
  });

  it('ignores records outside the range and in the future', () => {
    const calendar = buildActivityCalendar(
      [record(2026, 11, 27, 10), record(2025, 1, 1, 10)],
      TODAY,
      1,
    );

    expect(calendar.totalSuccesses).toBe(0);
    expect(calendar.weeks[0][4]).toMatchObject({ successes: 0, future: true });
  });
});

describe('activityLevel', () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 3],
    [5, 4],
    [12, 4],
  ])('maps %i completions to level %i', (count, level) => {
    expect(activityLevel(count)).toBe(level);
  });
});

it('formats local dates with zero padding', () => {
  expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
});
