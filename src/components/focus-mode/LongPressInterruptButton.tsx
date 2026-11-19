import { useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLongPress } from '../../hooks/useLongPress';

interface LongPressInterruptButtonProps {
  label: string;
  onInterrupt: () => void;
}

export function LongPressInterruptButton({
  label,
  onInterrupt,
}: LongPressInterruptButtonProps) {
  const handleLongPress = useCallback(() => onInterrupt(), [onInterrupt]);
  const { isActive, handlers } = useLongPress({
    onLongPress: handleLongPress,
    delay: 700,
  });

  return (
    <div className="fixed right-4 bottom-4 z-30 sm:right-6 sm:bottom-6">
      <button
        type="button"
        {...handlers}
        aria-label={label}
        className="focus-ring relative flex min-h-11 items-center justify-center gap-2 overflow-hidden rounded-xl border border-red-200 bg-(--surface-raised) px-3 py-2 text-red-700 transition-colors dark:border-red-900/60 dark:text-red-300"
        title={label}
      >
        <span
          className={`absolute inset-0 origin-left bg-red-400/20 transition-transform dark:bg-red-500/20 ${isActive ? 'scale-x-100 duration-700' : 'scale-x-0 duration-75'}`}
          aria-hidden="true"
        />
        <AlertTriangle size={18} aria-hidden="true" className="relative z-10" />
        <span className="relative z-10 hidden text-sm font-medium sm:inline">
          {label}
        </span>
      </button>
    </div>
  );
}
