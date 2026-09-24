/**
 * 反馈展示器
 * 负责显示各类反馈消息（错误、警告、信息、成功）
 */

import { ExceptionRuleError, ExceptionRuleException } from '../../types';
import { errorRecoveryManager, RecoveryAction } from '../ErrorRecoveryManager';
import { getSafeErrorDetail } from '../../utils/errorMessage';
import { getCurrentLanguage, t } from '../../utils/runtimeI18n';
import { ignoreUnused } from '../../utils/ignoreUnused';
import { MessageStore } from './MessageStore';
import { ErrorMessageFormatter } from './ErrorMessageFormatter';
import type { FeedbackMessage, FeedbackAction, ProgressInfo } from './types';

export class FeedbackPresenter {
  constructor(
    private readonly store: MessageStore,
    private readonly formatter: ErrorMessageFormatter,
  ) {}

  showErrorMessage(error: ExceptionRuleException, context?: unknown): string {
    ignoreUnused(context);
    const messageId = this.store.generateMessageId();
    const userFriendlyMessage = this.formatter.getUserFriendlyMessage(error);
    const recoveryActions = errorRecoveryManager.getRecoveryOptions(error);

    const feedbackMessage: FeedbackMessage = {
      id: messageId,
      type: 'error',
      title: this.formatter.getErrorTitle(error.type),
      message: userFriendlyMessage,
      actions: this.convertRecoveryActionsToFeedbackActions(recoveryActions),
      persistent: true,
      timestamp: new Date(),
    };

    this.store.addMessage(feedbackMessage);
    return messageId;
  }

  showWarning(
    title: string,
    message: string,
    actions?: FeedbackAction[],
  ): string {
    const messageId = this.store.generateMessageId();

    const feedbackMessage: FeedbackMessage = {
      id: messageId,
      type: 'warning',
      title,
      message,
      actions,
      autoHide: true,
      duration: 8000,
      timestamp: new Date(),
    };

    this.store.addMessage(feedbackMessage);
    return messageId;
  }

  showInfo(title: string, message: string, autoHide: boolean = true): string {
    const messageId = this.store.generateMessageId();

    const feedbackMessage: FeedbackMessage = {
      id: messageId,
      type: 'info',
      title,
      message,
      autoHide,
      duration: autoHide ? 5000 : undefined,
      timestamp: new Date(),
    };

    this.store.addMessage(feedbackMessage);
    return messageId;
  }

  showSuccess(
    title: string,
    message: string,
    autoHide: boolean = true,
  ): string {
    const messageId = this.store.generateMessageId();

    const feedbackMessage: FeedbackMessage = {
      id: messageId,
      type: 'success',
      title,
      message,
      autoHide,
      duration: autoHide ? 3000 : undefined,
      timestamp: new Date(),
    };

    this.store.addMessage(feedbackMessage);
    return messageId;
  }

  showProgress(operation: string, progress?: number, message?: string): void {
    this.store.setProgress({
      operation,
      progress,
      message,
      isIndeterminate: progress === undefined,
    });
  }

  hideProgress(): void {
    this.store.setProgress(null);
  }

  updateProgress(progress: number, message?: string): void {
    this.store.updateProgress(progress, message);
  }

  getProgress(): ProgressInfo | null {
    return this.store.getProgress();
  }

  private convertRecoveryActionsToFeedbackActions(
    recoveryActions: RecoveryAction[],
  ): FeedbackAction[] {
    return recoveryActions.map((action) => ({
      id: action.id,
      label: action.label,
      type: action.type,
      handler: async () => {
        try {
          this.showProgress(action.description);
          const result = await action.handler();
          this.hideProgress();

          if (result.success) {
            this.showSuccess(
              t('focusMode.useExceptionRuleOperations.success'),
              result.message,
            );
          } else {
            this.showWarning(
              t('feedback.feedbackPresenter.notCompleted'),
              result.message,
            );
          }
        } catch (error) {
          this.hideProgress();
          const language = getCurrentLanguage();

          if (error instanceof ExceptionRuleException) {
            this.showErrorMessage(error);
            return;
          }

          let message = t(
            'feedback.errorMessageFormatter.operationFailed',
            undefined,
            language,
          );
          if (error instanceof Error) {
            message = getSafeErrorDetail(error.message, language) ?? message;
          }

          this.showErrorMessage(
            new ExceptionRuleException(
              ExceptionRuleError.STORAGE_ERROR,
              message,
            ),
          );
        }
      },
    }));
  }
}
