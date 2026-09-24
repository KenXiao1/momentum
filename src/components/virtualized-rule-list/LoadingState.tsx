import { type Translator } from '../../i18n';
type Tr = Translator;

interface LoadingStateProps {
  t: Tr;
}

export function LoadingState({ t }: LoadingStateProps) {
  return (
    <div
      className="flex items-center justify-center py-12"
      role="status"
      aria-live="polite"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500"></div>
      <span className="ml-3 text-gray-600 dark:text-gray-400">
        {t('ruleManager.ruleManagerViewView.loadingRules')}
      </span>
    </div>
  );
}
