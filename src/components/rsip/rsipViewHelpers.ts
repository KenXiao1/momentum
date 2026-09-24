import { translate } from '../../i18n/translate';
export interface SplitDraftItem {
  id: string;
  title: string;
  rule: string;
  isPassive: boolean;
}

export function getSplitTemplates(
  language: string,
): Record<string, { goal: string; items: SplitDraftItem[] }> {
  const locale = language.startsWith('zh') ? 'zh' : 'en';

  return {
    sleep: {
      goal: translate(locale, 'rsip.splitTemplate.message1'),
      items: [
        {
          id: 'sleep-1',
          title: translate(locale, 'rsip.splitTemplate.message2'),
          rule: translate(locale, 'rsip.splitTemplate.message3'),
          isPassive: false,
        },
        {
          id: 'sleep-2',
          title: translate(locale, 'rsip.splitTemplate.message4'),
          rule: translate(locale, 'rsip.splitTemplate.message5'),
          isPassive: true,
        },
      ],
    },
    exercise: {
      goal: translate(locale, 'rsip.splitTemplate.message6'),
      items: [
        {
          id: 'exercise-1',
          title: translate(locale, 'rsip.splitTemplate.message7'),
          rule: translate(locale, 'rsip.splitTemplate.message8'),
          isPassive: false,
        },
        {
          id: 'exercise-2',
          title: translate(locale, 'rsip.splitTemplate.message9'),
          rule: translate(locale, 'rsip.splitTemplate.message10'),
          isPassive: false,
        },
      ],
    },
    diet: {
      goal: translate(locale, 'rsip.splitTemplate.message11'),
      items: [
        {
          id: 'diet-1',
          title: translate(locale, 'rsip.splitTemplate.message12'),
          rule: translate(locale, 'rsip.splitTemplate.message13'),
          isPassive: true,
        },
        {
          id: 'diet-2',
          title: translate(locale, 'rsip.splitTemplate.message14'),
          rule: translate(locale, 'rsip.splitTemplate.message15'),
          isPassive: false,
        },
      ],
    },
  };
}
