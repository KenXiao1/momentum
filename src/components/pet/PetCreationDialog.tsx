import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '../../i18n';

interface PetCreationDialogProps {
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

export function PetCreationDialog({
  onSubmit,
  onCancel,
}: PetCreationDialogProps) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const shouldAutoFocus =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ESC 键关闭
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    },
    [onCancel],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!shouldAutoFocus) return;
    inputRef.current?.focus();
  }, [shouldAutoFocus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError(t('pet.petCreationDialog.pleaseEnterAPetName'));
      return;
    }

    if (trimmedName.length > 20) {
      setError(t('pet.petCreationDialog.nameCannotExceed20Characters'));
      return;
    }

    onSubmit(trimmedName);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pet-creation-dialog-title"
        className="mx-4 w-full max-w-sm animate-scale-in rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
        style={{ overscrollBehavior: 'contain' }}
      >
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-3 text-5xl">🥒</div>
          <h2
            id="pet-creation-dialog-title"
            className="text-xl font-bold text-gray-800 dark:text-gray-100"
          >
            {t('pet.petCreationDialog.adoptYourPet')}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t('pet.petCreationDialog.giveYourNewCompanionAName')}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input
              ref={inputRef}
              type="text"
              name="petName"
              autoComplete="off"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder={t('pet.petCreationDialog.petName')}
              aria-label={t('pet.petCreationDialog.petNameVariant2')}
              aria-invalid={!!error}
              aria-describedby={error ? 'pet-name-error' : undefined}
              className={`w-full rounded-xl border-2 px-4 py-3 ${error ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'} bg-gray-50 text-gray-800 placeholder-gray-400 transition-colors focus:border-green-400 focus:outline-none dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-green-500`}
              maxLength={20}
            />
            {error && (
              <p id="pet-name-error" className="mt-1 text-sm text-red-500">
                {error}
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl bg-gray-100 py-3 text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              {t('pet.petCreationDialog.maybeLater')}
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-gradient-to-r from-green-400 to-emerald-500 py-3 font-medium text-white transition-colors hover:from-green-500 hover:to-emerald-600"
            >
              {t('pet.petCreationDialog.adopt')} 🎉
            </button>
          </div>
        </form>

        {/* Info */}
        <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
          {t('pet.petCreationDialog.completeTasksToFeedYourPetAndHelpIt')}
        </p>
      </div>
    </div>
  );
}
