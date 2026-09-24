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
  t,
}) => (
  <div className="mb-8 rounded-2xl border border-red-200/60 bg-red-50/80 p-6 dark:border-red-800/40 dark:bg-red-900/20">
    <div className="mb-6 text-center">
      <p className="font-chinese text-sm font-medium text-red-600 dark:text-red-400">
        {t(
          'chainDetail.deleteConfirmModal.theChainWillMoveToTheRecycleBinThese',
        )}
      </p>
    </div>
    <div className="grid grid-cols-2 gap-4 text-sm text-red-600 dark:text-red-400">
      <DeleteDataCard
        icon={<Flame size={16} />}
        title={t('chainDetail.deleteConfirmModal.mainChain')}
        items={[
          {
            label: t('chainDetail.deleteConfirmModal.streak'),
            value: `#${chain.currentStreak}`,
          },
          {
            label: t('chainDetail.deleteConfirmModal.completions'),
            value: chain.totalCompletions,
          },
          {
            label: t('chainDetail.deleteConfirmModal.failures'),
            value: chain.totalFailures,
          },
        ]}
      />
      <DeleteDataCard
        icon={<Calendar size={16} />}
        title={t('chainDetail.deleteConfirmModal.booking')}
        items={[
          {
            label: t('chainDetail.deleteConfirmModal.streak'),
            value: `#${chain.auxiliaryStreak}`,
          },
          {
            label: t('chainDetail.deleteConfirmModal.failures'),
            value: chain.auxiliaryFailures,
          },
          {
            label: t('chainDetail.deleteConfirmModal.exceptions'),
            value: t('counts.entries', {
              count: chain.auxiliaryExceptions?.length || 0,
            }),
          },
        ]}
      />
    </div>
    <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-red-600 dark:text-red-400">
      <DeleteDataCard
        icon={<Clock size={16} />}
        title={t('chainDetail.deleteConfirmModal.history')}
        items={[
          {
            label: t('chainDetail.deleteConfirmModal.records'),
            value: t('counts.entries', { count: chainHistoryCount }),
          },
          {
            label: t('chainDetail.deleteConfirmModal.successRate'),
            value: `${successRate}%`,
          },
          {
            label: '',
            value: t('chainDetail.deleteConfirmModal.timeStats'),
            isChinese: true,
          },
        ]}
      />
      <DeleteDataCard
        icon={<AlertCircle size={16} />}
        title={t('chainDetail.deleteConfirmModal.rules')}
        items={[
          {
            label: t('chainDetail.deleteConfirmModal.exceptions'),
            value: t('counts.entries', { count: chain.exceptions.length }),
          },
          {
            label: t('chainDetail.deleteConfirmModal.bookingExceptions'),
            value: t('counts.entries', {
              count: chain.auxiliaryExceptions?.length || 0,
            }),
          },
          {
            label: '',
            value: t('chainDetail.deleteConfirmModal.allSettings'),
            isChinese: true,
          },
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
  t,
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
          {t('chainDetail.deleteConfirmModal.deleteChain')}
        </h3>
        <p className="mb-6 font-chinese text-gray-600 dark:text-slate-300">
          {t(
            'chainDetail.deleteConfirmModal.areYouSureYouWantToDeleteTheChain',
          )}
          <span className="font-semibold text-primary-500">{chain.name}</span>
          {t('chainDetail.deleteConfirmModal.label')}
        </p>
      </div>

      <DeleteDataSummary
        chain={chain}
        chainHistoryCount={chainHistoryCount}
        successRate={successRate}
        language={language}
        t={t}
      />

      <div className="flex flex-col space-y-3 sm:flex-row sm:space-x-4 sm:space-y-0">
        <button
          onClick={onCancel}
          className="flex-1 rounded-2xl bg-gray-100 px-6 py-4 font-chinese font-medium text-gray-700 transition duration-300 hover:scale-105 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        >
          {t('bettingModal.bettingFormSections.cancel')}
        </button>
        <button
          onClick={onConfirm}
          className="flex flex-1 items-center justify-center space-x-2 rounded-2xl bg-red-500 px-6 py-4 font-chinese font-medium text-white shadow-lg transition duration-300 hover:scale-105 hover:bg-red-600 hover:shadow-xl"
        >
          <Trash2 size={16} />
          <span>{t('chainDetail.deleteConfirmModal.delete')}</span>
        </button>
      </div>
    </div>
  </div>
);
