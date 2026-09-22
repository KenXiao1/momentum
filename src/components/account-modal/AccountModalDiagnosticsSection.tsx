import type { TranslationKey } from '../../i18n';

interface Props {
  t: (key: TranslationKey) => string;
  busy: boolean;
  status: 'idle' | 'saved' | 'failed' | 'cleared';
  onExport: () => void;
  onClear: () => void;
}
export function AccountModalDiagnosticsSection({
  t,
  busy,
  status,
  onExport,
  onClear,
}: Props) {
  const statusText =
    status === 'saved'
      ? t('settings.diagnostics.saved')
      : status === 'failed'
        ? t('settings.diagnostics.failed')
        : status === 'cleared'
          ? t('settings.diagnostics.cleared')
          : '';
  return (
    <section className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-600 dark:bg-slate-700">
      <h3 className="font-chinese text-base font-medium text-gray-900 dark:text-slate-100">
        {t('settings.diagnostics.title')}
      </h3>
      <p className="font-chinese text-xs text-gray-500 dark:text-slate-400">
        {t('settings.diagnostics.description')}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onExport}
          className="rounded-xl bg-primary-500 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {t('settings.diagnostics.export')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onClear}
          className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:opacity-50 dark:border-slate-500 dark:text-slate-200"
        >
          {t('settings.diagnostics.clear')}
        </button>
      </div>
      <p role="status" className="text-xs text-gray-600 dark:text-slate-300">
        {statusText}
      </p>
    </section>
  );
}
