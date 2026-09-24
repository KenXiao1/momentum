import { InlineTranslation } from '../shared/InlineTranslation';
import { type Translator } from '../../i18n';
import type React from 'react';
import { CheckCircle, Download } from 'lucide-react';

export const ExportTab: React.FC<{
  chainsCount: number;
  language: 'zh' | 'en';
  onExport: () => void;
  t: Translator;
}> = ({ chainsCount, onExport, t }) => (
  <div className="space-y-6">
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-700/50 dark:bg-blue-900/20">
      <h3 className="mb-3 font-chinese text-lg font-bold text-blue-900 dark:text-blue-100">
        {t('importExportModal.exportTab.exportYourData')}
      </h3>
      <p className="mb-4 font-chinese text-sm leading-relaxed text-blue-700 dark:text-blue-300">
        {t(
          'importExportModal.exportTab.exportSavesAllYourCurrentDataIncludingChainsStats',
        )}
      </p>
      <div className="space-y-2">
        {[
          t('importExportModal.exportTab.chainConfigStats'),
          t('importExportModal.exportTab.completionHistory'),
          t('importExportModal.exportTab.fullRsipDataset'),
          t('importExportModal.exportTab.petState'),
          t('importExportModal.exportTab.exceptionRules'),
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
        <InlineTranslation
          text={
            chainsCount === 1
              ? t('export.chainCountOne', { count: '[[count]]' })
              : t('export.chainCountMany', { count: '[[count]]' })
          }
          values={{
            count: (
              <span className="font-bold text-primary-500">{chainsCount}</span>
            ),
          }}
        />
      </p>
      <button
        type="button"
        onClick={onExport}
        aria-label={t('importExportModal.exportTab.exportAsJson')}
        className="gradient-primary mx-auto flex items-center space-x-3 rounded-2xl px-8 py-4 font-chinese font-medium text-white shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
      >
        <Download size={20} />
        <span>{t('importExportModal.exportTab.exportAsJson')}</span>
      </button>
    </div>
  </div>
);
