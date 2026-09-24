import { type Translator } from '../../i18n';
import { Plus } from 'lucide-react';

type Tr = Translator;

interface EmptyStateProps {
  onCreateNew?: (name: string) => void;
  searchQuery: string;
  t: Tr;
}

export function EmptyState({ searchQuery, onCreateNew, t }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 text-gray-500 dark:text-gray-400">
        {searchQuery
          ? t('virtualizedRuleList.emptyState.noMatchingRulesFound')
          : t('virtualizedRuleList.emptyState.noRulesAvailable')}
      </div>
      {searchQuery && onCreateNew && (
        <button
          type="button"
          onClick={() => onCreateNew(searchQuery)}
          aria-label={t('virtualizedRuleList.emptyState.createSearchQuery', {
            searchQuery: searchQuery,
          })}
          className="inline-flex items-center space-x-2 rounded-lg bg-primary-500 px-4 py-2 text-white transition-colors hover:bg-primary-600"
        >
          <Plus size={16} aria-hidden="true" />
          <span>
            {t('virtualizedRuleList.emptyState.createSearchQuery', {
              searchQuery: searchQuery,
            })}
          </span>
        </button>
      )}
    </div>
  );
}
