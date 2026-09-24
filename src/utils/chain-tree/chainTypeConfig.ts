import { translate } from '../../i18n/translate';
import type { Chain } from '../../types';
import type { IconName } from '../iconMap';

/**
 * 根据类型获取对应的图标和颜色
 */
export const getChainTypeConfig = (
  type: Chain['type'],
  language: 'en' | 'zh' = 'en',
): { icon: IconName; color: string; bgColor: string; name: string } => {
  const configs: Record<
    Chain['type'],
    { icon: IconName; color: string; bgColor: string }
  > = {
    unit: { icon: 'link', color: 'text-gray-500', bgColor: 'bg-gray-500/10' },
    group: {
      icon: 'layers',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    assault: { icon: 'zap', color: 'text-red-500', bgColor: 'bg-red-500/10' },
    recon: {
      icon: 'search',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    command: {
      icon: 'crown',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    special_ops: {
      icon: 'wrench',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    engineering: {
      icon: 'dumbbell',
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    quartermaster: {
      icon: 'utensils',
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
    },
  };

  const names: Record<'en' | 'zh', Record<Chain['type'], string>> = {
    en: {
      unit: translate('en', 'chainTree.types.unit'),
      group: translate('en', 'chainTree.types.group'),
      assault: translate('en', 'chainTree.types.assault'),
      recon: translate('en', 'chainTree.types.recon'),
      command: translate('en', 'chainTree.types.command'),
      special_ops: translate('en', 'chainTree.types.special_ops'),
      engineering: translate('en', 'chainTree.types.engineering'),
      quartermaster: translate('en', 'chainTree.types.quartermaster'),
    },
    zh: {
      unit: translate('zh', 'chainTree.types.unit'),
      group: translate('zh', 'chainTree.types.group'),
      assault: translate('zh', 'chainTree.types.assault'),
      recon: translate('zh', 'chainTree.types.recon'),
      command: translate('zh', 'chainTree.types.command'),
      special_ops: translate('zh', 'chainTree.types.special_ops'),
      engineering: translate('zh', 'chainTree.types.engineering'),
      quartermaster: translate('zh', 'chainTree.types.quartermaster'),
    },
  };

  const resolvedConfig = configs[type] || configs.unit;
  const resolvedName =
    names[language]?.[type] || names[language]?.unit || names.en.unit;

  return { ...resolvedConfig, name: resolvedName };
};
