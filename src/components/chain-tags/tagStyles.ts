import { ChainTagError } from '../../domain/chainTags';
import type { Translator } from '../../i18n';
import { MAX_TAG_NAME_LENGTH } from '../../domain/chainTags';
import type { TagColor } from '../../types';

/** Literal class names per color, so Tailwind keeps every one of them. */
export const TAG_COLOR_STYLES: Record<
  TagColor,
  { dot: string; chip: string; selected: string }
> = {
  violet: {
    dot: 'bg-violet-500',
    chip: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
    selected: 'border-violet-600 bg-violet-600 text-white',
  },
  blue: {
    dot: 'bg-blue-500',
    chip: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
    selected: 'border-blue-600 bg-blue-600 text-white',
  },
  cyan: {
    dot: 'bg-cyan-500',
    chip: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
    selected: 'border-cyan-700 bg-cyan-700 text-white',
  },
  emerald: {
    dot: 'bg-emerald-500',
    chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    selected: 'border-emerald-700 bg-emerald-700 text-white',
  },
  amber: {
    dot: 'bg-amber-500',
    chip: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300',
    selected: 'border-amber-600 bg-amber-600 text-white',
  },
  orange: {
    dot: 'bg-orange-500',
    chip: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
    selected: 'border-orange-600 bg-orange-600 text-white',
  },
  rose: {
    dot: 'bg-rose-500',
    chip: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    selected: 'border-rose-600 bg-rose-600 text-white',
  },
  pink: {
    dot: 'bg-pink-500',
    chip: 'border-pink-500/30 bg-pink-500/10 text-pink-700 dark:text-pink-300',
    selected: 'border-pink-600 bg-pink-600 text-white',
  },
  slate: {
    dot: 'bg-slate-500',
    chip: 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
    selected: 'border-slate-600 bg-slate-600 text-white',
  },
};

export function colorName(color: TagColor, t: Translator): string {
  switch (color) {
    case 'violet':
      return t('chainTags.colors.violet');
    case 'blue':
      return t('chainTags.colors.blue');
    case 'cyan':
      return t('chainTags.colors.cyan');
    case 'emerald':
      return t('chainTags.colors.emerald');
    case 'amber':
      return t('chainTags.colors.amber');
    case 'orange':
      return t('chainTags.colors.orange');
    case 'rose':
      return t('chainTags.colors.rose');
    case 'pink':
      return t('chainTags.colors.pink');
    default:
      return t('chainTags.colors.slate');
  }
}

/** What to tell the user about a failed tag change. */
export function tagErrorMessage(error: unknown, t: Translator): string {
  if (error instanceof ChainTagError) {
    if (error.reason === 'empty-name') return t('chainTags.errors.emptyName');
    if (error.reason === 'name-too-long')
      return t('chainTags.errors.nameTooLong', { max: MAX_TAG_NAME_LENGTH });
    return t('chainTags.errors.duplicateName');
  }
  return t('chainTags.errors.saveFailed');
}
