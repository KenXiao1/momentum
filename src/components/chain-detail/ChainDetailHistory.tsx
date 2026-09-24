import React from 'react';
import {
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  ListTodo,
  StickyNote,
} from 'lucide-react';
import {
  HistorySectionProps,
  HistoryRecordProps,
  TranslationFn,
} from './types';
import { formatTime, formatActualDuration } from '../../utils/time';

const EmptyHistory: React.FC<{ t: TranslationFn }> = ({ t }) => (
  <div className="py-16 text-center text-gray-500 dark:text-slate-400">
    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gray-100">
      <Calendar size={32} className="text-gray-400" />
    </div>
    <p className="font-chinese text-lg">
      {t('chainDetail.chainDetailHistory.noCompletionRecordsYet')}
    </p>
    <p className="mt-2 font-mono text-sm text-gray-400 dark:text-slate-500">
      {t('chainDetail.chainDetailHistory.noCompletionRecordsYetVariant2')}
    </p>
  </div>
);

const HistoryRecord: React.FC<HistoryRecordProps> = ({
  record,
  locale,
  language,
  t,
  formatFailureReason,
}) => (
  <div className="rounded-2xl bg-gray-50 p-6 transition-colors duration-200 hover:bg-gray-100 dark:bg-slate-700/50 dark:hover:bg-slate-700">
    <div className="mb-4 flex items-start justify-between">
      <div className="flex items-center space-x-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
            record.wasSuccessful
              ? 'bg-green-500/10 text-green-500'
              : 'bg-red-500/10 text-red-500'
          }`}
        >
          {record.wasSuccessful ? (
            <CheckCircle size={24} />
          ) : (
            <XCircle size={24} />
          )}
        </div>
        <div>
          <p className="font-chinese text-lg font-medium text-[#161615] dark:text-slate-100">
            {record.wasSuccessful
              ? t('chainDetail.chainDetailHistory.completed')
              : t('chainDetail.chainDetailHistory.failed')}
          </p>
          {!record.wasSuccessful && record.reasonForFailure && (
            <p className="mt-1 font-chinese text-sm text-red-500 dark:text-red-400">
              {formatFailureReason(record.reasonForFailure)}
            </p>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className="mb-1 font-mono text-sm text-gray-500 dark:text-slate-400">
          {new Intl.DateTimeFormat(locale).format(record.completedAt)}
        </p>
        <div className="flex items-center space-x-2 text-sm text-gray-400 dark:text-slate-500">
          <Clock size={14} />
          <span className="font-mono">
            {record.actualDuration
              ? formatActualDuration(
                  record.actualDuration,
                  record.isForwardTimed,
                  language,
                )
              : formatTime(record.duration, language)}
          </span>
        </div>
      </div>
    </div>

    {(record.description || record.notes) && (
      <HistoryRecordDetails record={record} t={t} />
    )}
  </div>
);

const HistoryRecordDetails: React.FC<{
  record: HistoryRecordProps['record'];
  t: TranslationFn;
}> = ({ record, t }) => (
  <div className="space-y-3">
    {record.description && (
      <div className="rounded-xl border border-gray-200/50 bg-white p-4 dark:border-slate-500/30 dark:bg-slate-600/30">
        <div className="mb-2 flex items-center space-x-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/20">
            <ListTodo className="text-blue-500" size={14} />
          </div>
          <span className="font-chinese text-xs font-medium text-blue-600 dark:text-blue-400">
            {t('chainEditor.description.title')}
          </span>
        </div>
        <p className="font-chinese text-sm leading-relaxed text-gray-700 dark:text-slate-200">
          {record.description}
        </p>
      </div>
    )}

    {record.notes && (
      <div className="rounded-xl border border-gray-200/50 bg-white p-4 dark:border-slate-500/30 dark:bg-slate-600/30">
        <div className="mb-2 flex items-center space-x-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 dark:bg-amber-500/20">
            <StickyNote className="text-amber-500" size={14} />
          </div>
          <span className="font-chinese text-xs font-medium text-amber-600 dark:text-amber-400">
            {t('chainDetail.chainDetailHistory.notes')}
          </span>
        </div>
        <p className="font-chinese text-sm leading-relaxed text-gray-700 dark:text-slate-200">
          {record.notes}
        </p>
      </div>
    )}
  </div>
);

export const ChainDetailHistory: React.FC<HistorySectionProps> = ({
  recentHistory,
  locale,
  language,
  t,
  formatFailureReason,
}) => (
  <div className="bento-card animate-scale-in">
    <h3 className="mb-6 flex items-center space-x-3 font-chinese text-xl font-bold text-[#161615] dark:text-slate-100">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500/10">
        <Calendar size={20} className="text-primary-500" />
      </div>
      <div>
        <span>{t('chainDetail.chainDetailHistory.recentHistory')}</span>
        <p className="font-mono text-xs tracking-wide text-gray-500 dark:text-slate-400">
          {t('chainDetail.chainDetailHistory.recentHistoryVariant2')}
        </p>
      </div>
    </h3>

    {recentHistory.length === 0 ? (
      <EmptyHistory t={t} />
    ) : (
      <div className="space-y-4">
        {recentHistory.map((record, index) => (
          <HistoryRecord
            key={index}
            record={record}
            locale={locale}
            language={language}
            t={t}
            formatFailureReason={formatFailureReason}
          />
        ))}
      </div>
    )}
  </div>
);
