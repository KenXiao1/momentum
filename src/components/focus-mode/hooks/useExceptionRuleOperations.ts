import { type Translator } from '../../../i18n';
import {
  ExceptionRuleError,
  ExceptionRuleType,
  ExceptionRuleException,
} from '../../../types';
import type {
  ExceptionRule,
  PauseOptions,
  SessionContext,
} from '../../../types';
import { exceptionRuleManager } from '../../../services/exception-rule-manager/ExceptionRuleManager';
import { isDev } from '../../../utils/env';
import { toError } from '../../../utils/errorMessage';
import { logger } from '../../../utils/logger';
import { toast } from '../../../utils/toast';
import { describeRuleError } from './ruleErrorMessage';

export type PendingActionType = 'pause' | 'early_completion';

export function useExceptionRuleOperations(params: {
  pendingActionType: PendingActionType | null;
  sessionContext: SessionContext;
  onPause: (duration?: number) => void | Promise<boolean | void>;
  onRequestCompletionDialog: () => void;
  scheduleAutoResume: (minutes: number) => void;
  clearAutoResumeSchedule: () => void;
  onRuleUsed?: (
    rule: ExceptionRule,
    actionType: PendingActionType,
    pauseOptions?: PauseOptions,
  ) => void;
  finishFlow: () => void;
  t: Translator;
}) {
  const { pendingActionType, sessionContext, t } = params;

  function showRuleError(error: unknown): void {
    const { title, message } = describeRuleError(error, t);
    toast.error(message, { title });
  }

  async function handleRuleSelected(
    rule: ExceptionRule,
    pauseOptions?: PauseOptions,
  ): Promise<void> {
    if (!pendingActionType) return;
    if (isDev) {
      logger.debug('FOCUS_MODE', 'handleRuleSelected called', {
        pendingActionType,
        ruleId: rule.id,
      });
    }
    try {
      // Stored rules are not id-validated when read back.
      if (!rule.id) {
        showRuleError(
          new ExceptionRuleException(
            ExceptionRuleError.RULE_NOT_FOUND,
            t('focusMode.useExceptionRuleOperations.invalidRule'),
          ),
        );
        return;
      }
      await exceptionRuleManager.useRule(
        rule.id,
        sessionContext,
        pendingActionType,
        pauseOptions,
      );
      if (
        pendingActionType === 'pause' &&
        (await params.onPause(pauseOptions?.duration)) === false
      ) {
        return;
      }
      toast.success(
        pendingActionType === 'pause'
          ? t(
              'focusMode.useExceptionRuleOperations.appliedRuleRuleNameToPauseTheTask',
              { ruleName: rule.name },
            )
          : t(
              'focusMode.useExceptionRuleOperations.appliedRuleRuleNameToCompleteTheTask',
              { ruleName: rule.name },
            ),
        { title: t('focusMode.useExceptionRuleOperations.success') },
      );
      params.onRuleUsed?.(rule, pendingActionType, pauseOptions);

      if (pendingActionType === 'pause') {
        if (pauseOptions?.duration && pauseOptions.autoResume) {
          params.scheduleAutoResume(Math.floor(pauseOptions.duration / 60));
        }
      } else {
        params.clearAutoResumeSchedule();
        params.finishFlow();
        params.onRequestCompletionDialog();
        return;
      }
      params.finishFlow();
    } catch (error) {
      logger.error(
        'FOCUS_MODE',
        'Failed to use rule',
        { ruleId: rule.id, actionType: pendingActionType },
        toError(error),
      );
      showRuleError(error);
    }
  }

  async function handleCreateNewRule(
    name: string,
    type: ExceptionRuleType,
  ): Promise<void> {
    try {
      if (!name.trim()) {
        showRuleError(
          new ExceptionRuleException(
            ExceptionRuleError.VALIDATION_ERROR,
            t('focusMode.useExceptionRuleOperations.ruleNameCannotBeEmpty'),
          ),
        );
        return;
      }
      let validType = type;
      if (!Object.values(ExceptionRuleType).includes(validType)) {
        validType =
          pendingActionType === 'pause'
            ? ExceptionRuleType.PAUSE_ONLY
            : ExceptionRuleType.EARLY_COMPLETION_ONLY;
      }
      const result = await exceptionRuleManager.createRule(
        name,
        validType,
        undefined,
        { reuseExisting: true },
      );
      toast.success(
        t(
          'focusMode.useExceptionRuleOperations.ruleResultRuleNameHasBeenCreatedAndApplied',
          { resultRuleName: result.rule.name },
        ),
        { title: t('focusMode.useExceptionRuleOperations.ruleCreated') },
      );
      if (result.warnings.length > 0) {
        toast.warning(result.warnings.join('\n'), {
          title: t('focusMode.useExceptionRuleOperations.notes'),
        });
      }
      await handleRuleSelected(result.rule);
    } catch (error) {
      logger.error(
        'FOCUS_MODE',
        '创建规则失败',
        { name, type },
        toError(error),
      );
      showRuleError(error);
    }
  }

  return { handleRuleSelected, handleCreateNewRule };
}
