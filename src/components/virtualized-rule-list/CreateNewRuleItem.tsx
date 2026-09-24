import { type Translator } from '../../i18n';
import { Plus } from 'lucide-react';

type Tr = Translator;

interface CreateNewRuleItemProps {
  itemHeight: number;
  onCreateNew: (name: string) => void;
  searchQuery: string;
  t: Tr;
}

export function CreateNewRuleItem({
  itemHeight,
  onCreateNew,
  searchQuery,
  t,
}: CreateNewRuleItemProps) {
  return (
    <div
      className="absolute w-full"
      style={{
        height: itemHeight,
        top: 0,
        left: 0,
      }}
    >
      <button
        type="button"
        onClick={() => onCreateNew(searchQuery)}
        aria-label={t(
          'virtualizedRuleList.createNewRuleItem.createNewRuleSearchQuery',
          { searchQuery: searchQuery },
        )}
        className="flex w-full items-center space-x-3 rounded-xl border border-primary-200 bg-primary-50 p-4 text-left transition-colors hover:bg-primary-100 dark:border-primary-500/30 dark:bg-primary-500/10 dark:hover:bg-primary-500/20"
        style={{ height: itemHeight }}
      >
        <Plus
          className="flex-shrink-0 text-primary-500"
          size={20}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-primary-700 dark:text-primary-300">
            {t(
              'virtualizedRuleList.createNewRuleItem.createNewRuleSearchQuery',
              { searchQuery: searchQuery },
            )}
          </div>
          <div className="text-sm text-primary-600 dark:text-primary-400">
            {t(
              'virtualizedRuleList.createNewRuleItem.createAChainSpecificRule',
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
