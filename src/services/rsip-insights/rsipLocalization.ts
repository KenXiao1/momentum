import { translate } from '../../i18n/translate';
import type { RSIPInsightsLocale } from './rsipInsightsTypes';

export function toLocale(locale?: string): RSIPInsightsLocale {
  if (typeof locale === 'string' && locale.toLowerCase().startsWith('zh')) {
    return 'zh';
  }
  return 'en';
}

export function joinList(values: string[], locale: RSIPInsightsLocale): string {
  return values.join(translate(locale, 'rsipInsights.listSeparator'));
}
