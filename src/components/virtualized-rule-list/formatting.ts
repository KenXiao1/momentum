import { translate } from '../../i18n/translate';
import { type Translator } from '../../i18n';
type Tr = Translator;

export function formatLastUsed(date: Date, language: string, t: Tr): string {
  const now = new Date();
  const diffHours = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60),
  );

  if (diffHours < 1) return t('virtualizedRuleList.formatting.justNow');
  if (diffHours < 24)
    return translate(
      language === 'zh' ? 'zh' : 'en',
      'virtualizedRuleList.formatting.diffHoursHAgo',
      { diffHours: diffHours },
    );
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return t('ruleItem.yesterday');
  if (diffDays < 7)
    return translate(language === 'zh' ? 'zh' : 'en', 'ruleItem.diffDaysDAgo', {
      diffDays: diffDays,
    });
  const weeks = Math.floor(diffDays / 7);
  return translate(language === 'zh' ? 'zh' : 'en', 'ruleItem.weeksWAgo', {
    weeks: weeks,
  });
}

export function getMatchTypeLabel(matchType: string, t: Tr): string {
  switch (matchType) {
    case 'prefix':
      return t('virtualizedRuleList.formatting.prefixMatch');
    case 'contains':
      return t('virtualizedRuleList.formatting.containsMatch');
    case 'fuzzy':
      return t('virtualizedRuleList.formatting.fuzzyMatch');
    default:
      return '';
  }
}
