import React from 'react';
import { Chain } from '../types';
import { getGroupTimeStatus, startGroupTimer, isGroupExpired } from '../utils/timeLimit';

interface TimeLimitTestProps {
  group: Chain;
}

export const TimeLimitTest: React.FC<TimeLimitTestProps> = ({ group }) => {
  const timeStatus = getGroupTimeStatus(group);
  
  const handleStartTimer = () => {
    const updatedGroup = startGroupTimer(group);
    console.log('启动计时器:', updatedGroup);
  };

  const handleCheckExpired = () => {
    const expired = isGroupExpired(group);
    console.log('是否过期:', expired);
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl">
      <h3 className="text-lg font-bold font-chinese mb-4">时间限定测试</h3>
      
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            任务群: {group.name}
          </p>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            时间限制: {group.timeLimitHours || '无'} 小时
          </p>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            开始时间: {group.groupStartedAt ? group.groupStartedAt.toLocaleString() : '未开始'}
          </p>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            过期时间: {group.groupExpiresAt ? group.groupExpiresAt.toLocaleString() : '未设置'}
          </p>
        </div>

        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm font-chinese">
            状态: {timeStatus.formattedTime}
          </p>
          <p className="text-sm font-chinese">
            进度: {Math.round(timeStatus.progress * 100)}%
          </p>
          <p className="text-sm font-chinese">
            是否过期: {timeStatus.isExpired ? '是' : '否'}
          </p>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handleStartTimer}
            className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-chinese"
          >
            启动计时器
          </button>
          <button
            onClick={handleCheckExpired}
            className="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-chinese"
          >
            检查过期
          </button>
        </div>
      </div>
    </div>
  );
};
