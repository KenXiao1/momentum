import { translate } from '../../i18n/translate';
import { type Translator } from '../../i18n';
import { CheckCircle, List } from 'lucide-react';
import type { Chain } from '../../types';

export function AuxiliaryJudgmentActions(props: {
  chain: Chain;
  language: 'zh' | 'en';
  reason: string;
  useExistingRule: boolean;
  selectedExistingRule: string;
  onFailure: () => void;
  onAllow: () => void;
  onCancel: () => void;
  t: Translator;
}) {
  const exceptions = props.chain.auxiliaryExceptions ?? [];
  return (
    <>
      <div className="space-y-3">
        <button
          type="button"
          aria-label={props.t(
            'auxiliaryJudgment.auxiliaryJudgmentActions.markAsFailed',
          )}
          onClick={props.onFailure}
          className="w-full rounded-2xl bg-red-500 px-6 py-3 font-chinese font-medium text-white shadow-lg transition duration-300 hover:scale-105 hover:bg-red-600"
        >
          <div className="text-left">
            <div className="text-lg font-bold">
              {props.t(
                'auxiliaryJudgment.auxiliaryJudgmentActions.markAsFailed',
              )}
            </div>
            <div className="text-sm text-red-200">
              {translate(
                props.language === 'zh' ? 'zh' : 'en',
                'auxiliaryJudgment.auxiliaryJudgmentActions.bookingStreakResetsFromPropsChainAuxiliaryStreakTo0',
                { propsChainAuxiliaryStreak: props.chain.auxiliaryStreak },
              )}
            </div>
          </div>
        </button>
        <button
          type="button"
          aria-label={props.t(
            'auxiliaryJudgment.auxiliaryJudgmentActions.allowPrecedent',
          )}
          onClick={props.onAllow}
          disabled={
            props.useExistingRule
              ? !props.selectedExistingRule
              : !props.reason.trim()
          }
          className={`w-full rounded-2xl px-6 py-3 font-chinese font-medium text-white shadow-lg transition duration-300 hover:scale-105 disabled:cursor-not-allowed disabled:bg-gray-300 ${props.useExistingRule ? 'bg-green-500 hover:bg-green-600' : 'bg-yellow-500 hover:bg-yellow-600'}`}
        >
          <div className="text-left">
            <div className="text-lg font-bold">
              {props.t(
                'auxiliaryJudgment.auxiliaryJudgmentActions.allowPrecedent',
              )}
            </div>
            <div
              className={`text-sm ${props.useExistingRule ? 'text-green-200' : 'text-yellow-200'}`}
            >
              {props.useExistingRule
                ? props.t(
                    'auxiliaryJudgment.auxiliaryJudgmentActions.thisBehaviorIsAllowedUnderAnExistingRule',
                  )
                : props.t(
                    'auxiliaryJudgment.auxiliaryJudgmentActions.thisWillBeSavedAsANewExceptionFor',
                  )}
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={props.onCancel}
          className="w-full rounded-2xl bg-gray-100 px-4 py-2 font-chinese font-medium text-gray-900 transition duration-300 hover:scale-105 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
        >
          {props.t(
            'auxiliaryJudgment.auxiliaryJudgmentActions.cancelContinueBooking',
          )}
        </button>
      </div>
      {exceptions.length > 0 && (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-600 dark:bg-slate-700/50">
          <h4 className="mb-4 flex items-center space-x-2 font-chinese font-medium text-gray-900 dark:text-slate-100">
            <List className="text-blue-500" size={20} />
            <span>
              {props.t(
                'auxiliaryJudgment.auxiliaryJudgmentActions.currentBookingExceptions',
              )}
            </span>
          </h4>
          <div className="max-h-32 space-y-2 overflow-y-auto">
            {[...new Set(exceptions)].map((exception) => (
              <div
                key={exception}
                className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400"
              >
                <CheckCircle size={12} />
                <span className="font-chinese">{exception}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
