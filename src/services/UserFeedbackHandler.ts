/**
 * 用户反馈处理器
 * 提供用户友好的错误信息显示和操作反馈
 *
 * 这是一个门面类，整合了以下模块：
 * - MessageStore: 消息存储和监听器管理
 * - ErrorMessageFormatter: 错误消息格式化
 * - FeedbackPresenter: 反馈展示
 */

import { ExceptionRuleException } from '../types';
import {
  MessageStore,
  ErrorMessageFormatter,
  FeedbackPresenter,
  type FeedbackMessage,
  type FeedbackAction,
  type ProgressInfo,
  type MessageListener,
  type ProgressListener,
} from './feedback';

export type { FeedbackMessage, FeedbackAction, ProgressInfo };

class UserFeedbackHandler {
  private readonly store: MessageStore;
  private readonly formatter: ErrorMessageFormatter;
  private readonly presenter: FeedbackPresenter;

  constructor() {
    this.store = new MessageStore();
    this.formatter = new ErrorMessageFormatter();
    this.presenter = new FeedbackPresenter(this.store, this.formatter);
  }

  showErrorMessage(error: ExceptionRuleException, context?: unknown): string {
    return this.presenter.showErrorMessage(error, context);
  }

  showWarning(
    title: string,
    message: string,
    actions?: FeedbackAction[],
  ): string {
    return this.presenter.showWarning(title, message, actions);
  }

  showInfo(title: string, message: string, autoHide: boolean = true): string {
    return this.presenter.showInfo(title, message, autoHide);
  }

  showSuccess(
    title: string,
    message: string,
    autoHide: boolean = true,
  ): string {
    return this.presenter.showSuccess(title, message, autoHide);
  }

  showProgress(operation: string, progress?: number, message?: string): void {
    this.presenter.showProgress(operation, progress, message);
  }

  hideProgress(): void {
    this.presenter.hideProgress();
  }

  updateProgress(progress: number, message?: string): void {
    this.presenter.updateProgress(progress, message);
  }

  removeMessage(messageId: string): void {
    this.store.removeMessage(messageId);
  }

  clearMessages(): void {
    this.store.clearMessages();
  }

  clearMessagesByType(type: FeedbackMessage['type']): void {
    this.store.clearMessagesByType(type);
  }

  getAllMessages(): FeedbackMessage[] {
    return this.store.getAllMessages();
  }

  onMessagesChange(listener: MessageListener): () => void {
    return this.store.onMessagesChange(listener);
  }

  onProgressChange(listener: ProgressListener): () => void {
    return this.store.onProgressChange(listener);
  }
}

export const userFeedbackHandler = new UserFeedbackHandler();
