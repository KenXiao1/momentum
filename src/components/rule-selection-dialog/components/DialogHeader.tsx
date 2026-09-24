import { translate } from '../../../i18n/translate';
import { type Translator } from '../../../i18n';
import { CheckCircle, Clock, X } from 'lucide-react';
import type { ActionType } from '../types';
import {
  getActionBgClass,
  getActionColorClass,
  getActionDisplayName,
} from '../utils';

export function DialogHeader({
  actionType,
  t,
  language,
  onCancel,
}: {
  actionType: ActionType;
  t: Translator;
  language: string;
  onCancel: () => void;
}) {
  const actionColor = getActionColorClass(actionType);
  const actionBg = getActionBgClass(actionType);
  const actionLabel = getActionDisplayName(actionType, t);

  return (
    <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
      <div className="flex items-center space-x-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${actionBg}`}
        >
          {actionType === 'pause' ? (
            <Clock className={actionColor} size={20} />
          ) : (
            <CheckCircle className={actionColor} size={20} />
          )}
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            <span id="rule-selection-dialog-title">
              {t('ruleSelectionDialog.dialogHeader.chooseExceptionRule')}
            </span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {translate(
              language === 'zh' ? 'zh' : 'en',
              'ruleSelectionDialog.dialogHeader.chooseARuleForActionLabel',
              { actionLabel: actionLabel },
            )}
          </p>
        </div>
      </div>

      <button
        onClick={onCancel}
        aria-label={t('rsip.rsipViolationDialog.closeDialog')}
        className="rounded-xl bg-gray-100 p-2 text-gray-500 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
      >
        <X size={20} />
      </button>
    </div>
  );
}
