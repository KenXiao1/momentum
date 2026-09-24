import { type Translator } from '../../../i18n';
import type { Language } from '../../../i18n';
import { logger } from '../../../utils/logger';
import { toast } from '../../../utils/toast';
import { getSafeErrorDetailFromUnknown } from '../../../utils/errorMessage';
import { normalizeUnknownError } from '../../../utils/errors/normalizeError';
import type {
  AsyncOrSyncVoid,
  ConfirmDialogState,
  OperationResult,
} from '../types';

function isPartialRestoreFailureMessage(message: string) {
  return (
    message.includes('Partial restore failure') ||
    message.includes('部分链条恢复可能失败')
  );
}

async function performRestoreOperation(params: {
  chainIds: string[];
  onRestore: (chainIds: string[]) => AsyncOrSyncVoid;
  language: Language;
  t: Translator;
}): Promise<OperationResult> {
  const { chainIds, onRestore, language, t } = params;

  const startTime = Date.now();
  try {
    await onRestore(chainIds);
    const duration = Date.now() - startTime;

    const result: OperationResult = {
      success: true,
      message: t(
        'recycleBinModal.operations.restoredChainIdsCountChainSTookDurationMs',
        { chainIdsCount: chainIds.length, duration: duration },
      ),
      details: { count: chainIds.length, duration },
    };
    logger.debug('RECYCLE_BIN', 'Restore completed', result.details);
    return result;
  } catch (error) {
    const rawErrorMessage =
      error instanceof Error
        ? error.message
        : t('focusMode.useExceptionRuleOperations.unknownError');
    const safeDetail = getSafeErrorDetailFromUnknown(error, language);

    const defaultMessage = safeDetail
      ? t('recycleBinModal.operations.restoreFailedSafeDetail', {
          safeDetail: safeDetail,
        })
      : t(
          'recycleBinModal.operations.restoreFailedCheckTheConsoleForDetailsThenTry',
        );

    const result: OperationResult = {
      success: false,
      message: defaultMessage,
      details: { error: rawErrorMessage, chainIds },
    };
    logger.error(
      'RECYCLE_BIN',
      'Restore operation failed',
      result.details,
      normalizeUnknownError(error),
    );

    if (isPartialRestoreFailureMessage(rawErrorMessage)) {
      result.message = t(
        'recycleBinModal.operations.someChainsMayNotHaveBeenRestoredPleaseCheck',
      );
      toast.warning(result.message);
      return result;
    }

    toast.error(defaultMessage);
    return result;
  }
}

async function performPermanentDeleteOperation(params: {
  chainIds: string[];
  onPermanentDelete: (chainIds: string[]) => AsyncOrSyncVoid;
  language: Language;
  t: Translator;
}): Promise<OperationResult> {
  const { chainIds, onPermanentDelete, language, t } = params;

  const startTime = Date.now();
  try {
    await onPermanentDelete(chainIds);
    const duration = Date.now() - startTime;

    const result: OperationResult = {
      success: true,
      message: t(
        'recycleBinModal.operations.permanentlyDeletedChainIdsCountChainSTookDurationMs',
        { chainIdsCount: chainIds.length, duration: duration },
      ),
      details: { count: chainIds.length, duration },
    };
    logger.debug('RECYCLE_BIN', 'Permanent delete completed', result.details);
    return result;
  } catch (error) {
    const rawErrorMessage =
      error instanceof Error
        ? error.message
        : t('focusMode.useExceptionRuleOperations.unknownError');
    const safeDetail = getSafeErrorDetailFromUnknown(error, language);

    const message = safeDetail
      ? t('recycleBinModal.operations.permanentDeleteFailedSafeDetail', {
          safeDetail: safeDetail,
        })
      : t(
          'recycleBinModal.operations.permanentDeleteFailedCheckTheConsoleForDetailsThen',
        );

    const result: OperationResult = {
      success: false,
      message,
      details: { error: rawErrorMessage, chainIds },
    };
    logger.error(
      'RECYCLE_BIN',
      'Permanent delete operation failed',
      result.details,
      normalizeUnknownError(error),
    );
    toast.error(message);
    return result;
  }
}

export async function performRecycleBinOperation(params: {
  dialog: ConfirmDialogState;
  onRestore: (chainIds: string[]) => AsyncOrSyncVoid;
  onPermanentDelete: (chainIds: string[]) => AsyncOrSyncVoid;
  language: Language;
  t: Translator;
}): Promise<OperationResult> {
  const { dialog, onRestore, onPermanentDelete, language, t } = params;

  if (dialog.type === 'restore') {
    return performRestoreOperation({
      chainIds: dialog.chainIds,
      onRestore,
      language,
      t,
    });
  }

  return performPermanentDeleteOperation({
    chainIds: dialog.chainIds,
    onPermanentDelete,
    language,
    t,
  });
}
