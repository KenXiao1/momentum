import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../../i18n/translate';
import { timerAnnouncement } from '../timerAnnouncement';

const t = createTranslator('en');
const countdown = (timeRemaining: number) =>
  timerAnnouncement({
    isDurationless: false,
    timeRemaining,
    elapsedSeconds: 0,
    t,
  });

describe('timerAnnouncement', () => {
  it('changes only at five-minute steps while counting down', () => {
    expect(countdown(25 * 60)).toBe('25 minutes left');
    expect(countdown(24 * 60 + 59)).toBe('25 minutes left');
    expect(countdown(20 * 60 + 1)).toBe('25 minutes left');
    expect(countdown(20 * 60)).toBe('20 minutes left');
    expect(countdown(2 * 60)).toBe('5 minutes left');
  });

  it('announces the last minute and stays silent once time is up', () => {
    expect(countdown(59)).toBe('Less than a minute left');
    expect(countdown(0)).toBe('');
  });

  it('counts focused time in five-minute steps for open-ended sessions', () => {
    const elapsed = (elapsedSeconds: number) =>
      timerAnnouncement({
        isDurationless: true,
        timeRemaining: 0,
        elapsedSeconds,
        t,
      });

    expect(elapsed(4 * 60)).toBe('');
    expect(elapsed(12 * 60)).toBe('10 minutes focused');
  });
});
