import type React from 'react';
import { CheckCircle, Download } from 'lucide-react';

export const ExportTab: React.FC<{
  chainsCount: number;
  language: 'zh' | 'en';
  onExport: () => void;
  tr: (zh: string, en: string) => string;
}> = ({ chainsCount, language, onExport, tr }) => (
  <div className="space-y-6">
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-700/50 dark:bg-blue-900/20">
      <h3 className="mb-3 font-chinese text-lg font-bold text-blue-900 dark:text-blue-100">
        {tr('导出全部数据', 'Export your data')}
      </h3>
      <p className="mb-4 font-chinese text-sm leading-relaxed text-blue-700 dark:text-blue-300">
        {tr(
          '导出功能将保存您当前的所有数据，包括任务链配置、统计数据、国策树扩展数据、宠物状态和例外规则。',
          'Export saves all your current data, including chains, stats, extended RSIP data, pet state, and exception rules.',
        )}
      </p>
      <div className="space-y-2">
        {[
          tr('任务链配置与统计', 'Chain config & stats'),
          tr('完成历史记录', 'Completion history'),
          tr('国策树（RSIP）完整数据', 'Full RSIP dataset'),
          tr('宠物状态', 'Pet state'),
          tr('例外规则配置', 'Exception rules'),
        ].map((text) => (
          <div
            key={text}
            className="flex items-center space-x-2 text-blue-600 dark:text-blue-400"
          >
            <CheckCircle size={16} />
            <span className="font-chinese text-sm">{text}</span>
          </div>
        ))}
      </div>
    </div>
    <div className="text-center">
      <p className="mb-4 font-chinese text-gray-600 dark:text-slate-400">
        {language === 'zh' ? (
          <>
            当前共有{' '}
            <span className="font-bold text-primary-500">{chainsCount}</span>{' '}
            条任务链
          </>
        ) : (
          <>
            You have{' '}
            <span className="font-bold text-primary-500">{chainsCount}</span>{' '}
            chain{chainsCount === 1 ? '' : 's'}
          </>
        )}
      </p>
      <button
        type="button"
        onClick={onExport}
        aria-label={tr('导出为 JSON 文件', 'Export as JSON')}
        className="gradient-primary mx-auto flex items-center space-x-3 rounded-2xl px-8 py-4 font-chinese font-medium text-white shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
      >
        <Download size={20} />
        <span>{tr('导出为 JSON 文件', 'Export as JSON')}</span>
      </button>
    </div>
  </div>
);
