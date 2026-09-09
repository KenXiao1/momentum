import type { Chain } from '../types';
import { formatTime } from './time';

export function formatChainDuration(
  chain: Chain,
  language: 'zh' | 'en',
): string {
  if (!chain.isDurationless && chain.duration !== 0)
    return formatTime(chain.duration, language);
  const label = language === 'zh' ? '无固定时长' : 'No fixed duration';
  if (!chain.minimumDuration) return label;
  const minimum = formatTime(chain.minimumDuration, language);
  return language === 'zh'
    ? `${label}（至少 ${minimum}）`
    : `${label} (minimum ${minimum})`;
}
