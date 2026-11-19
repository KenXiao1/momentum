import React from 'react';
import { Loader2 } from 'lucide-react';

type SwitchVariant = 'primary' | 'danger';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (nextChecked: boolean) => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  'aria-label': string;
  variant?: SwitchVariant;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  disabled = false,
  loading = false,
  variant = 'primary',
  className,
  'aria-label': ariaLabel,
}) => {
  const checkedTrack =
    variant === 'danger'
      ? 'bg-linear-to-r from-red-500 to-orange-500'
      : 'bg-primary-500';

  const uncheckedTrack =
    variant === 'danger'
      ? 'bg-gray-300 dark:bg-slate-600'
      : 'bg-gray-200 dark:bg-gray-600';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onCheckedChange(!checked)}
      disabled={disabled || loading}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full',
        'min-h-0 p-0',
        'transition duration-200 ease-in-out',
        'focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:outline-hidden dark:focus:ring-offset-gray-800',
        'ring-1 ring-black/10 ring-inset dark:ring-white/10',
        checked ? checkedTrack : uncheckedTrack,
        disabled || loading
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white',
          'shadow-[0_6px_16px_-10px_rgba(0,0,0,0.35),0_1px_2px_rgba(0,0,0,0.25)]',
          'transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-6' : 'translate-x-1',
        ].join(' ')}
      />

      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-3 w-3 animate-spin text-white" />
        </span>
      )}
    </button>
  );
};
