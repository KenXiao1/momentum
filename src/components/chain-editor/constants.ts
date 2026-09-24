import { translate } from '../../i18n/translate';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  BookOpen,
  Code,
  Coffee,
  Clock,
  Dumbbell,
  Headphones,
  Target,
} from 'lucide-react';

type PresetLanguage = 'en' | 'zh';

interface PresetTemplate {
  icon: LucideIcon;
  value: string;
  label: Record<PresetLanguage, string>;
  color: string;
}

export const CUSTOM_TRIGGER_VALUE = '自定义触发器';
export const CUSTOM_AUXILIARY_SIGNAL_VALUE = '自定义信号';

export const TRIGGER_TEMPLATES: PresetTemplate[] = [
  {
    icon: Headphones,
    value: '戴上降噪耳机',
    label: {
      zh: translate('zh', 'chainEditor.presets.trigger.headphones'),
      en: translate('en', 'chainEditor.presets.trigger.headphones'),
    },
    color: 'text-primary-500',
  },
  {
    icon: Code,
    value: '打开编程软件',
    label: {
      zh: translate('zh', 'chainEditor.presets.trigger.ide'),
      en: translate('en', 'chainEditor.presets.trigger.ide'),
    },
    color: 'text-green-500',
  },
  {
    icon: BookOpen,
    value: '坐到书房书桌前',
    label: {
      zh: translate('zh', 'chainEditor.presets.trigger.desk'),
      en: translate('en', 'chainEditor.presets.trigger.desk'),
    },
    color: 'text-blue-500',
  },
  {
    icon: Dumbbell,
    value: '换上运动服',
    label: {
      zh: translate('zh', 'chainEditor.presets.trigger.workoutClothes'),
      en: translate('en', 'chainEditor.presets.trigger.workoutClothes'),
    },
    color: 'text-red-500',
  },
  {
    icon: Coffee,
    value: '准备一杯咖啡',
    label: {
      zh: translate('zh', 'chainEditor.presets.trigger.coffee'),
      en: translate('en', 'chainEditor.presets.trigger.coffee'),
    },
    color: 'text-yellow-500',
  },
  {
    icon: Target,
    value: CUSTOM_TRIGGER_VALUE,
    label: {
      zh: translate('zh', 'chainEditor.presets.trigger.custom'),
      en: translate('en', 'chainEditor.presets.trigger.custom'),
    },
    color: 'text-gray-500',
  },
];

export const AUXILIARY_SIGNAL_TEMPLATES: PresetTemplate[] = [
  {
    icon: Target,
    value: '打响指',
    label: {
      zh: translate('zh', 'chainEditor.presets.signal.snapFingers'),
      en: translate('en', 'chainEditor.presets.signal.snapFingers'),
    },
    color: 'text-primary-500',
  },
  {
    icon: Clock,
    value: '设置手机闹钟',
    label: {
      zh: translate('zh', 'chainEditor.presets.signal.phoneAlarm'),
      en: translate('en', 'chainEditor.presets.signal.phoneAlarm'),
    },
    color: 'text-green-500',
  },
  {
    icon: Bell,
    value: '按桌上的铃铛',
    label: {
      zh: translate('zh', 'chainEditor.presets.signal.deskBell'),
      en: translate('en', 'chainEditor.presets.signal.deskBell'),
    },
    color: 'text-blue-500',
  },
  {
    icon: Coffee,
    value: '说"开始预约"',
    label: {
      zh: translate('zh', 'chainEditor.presets.signal.startBooking'),
      en: translate('en', 'chainEditor.presets.signal.startBooking'),
    },
    color: 'text-yellow-500',
  },
  {
    icon: Target,
    value: CUSTOM_AUXILIARY_SIGNAL_VALUE,
    label: {
      zh: translate('zh', 'chainEditor.presets.signal.custom'),
      en: translate('en', 'chainEditor.presets.signal.custom'),
    },
    color: 'text-gray-500',
  },
];

export const AUXILIARY_DURATION_PRESETS = [5, 10, 15, 20, 30, 45];
export const DURATION_PRESETS = [25, 30, 45, 60, 90, 120];

export const getTriggerLabel = (
  value: string,
  language: PresetLanguage,
): string => {
  const special: Partial<Record<string, Record<PresetLanguage, string>>> = {
    任务群容器: {
      zh: translate('zh', 'chainEditor.presets.trigger.taskGroupContainer'),
      en: translate('en', 'chainEditor.presets.trigger.taskGroupContainer'),
    },
    开始第一个子任务: {
      zh: translate('zh', 'chainEditor.presets.trigger.firstSubtask'),
      en: translate('en', 'chainEditor.presets.trigger.firstSubtask'),
    },
  };

  return (
    special[value]?.[language] ??
    TRIGGER_TEMPLATES.find((template) => template.value === value)?.label[
      language
    ] ??
    value
  );
};

export const getAuxiliarySignalLabel = (
  value: string,
  language: PresetLanguage,
): string => {
  return (
    AUXILIARY_SIGNAL_TEMPLATES.find((template) => template.value === value)
      ?.label[language] ?? value
  );
};
