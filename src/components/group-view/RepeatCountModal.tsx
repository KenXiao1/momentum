import { type Translator } from '../../i18n';
import type React from 'react';
import { X } from 'lucide-react';

export function RepeatCountModal({
  isOpen,
  t,
  repeatCount,
  setRepeatCount,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  t: Translator;
  repeatCount: number;
  setRepeatCount: React.Dispatch<React.SetStateAction<number>>;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md animate-scale-in rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-slate-600 dark:bg-slate-800">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-chinese text-xl font-bold text-gray-900 dark:text-slate-100">
            {t('groupView.repeatCountModal.setRepeatCount')}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-6">
          <label className="mb-3 block font-chinese text-sm font-medium text-gray-700 dark:text-slate-300">
            {t('groupView.repeatCountModal.repeatCount199')}
          </label>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setRepeatCount(Math.max(1, repeatCount - 1))}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 font-bold text-gray-600 transition-colors hover:bg-gray-300 dark:bg-slate-600 dark:text-slate-300 dark:hover:bg-slate-500"
              disabled={repeatCount <= 1}
            >
              -
            </button>

            <input
              type="number"
              min="1"
              max="99"
              value={repeatCount}
              onChange={(event) => {
                const value = parseInt(event.target.value) || 1;
                setRepeatCount(Math.min(99, Math.max(1, value)));
              }}
              className="h-12 w-20 rounded-xl border border-gray-300 bg-gray-50 text-center text-2xl font-bold text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />

            <button
              onClick={() => setRepeatCount(Math.min(99, repeatCount + 1))}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 font-bold text-gray-600 transition-colors hover:bg-gray-300 dark:bg-slate-600 dark:text-slate-300 dark:hover:bg-slate-500"
              disabled={repeatCount >= 99}
            >
              +
            </button>
          </div>

          <p className="mt-2 font-chinese text-xs text-gray-500 dark:text-slate-400">
            {t(
              'groupView.repeatCountModal.setHowManyTimesThisUnitMustBeRepeated',
            )}
          </p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-chinese text-gray-700 transition-colors hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {t('bettingModal.bettingFormSections.cancel')}
          </button>
          <button
            onClick={onSave}
            className="flex-1 rounded-xl bg-primary-500 px-4 py-3 font-chinese font-medium text-white transition-colors hover:bg-primary-600"
          >
            {t('groupView.repeatCountModal.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
