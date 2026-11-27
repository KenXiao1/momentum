import { translate } from '../../i18n/translate';
import type { Chain } from '../../types';
import type { IconName } from '../iconMap';

/**
 * The icon, colors and name for a chain's structure: a task group or a
 * single chain. Categories are tags now (see domain/chainTags), so the old
 * category values of `type` all look like a plain chain here.
 */
export const getChainTypeConfig = (
  type: Chain['type'],
  language: 'en' | 'zh' = 'en',
): { icon: IconName; color: string; bgColor: string; name: string } =>
  type === 'group'
    ? {
        icon: 'layers',
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        name: translate(language, 'chainTree.types.group'),
      }
    : {
        icon: 'link',
        color: 'text-gray-500',
        bgColor: 'bg-gray-500/10',
        name: translate(language, 'chainTree.types.unit'),
      };
