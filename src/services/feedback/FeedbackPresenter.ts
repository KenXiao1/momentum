/**
 * 反馈展示器
 * 负责显示各类反馈消息（错误、警告、信息、成功）
 */

import type { ExceptionRuleException } from '../../types';
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

    const feedbackMessage: FeedbackMessage = {
      id: messageId,
      type: 'error',
      title: this.formatter.getErrorTitle(error.type),
      message: userFriendlyMessage,
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
}
