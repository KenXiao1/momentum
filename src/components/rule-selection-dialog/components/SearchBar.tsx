import { type Translator } from '../../../i18n';
import React from 'react';
import { Search } from 'lucide-react';

export function SearchBar({
  t,
  searchInputRef,
  value,
  onChange,
}: {
  t: Translator;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative mb-4">
      <Search
        className="absolute top-1/2 left-3 -translate-y-1/2 transform text-gray-400"
        size={20}
      />
      <input
        ref={searchInputRef}
        type="text"
        aria-label={t('ruleSelectionDialog.searchBar.searchRules')}
        placeholder={t(
          'ruleSelectionDialog.searchBar.searchRulesOrTypeANewRuleName',
        )}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-gray-300 bg-white py-3 pr-4 pl-10 text-gray-900 focus:ring-2 focus:ring-primary-500 focus:outline-hidden dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      />
    </div>
  );
}
