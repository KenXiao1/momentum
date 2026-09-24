import { type Translator } from '../../i18n';
import type React from 'react';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Shield,
} from 'lucide-react';
import type { ImportExportImportOptions } from '../../services/ImportExportService';

type Tr = Translator;

export const ImportInfoBox: React.FC<{ t: Tr }> = ({ t }) => (
  <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-700/50 dark:bg-yellow-900/20">
    <h3 className="mb-3 font-chinese text-lg font-bold text-yellow-900 dark:text-yellow-100">
      {t('importExportModal.importFields.importData')}
    </h3>
    <p className="mb-4 font-chinese text-sm leading-relaxed text-yellow-700 dark:text-yellow-300">
      {t(
        'importExportModal.importFields.importAddsNewDataToYourSystemIncludingChains',
      )}
    </p>
    <div className="mb-4 space-y-2">
      {[
        t('importExportModal.importFields.chainsNewIds'),
        t('importExportModal.importFields.rsipNodesExtendedRecords'),
        t('importExportModal.importFields.petStateOverwriteOnImport'),
        t('importExportModal.importFields.exceptionRulesSkipDuplicates'),
      ].map((text) => (
        <div
          key={text}
          className="flex items-center space-x-2 text-yellow-600 dark:text-yellow-400"
        >
          <CheckCircle size={16} />
          <span className="font-chinese text-sm">{text}</span>
        </div>
      ))}
    </div>
    <div className="flex items-center space-x-2 text-yellow-600 dark:text-yellow-400">
      <AlertCircle size={16} />
      <span className="font-chinese text-sm">
        {t(
          'importExportModal.importFields.makeSureTheJsonFileWasExportedFromMomentum',
        )}
      </span>
    </div>
  </div>
);

export const FileUploadSection: React.FC<{
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  t: Tr;
}> = ({ onFileUpload, t }) => (
  <div className="space-y-4">
    <label className="block font-chinese text-sm font-medium text-gray-700 dark:text-slate-300">
      {t('importExportModal.importFields.chooseAFile')}
    </label>
    <input
      type="file"
      name="importFile"
      accept=".json"
      onChange={onFileUpload}
      aria-label={t('importExportModal.importFields.chooseAFileToImport')}
      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 transition duration-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
    />
  </div>
);

export const ManualInputSection: React.FC<{
  importData: string;
  onImportDataChange: (data: string) => void;
  t: Tr;
}> = ({ importData, onImportDataChange, t }) => (
  <div className="space-y-4">
    <label className="block font-chinese text-sm font-medium text-gray-700 dark:text-slate-300">
      {t('importExportModal.importFields.orPasteJsonManually')}
    </label>
    <textarea
      name="importData"
      value={importData}
      onChange={(event) => onImportDataChange(event.target.value)}
      placeholder={t(
        'importExportModal.importFields.pasteTheJsonExportedFromMomentum',
      )}
      aria-label={t('importExportModal.importFields.jsonData')}
      className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-900 placeholder-gray-400 transition duration-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
      rows={8}
    />
  </div>
);

const OptionCheckbox: React.FC<{
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: React.ReactNode;
  label: string;
  ariaLabel: string;
}> = ({ name, checked, onChange, icon, label, ariaLabel }) => (
  <label className="flex cursor-pointer items-center space-x-3">
    <input
      type="checkbox"
      name={name}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={ariaLabel}
      className="form-checkbox h-4 w-4 rounded text-primary-500 focus:ring-primary-500"
    />
    <div className="flex items-center space-x-2">
      {icon}
      <span className="font-chinese text-sm text-gray-700 dark:text-slate-300">
        {label}
      </span>
    </div>
  </label>
);

export const ImportOptionsSection: React.FC<{
  importOptions: ImportExportImportOptions;
  onImportOptionsChange: (options: ImportExportImportOptions) => void;
  t: Tr;
}> = ({ importOptions, onImportOptionsChange, t }) => {
  const options = [
    {
      name: 'preserveStatistics',
      checked: importOptions.preserveStatistics,
      icon: <Shield size={16} className="text-gray-500" />,
      label: t(
        'importExportModal.importFields.preserveStatisticsStreaksCompletionsEtc',
      ),
      ariaLabel: t('importExportModal.importFields.preserveStatistics'),
    },
    {
      name: 'preserveTimestamps',
      checked: importOptions.preserveTimestamps,
      icon: <Clock size={16} className="text-gray-500" />,
      label: t(
        'importExportModal.importFields.preserveOriginalTimestampsCreatedAtCompletedAtEtc',
      ),
      ariaLabel: t('importExportModal.importFields.preserveOriginalTimestamps'),
    },
    {
      name: 'importCompletionHistory',
      checked: importOptions.importCompletionHistory,
      icon: <FileText size={16} className="text-gray-500" />,
      label: t('importExportModal.importFields.importCompletionHistory'),
      ariaLabel: t('importExportModal.importFields.importCompletionHistory'),
    },
  ] as const;

  return (
    <div className="space-y-4">
      <h4 className="font-chinese text-sm font-medium text-gray-700 dark:text-slate-300">
        {t('importExportModal.importFields.importOptions')}
      </h4>
      <div className="space-y-3 rounded-2xl bg-gray-50 p-4 dark:bg-slate-700/50">
        {options.map((option) => (
          <OptionCheckbox
            key={option.name}
            {...option}
            onChange={(checked) =>
              onImportOptionsChange({
                ...importOptions,
                [option.name]: checked,
              })
            }
          />
        ))}
      </div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-700/50 dark:bg-blue-900/20">
        <div className="flex items-start space-x-2">
          <Shield
            size={16}
            className="mt-0.5 text-blue-600 dark:text-blue-400"
          />
          <div className="font-chinese text-xs text-blue-700 dark:text-blue-300">
            <p className="mb-1 font-medium">
              {t('importExportModal.importFields.safeImport')}
            </p>
            <p>
              {t(
                'importExportModal.importFields.importedDataIsAutomaticallyAssociatedWithYourAccount',
              )}
            </p>
            <p>
              {t(
                'importExportModal.importFields.idConflictsAreResolvedAutomaticallyWithNewUnique',
              )}
            </p>
            <p>
              {t(
                'importExportModal.importFields.importSessionsExpireAutomaticallyAfter30Minutes',
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
