import type { Translator } from '../../../i18n';
import { ExceptionRuleError, ExceptionRuleException } from '../../../types';
import { getSafeErrorDetail } from '../../../utils/errorMessage';
import { getCurrentLanguage } from '../../../utils/runtimeI18n';

/** Toast title and text for a failed exception-rule action in focus mode. */
export function describeRuleError(
  error: unknown,
  t: Translator,
): { title: string; message: string } {
  // Anything else failed while persisting the rule use or the pause.
  if (!(error instanceof ExceptionRuleException)) {
    return {
      title: t('feedback.errorMessageFormatter.saveFailed'),
      message: t(
        'feedback.errorMessageFormatter.failedToSaveDataPleaseCheckYourConnectionOr',
      ),
    };
  }

  switch (error.type) {
    case ExceptionRuleError.RULE_NOT_FOUND:
      return {
        title: t('feedback.errorMessageFormatter.ruleNotFound'),
        message: error.message.includes('ID')
          ? t(
              'feedback.errorMessageFormatter.theSelectedRuleNoLongerExistsItMayHave',
            )
          : t(
              'feedback.errorMessageFormatter.theRuleDoesNotExistOrHasBeenDeleted',
            ),
      };
    case ExceptionRuleError.DUPLICATE_RULE_NAME:
      return {
        title: t('feedback.errorMessageFormatter.duplicateRuleName'),
        message: t(
          'feedback.errorMessageFormatter.thisRuleNameAlreadyExistsPleaseChooseADifferent',
        ),
      };
    case ExceptionRuleError.RULE_TYPE_MISMATCH:
      return {
        title: t('feedback.errorMessageFormatter.ruleTypeMismatch'),
        message: t(
          'feedback.errorMessageFormatter.thisRuleTypeDoesNotMatchTheCurrentAction',
        ),
      };
    case ExceptionRuleError.INVALID_RULE_TYPE:
      return {
        title: t('feedback.errorMessageFormatter.invalidRuleType'),
        message: t(
          'feedback.errorMessageFormatter.invalidRuleTypePleaseCheckTheRuleSettings',
        ),
      };
    case ExceptionRuleError.VALIDATION_ERROR: {
      const safeDetail = getSafeErrorDetail(
        error.message,
        getCurrentLanguage(),
      );
      return {
        title: t('feedback.errorMessageFormatter.validationFailed'),
        message: safeDetail
          ? t('feedback.errorMessageFormatter.validationFailedSafeDetail', {
              safeDetail,
            })
          : t('feedback.errorMessageFormatter.validationFailed'),
      };
    }
    case ExceptionRuleError.STORAGE_ERROR:
      return {
        title: t('feedback.errorMessageFormatter.saveFailed'),
        message: t(
          'feedback.errorMessageFormatter.failedToSaveDataPleaseCheckYourConnectionOr',
        ),
      };
  }
}
