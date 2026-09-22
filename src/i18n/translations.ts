export type Language = 'en' | 'zh';

const enTranslations = {
  'sessions.pauseResume.saveFailed':
    'Pause or resume was not saved. Please try again.',
  'chainEditor.description.title': 'Task description',
  'chainEditor.description.hint':
    'Describe what you will do and what success looks like',
  'chainEditor.description.placeholder':
    'What exactly will you do? e.g. Finish Part 1 of CS61A',
  'common.loading': 'Loading…',
  'common.back': 'Back',
  'chainEditor.editTitle': 'Edit chain',
  'chainEditor.createTitle': 'Create a new chain',
  'chainEditor.editSubtitle': 'EDIT CHAIN',
  'chainEditor.createSubtitle': 'CREATE CHAIN',
  'language.english': 'English',
  'language.chinese': 'Chinese',

  'settings.diagnostics.title': 'Local diagnostics',
  'settings.diagnostics.description':
    'Up to 200 error categories and timing measurements from the last 7 days stay on this device. No account details, task content, URLs, or raw errors are included. Nothing is sent automatically.',
  'settings.diagnostics.export': 'Export diagnostics',
  'settings.diagnostics.clear': 'Clear diagnostics',
  'settings.diagnostics.saved': 'Diagnostics exported.',
  'settings.diagnostics.failed': 'Export failed. Please try again.',
  'settings.diagnostics.cleared': 'Diagnostics cleared.',
  'settings.title': 'Personal Settings',
  'settings.button': 'Settings',
  'settings.language.title': 'Language',
  'settings.language.description': 'Choose the display language',
  'dashboard.hero.nextStep': 'Choose a chain and begin',
} as const;

export type TranslationKey = keyof typeof enTranslations;

const zhTranslations = {
  'sessions.pauseResume.saveFailed': '暂停或恢复尚未保存，请重试。',
  'chainEditor.description.title': '任务描述',
  'chainEditor.description.hint': '详细描述任务内容和目标',
  'chainEditor.description.placeholder':
    '具体要做什么？例如：完成 CS61A 项目的第一部分',
  'common.loading': '加载中…',
  'common.back': '返回',
  'chainEditor.editTitle': '编辑链条',
  'chainEditor.createTitle': '创建新链条',
  'chainEditor.editSubtitle': '编辑链条',
  'chainEditor.createSubtitle': '创建链条',
  'language.english': '英文',
  'language.chinese': '中文',

  'settings.diagnostics.title': '本地诊断',
  'settings.diagnostics.description':
    '仅在此设备保留最近 7 天最多 200 条错误类别和耗时记录，不含账号信息、任务内容、网址或错误原文，不会自动发送。',
  'settings.diagnostics.export': '导出诊断',
  'settings.diagnostics.clear': '清除诊断',
  'settings.diagnostics.saved': '诊断已导出。',
  'settings.diagnostics.failed': '导出失败，请重试。',
  'settings.diagnostics.cleared': '诊断已清除。',
  'settings.title': '个人设置',
  'settings.button': '设置',
  'settings.language.title': '语言',
  'settings.language.description': '选择界面显示语言',
  'dashboard.hero.nextStep': '选择一条任务链开始',
} satisfies Record<TranslationKey, string>;

export const translations = {
  en: enTranslations,
  zh: zhTranslations,
} satisfies Record<Language, Record<TranslationKey, string>>;
