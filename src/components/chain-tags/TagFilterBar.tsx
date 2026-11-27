import type { Translator } from '../../i18n';
import type { ChainTag } from '../../types';
import { TAG_COLOR_STYLES } from './tagStyles';

interface TagFilterBarProps {
  usage: { tag: ChainTag; count: number }[];
  selectedIds: readonly string[];
  shownCount: number;
  totalCount: number;
  onToggle: (tagId: string) => void;
  onClear: () => void;
  t: Translator;
}

const CHIP =
  'focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors';
const IDLE =
  'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:text-gray-950 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500';

/** Narrows the chain list to chains with any of the chosen tags. */
export function TagFilterBar({
  usage,
  selectedIds,
  shownCount,
  totalCount,
  onToggle,
  onClear,
  t,
}: TagFilterBarProps) {
  const filtering = selectedIds.length > 0;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label={t('chainTags.filter.label')}
        className="flex flex-wrap items-center gap-2"
      >
        <button
          type="button"
          aria-pressed={!filtering}
          onClick={onClear}
          className={`${CHIP} ${
            filtering
              ? IDLE
              : 'border-gray-950 bg-gray-950 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950'
          }`}
        >
          {t('chainTags.filter.all')}
        </button>
        {usage.map(({ tag, count }) => {
          const selected = selectedIds.includes(tag.id);
          const style = TAG_COLOR_STYLES[tag.color];
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={selected}
              aria-label={t('chainTags.filter.tagWithCount', {
                name: tag.name,
                count,
              })}
              onClick={() => onToggle(tag.id)}
              className={`${CHIP} max-w-56 ${selected ? style.selected : IDLE}`}
            >
              {!selected && (
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`}
                />
              )}
              <span className="truncate">{tag.name}</span>
              <span
                className={`text-xs tabular-nums ${
                  selected
                    ? 'text-white/80'
                    : 'text-gray-500 dark:text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
      <p
        role="status"
        className="ml-auto text-sm text-gray-500 dark:text-slate-400"
      >
        {filtering &&
          t('chainTags.filter.showing', {
            shown: shownCount,
            total: totalCount,
          })}
      </p>
    </div>
  );
}
