export const LOCAL_STORAGE_KEYS = {
  // UI Preferences
  THEME: 'theme',
  LANGUAGE: 'language',
  NOTIFICATIONS_ENABLED: 'notifications_enabled',
  ERROR_REPORTING_ENABLED: 'momentum_error_reporting_enabled',
  DAILY_REMINDERS: 'momentum_daily_reminders',
  STORAGE_MODE: 'momentum_storage_mode',
  STORAGE_MODE_HINT_DISMISSED: 'momentum_storage_mode_hint_dismissed',

  // Ephemeral UI State
  RSIP_CANVAS_STATE: 'momentum:rsip-canvas-state',
  AUTO_RESUME: 'momentum_auto_resume',

  // Service Caches
  TIMER_PREFIX: 'momentum_timer_',
  EXCEPTION_RULES: 'momentum_exception_rules',
  EXCEPTION_RULES_USAGE: 'momentum_rule_usage_records',
  TASK_TIME_STATS: 'momentum_task_time_stats',
} as const;
