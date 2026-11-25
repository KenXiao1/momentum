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
      goal: translate(locale, 'rsip.splitTemplate.sleep.goal'),
      items: [
        {
          id: 'sleep-1',
          title: translate(locale, 'rsip.splitTemplate.sleep.bedtime.title'),
          rule: translate(locale, 'rsip.splitTemplate.sleep.bedtime.rule'),
          isPassive: false,
        },
        {
          id: 'sleep-2',
          title: translate(locale, 'rsip.splitTemplate.sleep.noScreen.title'),
          rule: translate(locale, 'rsip.splitTemplate.sleep.noScreen.rule'),
          isPassive: true,
        },
      ],
    },
    exercise: {
      goal: translate(locale, 'rsip.splitTemplate.exercise.goal'),
      items: [
        {
          id: 'exercise-1',
          title: translate(
            locale,
            'rsip.splitTemplate.exercise.changeClothes.title',
          ),
          rule: translate(
            locale,
            'rsip.splitTemplate.exercise.changeClothes.rule',
          ),
          isPassive: false,
        },
        {
          id: 'exercise-2',
          title: translate(
            locale,
            'rsip.splitTemplate.exercise.minimumDose.title',
          ),
          rule: translate(
            locale,
            'rsip.splitTemplate.exercise.minimumDose.rule',
          ),
          isPassive: false,
        },
      ],
    },
    diet: {
      goal: translate(locale, 'rsip.splitTemplate.diet.goal'),
      items: [
        {
          id: 'diet-1',
          title: translate(locale, 'rsip.splitTemplate.diet.mealPrep.title'),
          rule: translate(locale, 'rsip.splitTemplate.diet.mealPrep.rule'),
          isPassive: true,
        },
        {
          id: 'diet-2',
          title: translate(locale, 'rsip.splitTemplate.diet.snackCutoff.title'),
          rule: translate(locale, 'rsip.splitTemplate.diet.snackCutoff.rule'),
          isPassive: false,
        },
      ],
    },
  };
}
