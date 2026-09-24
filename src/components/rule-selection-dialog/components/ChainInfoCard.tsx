import { translate } from '../../../i18n/translate';
import type { SessionContext } from '../../../types';
import type { ActionType } from '../types';
import { getActionBgClass, getActionColorClass } from '../utils';

export function ChainInfoCard({
  actionType,
  sessionContext,
  language,
}: {
  actionType: ActionType;
  sessionContext: SessionContext;
  language: string;
}) {
  const actionBg = getActionBgClass(actionType);
  const actionColor = getActionColorClass(actionType);

  return (
    <div className={`mx-6 mt-4 rounded-2xl border p-4 ${actionBg}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white">
            {sessionContext.chainName}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {translate(
              language === 'zh' ? 'zh' : 'en',
              'ruleSelectionDialog.chainInfoCard.elapsedMathFloorSessionContextElapsedTime60Min',
              {
                mathFloorSessionContextElapsedTime60: Math.floor(
                  sessionContext.elapsedTime / 60,
                ),
              },
            )}
            {sessionContext.remainingTime && (
              <span>
                {translate(
                  language === 'zh' ? 'zh' : 'en',
                  'ruleSelectionDialog.chainInfoCard.mathFloorSessionContextRemainingTime60MinRemaining',
                  {
                    mathFloorSessionContextRemainingTime60: Math.floor(
                      sessionContext.remainingTime / 60,
                    ),
                  },
                )}
              </span>
            )}
          </p>
        </div>
        <div className={`font-mono text-2xl ${actionColor}`}>
          {Math.floor(sessionContext.elapsedTime / 60)}:
          {(sessionContext.elapsedTime % 60).toString().padStart(2, '0')}
        </div>
      </div>
    </div>
  );
}
