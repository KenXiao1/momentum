import type { Translator } from '../../i18n';
import { TAG_COLORS, type TagColor } from '../../types';
import { colorName, TAG_COLOR_STYLES } from './tagStyles';

/** A radio group of the tag colors. */
export function ColorSwatches({
  value,
  onChange,
  label,
  t,
}: {
  value: TagColor;
  onChange: (color: TagColor) => void;
  label: string;
  t: Translator;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex flex-wrap gap-1.5"
    >
      {TAG_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={color === value}
          aria-label={colorName(color, t)}
          onClick={() => onChange(color)}
          className={`h-6 w-6 rounded-full ${TAG_COLOR_STYLES[color].dot} ring-offset-2 transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-gray-900 dark:ring-offset-slate-800 dark:focus-visible:ring-white ${
            color === value ? 'ring-2 ring-gray-900 dark:ring-white' : ''
          }`}
        />
      ))}
    </div>
  );
}
