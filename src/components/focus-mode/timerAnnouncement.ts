import type { Translator } from '../../i18n';

/**
 * Text for screen readers that changes only every five minutes (and in the
 * last minute), so the countdown is announced without reading every second.
 */
export function timerAnnouncement({
  isDurationless,
  timeRemaining,
  elapsedSeconds,
  t,
}: {
  isDurationless: boolean;
  timeRemaining: number;
  elapsedSeconds: number;
  t: Translator;
}): string {
  if (isDurationless) {
    const minutes = Math.floor(elapsedSeconds / 60 / 5) * 5;
    return minutes > 0
      ? t('focusMode.timerAnnouncement.elapsed', { minutes })
      : '';
  }
  const minutes = Math.ceil(timeRemaining / 60);
  if (minutes <= 0) return '';
  if (minutes === 1) return t('focusMode.timerAnnouncement.lastMinute');
  return t('focusMode.timerAnnouncement.remaining', {
    minutes: Math.ceil(minutes / 5) * 5,
  });
}
