import { translate } from '../../../i18n/translate';
import { type Translator } from '../../../i18n';
import type { Language } from '../../../i18n';

export function formatDeletedTime(params: {
  deletedAt: Date;
  language: Language;
  t: Translator;
}): string {
  const { deletedAt, language, t } = params;

  const now = new Date();
  const diffMs = now.getTime() - deletedAt.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) {
    return diffDays === 1
      ? translate(language, 'time.dayAgo', { count: diffDays })
      : translate(language, 'time.daysAgo', { count: diffDays });
  }
  if (diffHours > 0) {
    return diffHours === 1
      ? translate(language, 'time.hourAgo', { count: diffHours })
      : translate(language, 'time.hoursAgo', { count: diffHours });
  }
  if (diffMinutes > 0) {
    return translate(
      language === 'zh' ? 'zh' : 'en',
      'recycleBinModal.timeFormat.diffMinutesMinAgo',
      { diffMinutes: diffMinutes },
    );
  }

  return t('recycleBinModal.timeFormat.justNow');
}
