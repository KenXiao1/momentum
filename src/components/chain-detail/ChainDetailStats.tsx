import React from 'react';
import { Flame, Calendar } from 'lucide-react';
import { MainStatsProps, StatRowProps } from './types';
import { formatChainDuration } from '../../utils/formatChainDuration';
import {
  getAuxiliarySignalLabel,
  getTriggerLabel,
} from '../chain-editor/constants';

const StatRow: React.FC<StatRowProps> = ({
  label,
  value,
  mono,
  success,
  danger,
  blue,
}) => {
  let valueClass = 'text-[#161615] dark:text-slate-100 font-medium';
  if (success) valueClass = 'text-green-500 font-bold';
  if (danger) valueClass = 'text-red-500 font-bold';
  if (blue) valueClass = 'text-blue-500 font-medium';
  if (mono) valueClass += ' font-mono';
  if (!mono && !success && !danger && !blue) valueClass += ' font-chinese';

  return (
    <div className="flex items-center justify-between">
      <span className="font-chinese text-gray-500 dark:text-slate-400">
        {label}
      </span>
      <span className={valueClass}>{value}</span>
    </div>
  );
};

export const ChainDetailStats: React.FC<MainStatsProps> = ({
  chain,
  successRate,
  language,
  t,
}) => (
  <div className="bento-card animate-scale-in">
    <div className="mb-8 text-center">
      <div className="mb-4 flex items-center justify-center space-x-3 text-primary-500">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary-500/10">
          <Flame size={32} />
        </div>
        <div className="text-left">
          <span className="font-mono text-5xl font-bold">
            #{chain.currentStreak}
          </span>
          <p className="font-chinese text-sm text-gray-500">
            {t('chainDetail.chainDetailStats.mainStreak')}
          </p>
        </div>
      </div>
    </div>

    <div className="mb-8 border-b border-gray-200 pb-8 text-center">
      <div className="mb-4 flex items-center justify-center space-x-3 text-blue-500">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10">
          <Calendar size={24} />
        </div>
        <div className="text-left">
          <span className="font-mono text-3xl font-bold">
            #{chain.auxiliaryStreak}
          </span>
          <p className="font-chinese text-sm text-gray-500">
            {t('chainDetail.chainDetailStats.bookingStreak')}
          </p>
        </div>
      </div>
    </div>

    <div className="space-y-4">
      <StatRow
        label={t('chainDetail.chainDetailStats.trigger')}
        value={getTriggerLabel(chain.trigger, language)}
      />
      <StatRow
        label={t('chainDetail.chainDetailStats.duration')}
        value={formatChainDuration(chain, language)}
        mono
      />
      <StatRow
        label={t('chainDetail.chainDetailStats.totalCompletions')}
        value={chain.totalCompletions}
        mono
        success
      />
      <StatRow
        label={t('chainDetail.chainDetailStats.failures')}
        value={chain.totalFailures}
        mono
        danger
      />
      <StatRow
        label={t('chainDetail.chainDetailStats.bookingFailures')}
        value={chain.auxiliaryFailures}
        mono
        danger
      />
      <StatRow
        label={t('chainDetail.chainDetailStats.bookingSignal')}
        value={getAuxiliarySignalLabel(chain.auxiliarySignal, language)}
        blue
      />
      <StatRow
        label={t('chainDetail.chainDetailStats.bookingDuration')}
        value={t('auxiliaryJudgment.chainAuxiliaryDurationMin', {
          chainAuxiliaryDuration: chain.auxiliaryDuration,
        })}
        mono
        blue
      />
      <StatRow
        label={t('chainDetail.chainDetailStats.bookingCompletionTrigger')}
        value={getTriggerLabel(chain.auxiliaryCompletionTrigger, language)}
        blue
      />
      <div className="flex items-center justify-between border-t border-gray-200 pt-4">
        <span className="font-chinese text-gray-500 dark:text-slate-400">
          {t('chainDetail.chainDetailStats.successRate')}
        </span>
        <span className="font-mono text-xl font-bold text-primary-500">
          {successRate}%
        </span>
      </div>
    </div>
  </div>
);
