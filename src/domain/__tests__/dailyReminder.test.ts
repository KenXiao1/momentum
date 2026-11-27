import { describe, expect, it } from 'vitest';
import { nextReminderAt, parseReminderTime } from '../dailyReminder';

describe('daily reminder time', () => {
  it.each([
    ['20:00', { hour: 20, minute: 0 }],
    ['07:05', { hour: 7, minute: 5 }],
    ['24:00', null],
    ['7:05', null],
    ['20:60', null],
  ])('parses %s', (time, expected) => {
    expect(parseReminderTime(time)).toEqual(expected);
  });

  it('is due later today, or tomorrow once today’s time has passed', () => {
    const morning = new Date(2026, 10, 25, 9, 0);
    expect(nextReminderAt('20:00', morning)).toEqual(
      new Date(2026, 10, 25, 20, 0),
    );
    expect(nextReminderAt('09:00', morning)).toEqual(
      new Date(2026, 10, 26, 9, 0),
    );
    expect(nextReminderAt('08:59', morning)).toEqual(
      new Date(2026, 10, 26, 8, 59),
    );
    expect(nextReminderAt('bad', morning)).toBeNull();
  });
});
