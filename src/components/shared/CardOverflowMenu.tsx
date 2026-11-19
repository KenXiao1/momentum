import { MoreHorizontal, Trash2 } from 'lucide-react';

interface CardOverflowMenuProps {
  isOpen: boolean;
  moreLabel: string;
  deleteLabel: string;
  onToggle: () => void;
  onDelete: () => void;
}

export function CardOverflowMenu({
  isOpen,
  moreLabel,
  deleteLabel,
  onToggle,
  onDelete,
}: CardOverflowMenuProps) {
  return (
    <div className="absolute top-6 right-6">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        aria-label={moreLabel}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="focus-ring min-h-11 min-w-11 rounded-lg p-3 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
      >
        <MoreHorizontal size={20} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute top-12 right-0 z-10 min-w-36 rounded-2xl border border-gray-200 bg-white py-2 shadow-xl dark:border-slate-600 dark:bg-slate-800 dark:shadow-2xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="flex w-full items-center space-x-3 px-4 py-3 text-left text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <Trash2 size={14} aria-hidden="true" />
            <span className="font-chinese font-medium">{deleteLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
}
