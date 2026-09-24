import { translate } from '../i18n/translate';
import type { Chain } from '../types';
import { formatTime } from './time';

export function formatChainDuration(
  chain: Chain,
  language: 'zh' | 'en',
): string {
  if (!chain.isDurationless && chain.duration !== 0)
    return formatTime(chain.duration, language);
  const label = translate(language, 'time.noFixedDuration');
  if (!chain.minimumDuration) return label;
  const minimum = formatTime(chain.minimumDuration, language);
  return translate(language, 'time.minimumDuration', { label, minimum });
}
