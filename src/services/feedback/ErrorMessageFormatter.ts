/**
 * 错误消息格式化器
 * 负责将异常转换为用户友好的消息
 */

import { ExceptionRuleError, ExceptionRuleException } from '../../types';
import { getSafeErrorDetail } from '../../utils/errorMessage';
import { getCurrentLanguage, t } from '../../utils/runtimeI18n';

export class ErrorMessageFormatter {
  getUserFriendlyMessage(error: ExceptionRuleException): string {
    const language = getCurrentLanguage();
    switch (error.type) {
      case ExceptionRuleError.RULE_NOT_FOUND:
        return this.formatRuleNotFoundMessage(error);

      case ExceptionRuleError.DUPLICATE_RULE_NAME:
        return this.formatDuplicateNameMessage(error);

      case ExceptionRuleError.RULE_TYPE_MISMATCH:
        return this.formatTypeMismatchMessage();

      case ExceptionRuleError.INVALID_RULE_TYPE:
        return t(
          'feedback.errorMessageFormatter.invalidRuleTypePleaseCheckTheRuleSettings',
          undefined,
          language,
        );

      case ExceptionRuleError.VALIDATION_ERROR: {
        const safeDetail = getSafeErrorDetail(error.message || '', language);
        return safeDetail
          ? t(
              'feedback.errorMessageFormatter.validationFailedSafeDetail',
              { safeDetail: safeDetail },
              language,
            )
          : t(
              'feedback.errorMessageFormatter.validationFailed',
              undefined,
              language,
            );
      }

      case ExceptionRuleError.STORAGE_ERROR:
        return t(
          'feedback.errorMessageFormatter.failedToSaveDataPleaseCheckYourConnectionOr',
          undefined,
          language,
        );

      default: {
        const safeDetail = getSafeErrorDetail(error.message || '', language);
        return (
          safeDetail ??
          t(
            'feedback.errorMessageFormatter.anUnknownErrorOccurred',
            undefined,
            language,
          )
        );
      }
    }
  }

  getErrorTitle(errorType: ExceptionRuleError): string {
    const language = getCurrentLanguage();
    switch (errorType) {
      case ExceptionRuleError.RULE_NOT_FOUND:
        return t(
          'feedback.errorMessageFormatter.ruleNotFound',
          undefined,
          language,
        );
      case ExceptionRuleError.DUPLICATE_RULE_NAME:
        return t(
          'feedback.errorMessageFormatter.duplicateRuleName',
          undefined,
          language,
        );
      case ExceptionRuleError.RULE_TYPE_MISMATCH:
        return t(
          'feedback.errorMessageFormatter.ruleTypeMismatch',
          undefined,
          language,
        );
      case ExceptionRuleError.INVALID_RULE_TYPE:
        return t(
          'feedback.errorMessageFormatter.invalidRuleType',
          undefined,
          language,
        );
      case ExceptionRuleError.VALIDATION_ERROR:
        return t(
          'feedback.errorMessageFormatter.validationFailed',
          undefined,
          language,
        );
      case ExceptionRuleError.STORAGE_ERROR:
        return t(
          'feedback.errorMessageFormatter.saveFailed',
          undefined,
          language,
        );
      default:
        return t(
          'feedback.errorMessageFormatter.operationFailed',
          undefined,
          language,
        );
    }
  }

  private formatRuleNotFoundMessage(error: ExceptionRuleException): string {
    const language = getCurrentLanguage();
    const message = error.message;

    if (message.includes('ID')) {
      return t(
        'feedback.errorMessageFormatter.theSelectedRuleNoLongerExistsItMayHave',
        undefined,
        language,
      );
    }

    return t(
      'feedback.errorMessageFormatter.theRuleDoesNotExistOrHasBeenDeleted',
      undefined,
      language,
    );
  }

  private formatDuplicateNameMessage(error: ExceptionRuleException): string {
    const language = getCurrentLanguage();
    const existingRules =
      error.details && typeof error.details === 'object'
        ? (error.details as { existingRules?: unknown }).existingRules
        : undefined;
    const hasExistingRules =
      Array.isArray(existingRules) && existingRules.length > 0;

    if (hasExistingRules) {
      return t(
        'feedback.errorMessageFormatter.thisRuleNameAlreadyExistsYouCanUseThe',
        undefined,
        language,
      );
    }

    return t(
      'feedback.errorMessageFormatter.thisRuleNameAlreadyExistsPleaseChooseADifferent',
      undefined,
      language,
    );
  }

  private formatTypeMismatchMessage(): string {
    const language = getCurrentLanguage();
    return t(
      'feedback.errorMessageFormatter.thisRuleTypeDoesNotMatchTheCurrentAction',
      undefined,
      language,
    );
  }
}
