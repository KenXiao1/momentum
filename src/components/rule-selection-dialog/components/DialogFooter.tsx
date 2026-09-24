import { type Translator } from '../../../i18n';
export function DialogFooter({
  t,
  count,
  onCancel,
}: {
  language: string;
  t: Translator;
  count: number;
  onCancel: () => void;
}) {
  const availableRulesText =
    count === 1
      ? t('counts.ruleAvailable', { count })
      : t('counts.rulesAvailable', { count });

  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-700/50">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {availableRulesText}
        </div>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {t('ruleSelectionDialog.dialogFooter.cancel')}
        </button>
      </div>
    </div>
  );
}
