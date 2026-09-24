import { type Translator } from '../../../i18n';
import type { RSIPTaskLink } from '../../../types';

export type TaskLinkMode = 'task_to_rsip' | 'rsip_to_task';
export type Tr = Translator;

export const EVENTS: Record<TaskLinkMode, RSIPTaskLink['triggerEvent'][]> = {
  task_to_rsip: ['task_completed', 'task_interrupted', 'group_cycle_completed'],
  rsip_to_task: ['rsip_mark_executed'],
};
export const EFFECTS: Record<TaskLinkMode, RSIPTaskLink['effect'][]> = {
  task_to_rsip: ['mark_rsip_executed', 'mark_rsip_violated'],
  rsip_to_task: ['prompt_start_chain', 'prompt_schedule_chain'],
};

export function eventLabel(event: RSIPTaskLink['triggerEvent'], t: Tr) {
  if (event === 'task_completed')
    return t('rsip.taskLink.taskLinkUi.taskCompleted');
  if (event === 'task_interrupted')
    return t('rsip.taskLink.taskLinkUi.taskInterrupted');
  if (event === 'group_cycle_completed')
    return t('rsip.taskLink.taskLinkUi.groupCycleCompleted');
  return t('rsip.taskLink.taskLinkUi.rsipMarkedExecuted');
}

export function effectLabel(effect: RSIPTaskLink['effect'], t: Tr) {
  if (effect === 'mark_rsip_executed')
    return t('rsip.taskLink.taskLinkUi.markRsipExecuted');
  if (effect === 'mark_rsip_violated')
    return t('rsip.taskLink.taskLinkUi.markRsipViolated');
  if (effect === 'prompt_start_chain')
    return t('rsip.taskLink.taskLinkUi.promptStartTask');
  return t('rsip.taskLink.taskLinkUi.promptScheduleTask');
}

export function automationLabel(automation: RSIPTaskLink['automation'], t: Tr) {
  return automation === 'auto'
    ? t('rsip.taskLink.taskLinkUi.auto')
    : t('rsip.taskLink.taskLinkUi.confirm');
}
