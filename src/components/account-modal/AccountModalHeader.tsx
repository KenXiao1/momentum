import { X } from 'lucide-react';

interface AccountModalHeaderProps {
  title: string;
  closeLabel: string;
  onClose: () => void;
}

export function AccountModalHeader({
  title,
  closeLabel,
  onClose,
}: AccountModalHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-slate-700">
      <h2
        id="account-modal-title"
        className="font-chinese text-2xl font-bold text-gray-900 dark:text-slate-100"
      >
        {title}
      </h2>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="focus-ring rounded-sm text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-slate-300"
      >
        <X size={24} />
      </button>
    </div>
  );
}
