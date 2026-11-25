import { RefreshCw } from 'lucide-react';
import { useI18n } from '../i18n';

interface RemoteChangeBannerProps {
  onReload: () => void;
  onDismiss: () => void;
}

/** Offers a reload after another device changed this account's data. */
export function RemoteChangeBanner({
  onReload,
  onDismiss,
}: RemoteChangeBannerProps) {
  const { t } = useI18n();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-60 flex justify-center px-4">
      <div
        role="status"
        className="pointer-events-auto flex max-w-xl flex-wrap items-center gap-3 rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm shadow-xl dark:border-blue-800 dark:bg-slate-800"
      >
        <RefreshCw className="shrink-0 text-blue-500" size={18} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 dark:text-slate-100">
            {t('remoteChanges.message')}
          </p>
          <p className="text-xs text-gray-600 dark:text-slate-400">
            {t('remoteChanges.hint')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-xl px-3 py-1.5 text-gray-600 transition hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {t('remoteChanges.dismiss')}
          </button>
          <button
            type="button"
            onClick={onReload}
            className="rounded-xl bg-blue-600 px-3 py-1.5 font-medium text-white transition hover:bg-blue-700"
          >
            {t('remoteChanges.reload')}
          </button>
        </div>
      </div>
    </div>
  );
}
