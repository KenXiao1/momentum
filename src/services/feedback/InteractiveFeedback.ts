import { translate } from '../../i18n/translate';
/**
 * 交互式反馈
 * 负责确认对话框、恢复选项、批量操作反馈
 */

import type { RecoveryAction } from '../ErrorRecoveryManager';
import { getCurrentLanguage, t } from '../../utils/runtimeI18n';
import { MessageStore } from './MessageStore';
import { FeedbackPresenter } from './FeedbackPresenter';
import type { FeedbackMessage, FeedbackAction } from './types';

export class InteractiveFeedback {
  constructor(
    private readonly store: MessageStore,
    private readonly presenter: FeedbackPresenter,
  ) {}

  async showRecoveryOptions(
    options: RecoveryAction[],
  ): Promise<RecoveryAction | null> {
    return new Promise((resolve) => {
      const messageId = this.store.generateMessageId();

      const actions: FeedbackAction[] = options.map((option) => ({
        id: option.id,
        label: option.label,
        type: option.type,
        handler: async () => {
          this.store.removeMessage(messageId);
          resolve(option);
        },
      }));

      actions.push({
        id: 'cancel',
        label: t('bettingModal.bettingFormSections.cancel'),
        type: 'secondary',
        handler: () => {
          this.store.removeMessage(messageId);
          resolve(null);
        },
      });

      const feedbackMessage: FeedbackMessage = {
        id: messageId,
        type: 'warning',
        title: t('feedback.interactiveFeedback.chooseARecoveryAction'),
        message: t('feedback.interactiveFeedback.chooseHowToHandleThisIssue'),
        actions,
        persistent: true,
        timestamp: new Date(),
      };

      this.store.addMessage(feedbackMessage);
    });
  }

  async showConfirmation(
    title: string,
    message: string,
    confirmLabel?: string,
    cancelLabel?: string,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const messageId = this.store.generateMessageId();
      const finalConfirmLabel =
        confirmLabel ?? t('feedback.interactiveFeedback.confirm');
      const finalCancelLabel =
        cancelLabel ?? t('bettingModal.bettingFormSections.cancel');

      const actions: FeedbackAction[] = [
        {
          id: 'confirm',
          label: finalConfirmLabel,
          type: 'primary',
          handler: () => {
            this.store.removeMessage(messageId);
            resolve(true);
          },
        },
        {
          id: 'cancel',
          label: finalCancelLabel,
          type: 'secondary',
          handler: () => {
            this.store.removeMessage(messageId);
            resolve(false);
          },
        },
      ];

      const feedbackMessage: FeedbackMessage = {
        id: messageId,
        type: 'warning',
        title,
        message,
        actions,
        persistent: true,
        timestamp: new Date(),
      };

      this.store.addMessage(feedbackMessage);
    });
  }

  showBatchOperationFeedback(
    operation: string,
    total: number,
    success: number,
    failed: number,
    errors?: string[],
  ): string {
    const language = getCurrentLanguage();
    const title = translate(
      language === 'zh' ? 'zh' : 'en',
      'feedback.interactiveFeedback.operationCompleted',
      { operation: operation },
    );
    let message = translate(
      language === 'zh' ? 'zh' : 'en',
      'feedback.interactiveFeedback.totalTotalSucceededSuccess',
      { total: total, success: success },
    );

    if (failed > 0) {
      message += translate(
        language === 'zh' ? 'zh' : 'en',
        'feedback.interactiveFeedback.failedFailed',
        { failed: failed },
      );
    }

    const actions: FeedbackAction[] = [];

    if (errors && errors.length > 0) {
      actions.push({
        id: 'show_errors',
        label: t(
          'feedback.interactiveFeedback.viewErrorDetails',
          undefined,
          language,
        ),
        type: 'secondary',
        handler: () => {
          this.presenter.showInfo(
            t('feedback.interactiveFeedback.errorDetails', undefined, language),
            errors.join('\n'),
            false,
          );
        },
      });
    }

    const messageType: FeedbackMessage['type'] =
      failed > 0 ? 'warning' : 'success';
    const messageId = this.store.generateMessageId();

    this.store.addMessage({
      id: messageId,
      type: messageType,
      title,
      message,
      actions: actions.length > 0 ? actions : undefined,
      autoHide: true,
      duration: 8000,
      timestamp: new Date(),
    });

    return messageId;
  }
}
