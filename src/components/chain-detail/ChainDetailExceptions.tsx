import React from 'react';
import { AlertCircle, Flame, Calendar } from 'lucide-react';
import { ExceptionsSectionProps } from './types';

export const ChainDetailExceptions: React.FC<ExceptionsSectionProps> = ({
  chain,
  t,
}) => {
  if (chain.exceptions.length === 0 && chain.auxiliaryExceptions.length === 0) {
    return null;
  }

  return (
    <div className="bento-card animate-scale-in">
      <h3 className="mb-6 flex items-center space-x-3 font-chinese text-xl font-bold text-[#161615] dark:text-slate-100">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-yellow-500/10">
          <AlertCircle size={20} className="text-yellow-500" />
        </div>
        <div>
          <span>{t('chainDetail.chainDetailExceptions.ruleHandbook')}</span>
          <p className="font-mono text-xs tracking-wide text-gray-500 dark:text-slate-400">
            {t('chainDetail.chainDetailExceptions.ruleHandbookVariant2')}
          </p>
        </div>
      </h3>

      {chain.exceptions.length > 0 && (
        <div className="mb-6">
          <h4 className="mb-3 flex items-center space-x-2 font-chinese font-medium text-[#161615] dark:text-slate-100">
            <Flame className="text-primary-500" size={20} />
            <span>
              {t('chainDetail.chainDetailExceptions.mainChainExceptions')}
            </span>
          </h4>
          <div className="space-y-3">
            {chain.exceptions.map((exception, index) => (
              <div
                key={index}
                className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 dark:border-yellow-500/30 dark:bg-yellow-500/20"
              >
                <p className="font-chinese text-sm text-yellow-700 dark:text-yellow-300">
                  {exception}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {chain.auxiliaryExceptions.length > 0 && (
        <div>
          <h4 className="mb-3 flex items-center space-x-2 font-chinese font-medium text-[#161615] dark:text-slate-100">
            <Calendar className="text-blue-500" size={20} />
            <span>
              {t('chainDetail.chainDetailExceptions.bookingExceptions')}
            </span>
          </h4>
          <div className="space-y-3">
            {chain.auxiliaryExceptions.map((exception, index) => (
              <div
                key={index}
                className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 dark:border-blue-500/30 dark:bg-blue-500/20"
              >
                <p className="font-chinese text-sm text-blue-700 dark:text-blue-300">
                  {exception}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
