import React from 'react';
import { Trash2, Flame, Calendar, Clock, AlertCircle } from 'lucide-react';
import {
  DeleteConfirmModalProps,
  DeleteDataSummaryProps,
  DeleteDataCardProps,
} from './types';

const DeleteDataCard: React.FC<DeleteDataCardProps> = ({
  icon,
  title,
  items,
}) => (
  <div className="rounded-xl border border-red-200/60 bg-white/80 p-4 dark:border-red-800/40 dark:bg-slate-700/50">
    <div className="mb-3 flex items-center font-chinese font-semibold">
      <div className="mr-2 flex h-6 w-6 items-center justify-center rounded-lg bg-red-500/10 dark:bg-red-500/20">
        {icon}
      </div>
      {title}
    </div>
    <div className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
      {items.map((item, index) => (
        <div
          key={index}
          className={item.isChinese ? 'font-chinese' : 'font-mono'}
        >
          {item.label}
          {item.value}
        </div>
      ))}
    </div>
  </div>
);

const DeleteDataSummary: React.FC<DeleteDataSummaryProps> = ({
  chain,
  chainHistoryCount,
  successRate,
  language,
  tr,
}) => (
  <div className="mb-8 rounded-2xl border border-red-200/60 bg-red-50/80 p-6 dark:border-red-800/40 dark:bg-red-900/20">
    <div className="mb-6 text-center">
      <p className="font-chinese text-sm font-medium text-red-600 dark:text-red-400">
        {tr(
          '链条将移入回收箱，以下数据将保留，30 天内可恢复：',
          'The chain will move to the recycle bin. These data will be kept and can be restored within 30 days:',
        )}
      </p>
    </div>
    <div className="grid grid-cols-2 gap-4 text-sm text-red-600 dark:text-red-400">
      <DeleteDataCard
        icon={<Flame size={16} />}
        title={tr('主链数据', 'Main chain')}
        items={[
          { label: tr('记录: ', 'Streak: '), value: `#${chain.currentStreak}` },
          {
            label: tr('完成: ', 'Completions: '),
            value: chain.totalCompletions,
          },
          { label: tr('失败: ', 'Failures: '), value: chain.totalFailures },
        ]}
      />
      <DeleteDataCard
        icon={<Calendar size={16} />}
        title={tr('预约链数据', 'Booking')}
        items={[
          {
            label: tr('记录: ', 'Streak: '),
            value: `#${chain.auxiliaryStreak}`,
          },
          { label: tr('失败: ', 'Failures: '), value: chain.auxiliaryFailures },
          {
            label: tr('例外: ', 'Exceptions: '),
            value: `${chain.auxiliaryExceptions?.length || 0}${language === 'zh' ? ' 条' : ''}`,
          },
        ]}
      />
    </div>
    <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-red-600 dark:text-red-400">
      <DeleteDataCard
        icon={<Clock size={16} />}
        title={tr('历史记录', 'History')}
        items={[
          {
            label: tr('记录: ', 'Records: '),
            value: `${chainHistoryCount}${language === 'zh' ? ' 条' : ''}`,
          },
          { label: tr('成功率: ', 'Success rate: '), value: `${successRate}%` },
          { label: '', value: tr('时间统计', 'Time stats'), isChinese: true },
        ]}
      />
      <DeleteDataCard
        icon={<AlertCircle size={16} />}
        title={tr('规则设置', 'Rules')}
        items={[
          {
            label: tr('例外: ', 'Exceptions: '),
            value: `${chain.exceptions.length}${language === 'zh' ? ' 条' : ''}`,
          },
          {
            label: tr('预约例外: ', 'Booking exceptions: '),
            value: `${chain.auxiliaryExceptions?.length || 0}${language === 'zh' ? ' 条' : ''}`,
          },
          { label: '', value: tr('所有配置', 'All settings'), isChinese: true },
        ]}
      />
    </div>
  </div>
);

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  chain,
  chainHistoryCount,
  successRate,
  language,
  tr,
  onConfirm,
  onCancel,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="w-full max-w-lg animate-scale-in rounded-3xl border border-gray-200/60 bg-white/95 p-8 shadow-2xl backdrop-blur-xl dark:border-slate-600/60 dark:bg-slate-800/95">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 dark:bg-red-500/20">
          <Trash2 className="text-red-500" size={32} />
        </div>
        <h3 className="mb-3 font-chinese text-2xl font-bold text-[#161615] dark:text-slate-100">
          {tr('确认删除链条', 'Delete chain?')}
        </h3>
        <p className="mb-6 font-chinese text-gray-600 dark:text-slate-300">
          {tr(
            '你确定要删除链条 "',
            'Are you sure you want to delete the chain "',
          )}
          <span className="font-semibold text-primary-500">{chain.name}</span>
          {tr('" 吗？', '"?')}
        </p>
      </div>

      <DeleteDataSummary
        chain={chain}
        chainHistoryCount={chainHistoryCount}
        successRate={successRate}
        language={language}
        tr={tr}
      />

      <div className="flex flex-col space-y-3 sm:flex-row sm:space-x-4 sm:space-y-0">
        <button
          onClick={onCancel}
          className="flex-1 rounded-2xl bg-gray-100 px-6 py-4 font-chinese font-medium text-gray-700 transition duration-300 hover:scale-105 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        >
          {tr('取消', 'Cancel')}
        </button>
        <button
          onClick={onConfirm}
          className="flex flex-1 items-center justify-center space-x-2 rounded-2xl bg-red-500 px-6 py-4 font-chinese font-medium text-white shadow-lg transition duration-300 hover:scale-105 hover:bg-red-600 hover:shadow-xl"
        >
          <Trash2 size={16} />
          <span>{tr('确认删除', 'Delete')}</span>
        </button>
      </div>
    </div>
  </div>
);
