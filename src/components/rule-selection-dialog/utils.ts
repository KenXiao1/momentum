import { type Translator } from '../../i18n';
import type { ActionType } from './types';

export function getActionDisplayName(
  actionType: ActionType,
  t: Translator,
): string {
  return actionType === 'pause'
    ? t('ruleSelectionDialog.pauseTimer')
    : t('ruleSelectionDialog.earlyCompletion');
}

export function getActionColorClass(actionType: ActionType): string {
  return actionType === 'pause'
    ? 'text-yellow-600 dark:text-yellow-400'
    : 'text-green-600 dark:text-green-400';
}

export function getActionBgClass(actionType: ActionType): string {
  return actionType === 'pause'
    ? 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30'
    : 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30';
}
