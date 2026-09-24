import { type Translator } from '../../i18n';
import React from 'react';
import { getRsipTypeLabel, rsipTypeColorMap, rsipTypeEmojiMap } from './rsipUi';

interface RSIPFiltersProps {
  filterType: string | null;
  onFilterTypeChange: (next: string | null) => void;
  language: string;
  t: Translator;
}

export const RSIPFilters: React.FC<RSIPFiltersProps> = ({
  filterType,
  onFilterTypeChange,
  language,
  t,
}) => {
  return (
    <div className="bento-card mb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <label className="font-chinese text-sm text-gray-700 dark:text-slate-300">
            {t('rsip.rsipFilters.filterByType')}
          </label>
          <select
            value={filterType || ''}
            onChange={(e) => onFilterTypeChange(e.target.value || null)}
            className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-gray-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            <option value="">
              {t('bettingModal.bettingFormSections.all')}
            </option>
            {Object.keys(rsipTypeEmojiMap).map((t) => (
              <option key={t} value={t}>
                {getRsipTypeLabel(language, t)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onFilterTypeChange(null)}
            className="rounded-lg bg-gray-100 px-2 py-1 text-xs dark:bg-slate-700"
          >
            {t('rsip.rsipFilters.clear')}
          </button>
        </div>
        <div className="flex items-center space-x-2">
          {Object.keys(rsipTypeColorMap).map((t) => {
            const col = rsipTypeColorMap[t];
            return (
              <div
                key={t}
                className={`rounded-lg px-2 py-1 ${col.badge} font-chinese text-xs`}
              >
                {getRsipTypeLabel(language, t)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
