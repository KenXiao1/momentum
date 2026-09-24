import { type Translator } from '../../../i18n';
import {
  ExceptionRuleError,
  ExceptionRuleType,
  EnhancedExceptionRuleException,
} from '../../../types';
import type {
  ExceptionRule,
  PauseOptions,
  SessionContext,
} from '../../../types';
import { errorRecoveryManager } from '../../../services/ErrorRecoveryManager';
import { exceptionRuleManager } from '../../../services/ExceptionRuleManager';
import { userFeedbackHandler } from '../../../services/UserFeedbackHandler';
import { isDev } from '../../../utils/env';
import { toError } from '../../../utils/errorHandling';
import { logger } from '../../../utils/logger';

export type PendingActionType = 'pause' | 'early_completion';

type RecoveryResult = Awaited<
  ReturnType<typeof errorRecoveryManager.attemptRecovery>
>;

function isExceptionRule(value: unknown): value is ExceptionRule {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ExceptionRule>;
  return typeof candidate.id === 'string' && typeof candidate.name === 'string';
}

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

  async function applyRecoveredRule(
    recovery: RecoveryResult,
    operation: string,
    context: unknown,
  ): Promise<void> {
    if (!recovery.recoveredData || operation !== 'create_rule') return;
    if (isExceptionRule(recovery.recoveredData)) {
      await handleRuleSelected(recovery.recoveredData);
      return;
    }
    logger.warn('FOCUS_MODE', 'Recovery returned invalid rule data', {
      operation,
      context,
      recoveredData: recovery.recoveredData,
    });
  }

  async function handleEnhancedError(
    error: EnhancedExceptionRuleException,
    operation: string,
    context: unknown,
  ): Promise<void> {
    const messageId = userFeedbackHandler.showErrorMessage(error, context);
    const recovery = await errorRecoveryManager.attemptRecovery(
      error,
      context,
      operation,
    );
    if (!recovery.success) {
      if (recovery.requiresUserAction && recovery.actions) {
        logger.error('FOCUS_MODE', '需要用户操作的恢复失败', {
          recoveryResult: recovery,
          operation,
          context,
        });
      }
      return;
    }
    userFeedbackHandler.removeMessage(messageId);
    userFeedbackHandler.showSuccess(
      t('focusMode.useExceptionRuleOperations.issueResolved'),
      recovery.message,
    );
    await applyRecoveredRule(recovery, operation, context);
  }

  async function handleRuleError(
    error: unknown,
    operation: string,
    context: unknown,
  ): Promise<void> {
    try {
      if (error instanceof EnhancedExceptionRuleException) {
        await handleEnhancedError(error, operation, context);
        return;
      }
      userFeedbackHandler.showErrorMessage(
        new EnhancedExceptionRuleException(
          ExceptionRuleError.STORAGE_ERROR,
          error instanceof Error
            ? error.message
            : t('focusMode.useExceptionRuleOperations.unknownError'),
          context,
          true,
          [
            t('focusMode.useExceptionRuleOperations.retry'),
            t('focusMode.useExceptionRuleOperations.refresh'),
          ],
          'medium',
          t(
            'focusMode.useExceptionRuleOperations.operationFailedPleaseTryAgain',
          ),
        ),
        context,
      );
    } catch (handlingError) {
      logger.error(
        'FOCUS_MODE',
        '错误处理失败',
        { operation, context },
        toError(handlingError),
      );
      userFeedbackHandler.showWarning(
        t('focusMode.useExceptionRuleOperations.systemError'),
        t(
          'focusMode.useExceptionRuleOperations.somethingWentWrongWhileHandlingTheErrorRefreshThe',
        ),
      );
    }
  }

  async function handleRuleSelected(
    rule: ExceptionRule,
    pauseOptions?: PauseOptions,
  ): Promise<void> {
    if (!pendingActionType) return;
    if (isDev) {
      logger.debug('FOCUS_MODE', 'handleRuleSelected called', {
        pendingActionType,
        ruleId: rule?.id,
        rule,
      });
    }
    try {
      if (!rule?.id) {
        userFeedbackHandler.showErrorMessage(
          new EnhancedExceptionRuleException(
            ExceptionRuleError.RULE_NOT_FOUND,
            t('focusMode.useExceptionRuleOperations.invalidRule'),
            { rule, pendingActionType },
          ),
        );
        return;
      }
      userFeedbackHandler.showProgress(
        pendingActionType === 'pause'
          ? t('focusMode.useExceptionRuleOperations.pausingTask')
          : t('focusMode.useExceptionRuleOperations.completingTask'),
      );
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
        userFeedbackHandler.hideProgress();
        return;
      }
      userFeedbackHandler.hideProgress();
      const successMessage =
        pendingActionType === 'pause'
          ? t(
              'focusMode.useExceptionRuleOperations.appliedRuleRuleNameToPauseTheTask',
              { ruleName: rule.name },
            )
          : t(
              'focusMode.useExceptionRuleOperations.appliedRuleRuleNameToCompleteTheTask',
              { ruleName: rule.name },
            );
      userFeedbackHandler.showSuccess(
        t('focusMode.useExceptionRuleOperations.success'),
        successMessage,
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
      userFeedbackHandler.hideProgress();
      logger.error(
        'FOCUS_MODE',
        'Failed to use rule',
        { ruleId: rule.id, actionType: pendingActionType },
        toError(error),
      );
      await handleRuleError(error, 'use_rule', {
        rule,
        actionType: pendingActionType,
      });
    }
  }

  async function handleCreateNewRule(
    name: string,
    type: ExceptionRuleType,
  ): Promise<void> {
    try {
      if (!name.trim()) {
        userFeedbackHandler.showErrorMessage(
          new EnhancedExceptionRuleException(
            ExceptionRuleError.VALIDATION_ERROR,
            t('focusMode.useExceptionRuleOperations.ruleNameCannotBeEmpty'),
            { name, type },
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
      userFeedbackHandler.showProgress(
        t('focusMode.useExceptionRuleOperations.creatingRule'),
        0,
      );
      userFeedbackHandler.updateProgress(
        30,
        t('focusMode.useExceptionRuleOperations.validating'),
      );
      const duplicateCheck =
        await exceptionRuleManager.checkRuleNameRealTime(name);
      const suggestion = duplicateCheck.suggestions?.[0]?.type;
      const userChoice =
        suggestion === 'use_existing' ||
        suggestion === 'modify_name' ||
        suggestion === 'create_anyway'
          ? suggestion
          : undefined;
      if (duplicateCheck.hasConflict) {
        userFeedbackHandler.hideProgress();
        userFeedbackHandler.showProgress(
          t('focusMode.useExceptionRuleOperations.creatingRule'),
          50,
        );
      }
      userFeedbackHandler.updateProgress(
        70,
        t('focusMode.useExceptionRuleOperations.saving'),
      );
      const result = await exceptionRuleManager.createRule(
        name,
        validType,
        undefined,
        userChoice,
      );
      userFeedbackHandler.hideProgress();
      userFeedbackHandler.showSuccess(
        t('focusMode.useExceptionRuleOperations.ruleCreated'),
        t(
          'focusMode.useExceptionRuleOperations.ruleResultRuleNameHasBeenCreatedAndApplied',
          { resultRuleName: result.rule.name },
        ),
      );
      if (result.warnings?.length) {
        userFeedbackHandler.showWarning(
          t('focusMode.useExceptionRuleOperations.notes'),
          result.warnings.join('\n'),
        );
      }
      await handleRuleSelected(result.rule);
    } catch (error) {
      userFeedbackHandler.hideProgress();
      logger.error(
        'FOCUS_MODE',
        '创建规则失败',
        { name, type },
        toError(error),
      );
      await handleRuleError(error, 'create_rule', { name, type });
    }
  }

  return { handleRuleSelected, handleCreateNewRule };
}
