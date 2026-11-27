import { type Translator } from '../../i18n';
/**
 * ChainDetail 组件共享类型定义
 */

import { Chain, ChainTag, CompletionHistory } from '../../types';
import type { ActivityCalendar } from '../../domain/activityCalendar';
import type { HourBucket, StreakPoint } from '../../domain/completionStats';

export type TranslationFn = Translator;

export interface ChainDetailViewProps {
  chain: Chain;
  recentHistory: CompletionHistory[];
  activity: ActivityCalendar;
  hours: HourBucket[];
  streak: StreakPoint[];
  reminder: ReminderSettings;
  tags: ChainTag[];
  chainHistoryCount: number;
  successRate: number;
  showDeleteConfirm: boolean;
  language: 'zh' | 'en';
  locale: string;
  t: TranslationFn;
  formatFailureReason: (reason: string) => string;
  onBack: () => void;
  onEdit: () => void;
  onDeleteClick: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}

export interface ReminderSettings {
  /** `HH:MM`, or `null` while no daily reminder is set on this device. */
  time: string | null;
  /** How this platform delivers reminders; `none` hides the setting. */
  support: 'native' | 'web' | 'none';
  /** Notifications are turned on and permitted. */
  canNotify: boolean;
  onChange: (time: string | null) => void;
}

export interface HeaderProps {
  chainName: string;
  tags: ChainTag[];
  t: TranslationFn;
  onBack: () => void;
  onEdit: () => void;
  onDeleteClick: () => void;
}

export interface MainStatsProps {
  chain: Chain;
  successRate: number;
  language: 'zh' | 'en';
  t: TranslationFn;
}

export interface StatRowProps {
  label: string;
  value: string | number;
  mono?: boolean;
  success?: boolean;
  danger?: boolean;
  blue?: boolean;
}

export interface ExceptionsSectionProps {
  chain: Chain;
  t: TranslationFn;
}

export interface DescriptionSectionProps {
  description: string;
  t: TranslationFn;
}

export interface HistorySectionProps {
  recentHistory: CompletionHistory[];
  locale: string;
  language: 'zh' | 'en';
  t: TranslationFn;
  formatFailureReason: (reason: string) => string;
}

export interface HistoryRecordProps {
  record: CompletionHistory;
  locale: string;
  language: 'zh' | 'en';
  t: TranslationFn;
  formatFailureReason: (reason: string) => string;
}

export interface DeleteConfirmModalProps {
  chain: Chain;
  chainHistoryCount: number;
  successRate: number;
  language: 'zh' | 'en';
  t: TranslationFn;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface DeleteDataSummaryProps {
  chain: Chain;
  chainHistoryCount: number;
  successRate: number;
  language: 'zh' | 'en';
  t: TranslationFn;
}

export interface DeleteDataCardProps {
  icon: React.ReactNode;
  title: string;
  items: Array<{ label: string; value: string | number; isChinese?: boolean }>;
}
