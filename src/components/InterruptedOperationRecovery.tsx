import { useState } from 'react';
import { useI18n } from '../i18n';
import { toError } from '../utils/errorMessage';
import { logger } from '../utils/logger';

interface InterruptedOperationRecoveryProps {
  /** Saves a backup of this device's data; resolves `false` if cancelled. */
  onExport: () => Promise<boolean>;
  /** Drops the unfinished operation and loads the current data. */
  onContinue: () => Promise<void>;
}

/**
 * Shown when local storage holds an unfinished save that newer data has
 * overtaken. Retrying cannot succeed, so the user keeps a backup first and
 * then continues with the current data.
 */
export function InterruptedOperationRecovery({
  onExport,
  onContinue,
}: InterruptedOperationRecoveryProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState<
    'idle' | 'exported' | 'exportFailed' | 'continueFailed'
  >('idle');
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const exportBackup = () =>
    run(async () => {
      try {
        if (await onExport()) setStatus('exported');
      } catch (error) {
        logger.error(
          'RECOVERY',
          'Backup export failed',
          undefined,
          toError(error),
        );
        setStatus('exportFailed');
      }
    });

  const continueWithCurrentData = () =>
    run(async () => {
      try {
        await onContinue();
      } catch (error) {
        logger.error(
          'RECOVERY',
          'Discarding the interrupted operation failed',
          undefined,
          toError(error),
        );
        setStatus('continueFailed');
      }
    });

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div role="alert" className="max-w-md text-center">
        <h2 className="mb-2 font-chinese text-2xl font-bold text-gray-900 dark:text-slate-100">
          {t('interruptedOperation.title')}
        </h2>
        <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">
          {t('interruptedOperation.description')}
        </p>
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={exportBackup}
            disabled={busy}
            className="focus-ring gradient-primary rounded-xl px-5 py-2 font-medium text-white shadow-lg disabled:opacity-60"
          >
            {t('interruptedOperation.export')}
          </button>
          <button
            type="button"
            onClick={continueWithCurrentData}
            disabled={busy}
            className="focus-ring rounded-xl border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200"
          >
            {t('interruptedOperation.continue')}
          </button>
        </div>
        {status === 'exported' && (
          <p className="mt-4 text-sm text-green-700 dark:text-green-400">
            {t('interruptedOperation.exported')}
          </p>
        )}
        {status === 'exportFailed' && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">
            {t('interruptedOperation.exportFailed')}
          </p>
        )}
        {status === 'continueFailed' && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">
            {t('interruptedOperation.continueFailed')}
          </p>
        )}
      </div>
    </div>
  );
}
