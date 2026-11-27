import type { Translator } from '../../i18n';
import type { ChainTag } from '../../types';
import { TAG_COLOR_STYLES } from './tagStyles';

/** A chain's tags as small colored pills; the name always shows. */
export function TagChips({
  tags,
  t,
  max = 3,
}: {
  tags: ChainTag[];
  t: Translator;
  max?: number;
}) {
  if (tags.length === 0) return null;
  const shown = tags.slice(0, max);
  const hidden = tags.slice(max);

  return (
    <ul aria-label={t('chainTags.section')} className="flex flex-wrap gap-1">
      {shown.map((tag) => (
        <li
          key={tag.id}
          className={`inline-flex max-w-40 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${TAG_COLOR_STYLES[tag.color].chip}`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${TAG_COLOR_STYLES[tag.color].dot}`}
          />
          <span className="truncate">{tag.name}</span>
        </li>
      ))}
      {hidden.length > 0 && (
        <li
          title={hidden.map((tag) => tag.name).join(', ')}
          className="inline-flex items-center rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500 dark:border-slate-600 dark:text-slate-400"
        >
          {t('chainTags.more', { count: hidden.length })}
        </li>
      )}
    </ul>
  );
}
