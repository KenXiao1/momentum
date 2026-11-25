import { useState } from 'react';
import type { Translator } from '../../i18n';
import { getErrorReportingEnabled } from '../../utils/local-preferences/errorReporting';
import { setErrorReporting } from '../../utils/errorReporting';
import { Switch } from '../Switch';

/** Lets the user opt in to sending crash reports; off until they choose. */
export function AccountModalErrorReportingSection({ t }: { t: Translator }) {
  const [enabled, setEnabled] = useState(getErrorReportingEnabled);
  const [saving, setSaving] = useState(false);

  const toggle = async (next: boolean) => {
    setSaving(true);
    setEnabled(next);
    try {
      await setErrorReporting(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-600 dark:bg-slate-700">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-chinese text-base font-medium text-gray-900 dark:text-slate-100">
            {t('settings.errorReporting.title')}
          </h3>
          <p className="font-chinese text-xs text-gray-500 dark:text-slate-400">
            {t('settings.errorReporting.description')}
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={toggle}
          loading={saving}
          disabled={saving}
          aria-label={t('settings.errorReporting.title')}
        />
      </div>
    </div>
  );
}
