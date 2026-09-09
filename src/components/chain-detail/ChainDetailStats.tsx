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
  tr,
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
            {tr('主链当前记录', 'Main streak')}
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
            {tr('预约链当前记录', 'Booking streak')}
          </p>
        </div>
      </div>
    </div>

    <div className="space-y-4">
      <StatRow
        label={tr('触发动作', 'Trigger')}
        value={getTriggerLabel(chain.trigger, language)}
      />
      <StatRow
        label={tr('任务时长', 'Duration')}
        value={formatChainDuration(chain, language)}
        mono
      />
      <StatRow
        label={tr('总完成次数', 'Total completions')}
        value={chain.totalCompletions}
        mono
        success
      />
      <StatRow
        label={tr('失败次数', 'Failures')}
        value={chain.totalFailures}
        mono
        danger
      />
      <StatRow
        label={tr('预约链失败', 'Booking failures')}
        value={chain.auxiliaryFailures}
        mono
        danger
      />
      <StatRow
        label={tr('预约信号', 'Booking signal')}
        value={getAuxiliarySignalLabel(chain.auxiliarySignal, language)}
        blue
      />
      <StatRow
        label={tr('预约时长', 'Booking duration')}
        value={tr(
          `${chain.auxiliaryDuration}分钟`,
          `${chain.auxiliaryDuration} min`,
        )}
        mono
        blue
      />
      <StatRow
        label={tr('预约完成条件', 'Booking completion trigger')}
        value={getTriggerLabel(chain.auxiliaryCompletionTrigger, language)}
        blue
      />
      <div className="flex items-center justify-between border-t border-gray-200 pt-4">
        <span className="font-chinese text-gray-500 dark:text-slate-400">
          {tr('成功率', 'Success rate')}
        </span>
        <span className="font-mono text-xl font-bold text-primary-500">
          {successRate}%
        </span>
      </div>
    </div>
  </div>
);
