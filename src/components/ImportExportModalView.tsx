import React from 'react';
import { Download, Upload, X, FileText } from 'lucide-react';
import type { ImportExportImportOptions } from '../services/ImportExportService';
import {
  type ImportStatus,
  ImportInfoBox,
  FileUploadSection,
  ManualInputSection,
  ImportOptionsSection,
  ImportStatusDisplay,
  ImportButton,
  ExportTab,
} from './ImportExportModalParts';
import { DialogShell } from './shared/DialogShell';

interface ImportExportModalViewProps {
  chainsCount: number;
  activeTab: 'export' | 'import';
  importData: string;
  importStatus: ImportStatus;
  importError: string;
  importOptions: ImportExportImportOptions;
  language: 'zh' | 'en';
  onTabChange: (tab: 'export' | 'import') => void;
  onImportDataChange: (data: string) => void;
  onImportOptionsChange: (options: ImportExportImportOptions) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenFile?: () => void;
  onExport: () => void;
  onImport: () => void;
  onClose: () => void;
  tr: (zh: string, en: string) => string;
}

export const ImportExportModalView: React.FC<ImportExportModalViewProps> = ({
  chainsCount,
  activeTab,
  importData,
  importStatus,
  importError,
  importOptions,
  language,
  onTabChange,
  onImportDataChange,
  onImportOptionsChange,
  onFileUpload,
  onOpenFile,
  onExport,
  onImport,
  onClose,
  tr,
}) => {
  const isImportDisabled =
    !importData.trim() ||
    importStatus === 'success' ||
    importStatus === 'checking-auth' ||
    importStatus === 'creating-session' ||
    importStatus === 'importing';

  const isImporting =
    importStatus === 'checking-auth' ||
    importStatus === 'creating-session' ||
    importStatus === 'importing';

  return (
    <DialogShell
      titleId="import-export-modal-title"
      onClose={onClose}
      className="w-full max-w-2xl animate-scale-in overflow-y-auto rounded-3xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-800 sm:p-6"
    >
      <ModalHeader onClose={onClose} tr={tr} />
      <TabNavigation activeTab={activeTab} onTabChange={onTabChange} tr={tr} />

      {activeTab === 'export' && (
        <ExportTab
          chainsCount={chainsCount}
          onExport={onExport}
          language={language}
          tr={tr}
        />
      )}

      {activeTab === 'import' && (
        <ImportTab
          importData={importData}
          importStatus={importStatus}
          importError={importError}
          importOptions={importOptions}
          isImportDisabled={isImportDisabled}
          isImporting={isImporting}
          onImportDataChange={onImportDataChange}
          onImportOptionsChange={onImportOptionsChange}
          onFileUpload={onFileUpload}
          onOpenFile={onOpenFile}
          onImport={onImport}
          tr={tr}
        />
      )}
    </DialogShell>
  );
};

const ModalHeader: React.FC<{
  onClose: () => void;
  tr: (zh: string, en: string) => string;
}> = ({ onClose, tr }) => (
  <div className="mb-8 flex items-center justify-between">
    <div className="flex items-center space-x-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500/10">
        <FileText className="text-primary-500" size={24} />
      </div>
      <div>
        <h2
          id="import-export-modal-title"
          className="font-chinese text-2xl font-bold text-gray-900 dark:text-slate-100"
        >
          {tr('数据管理', 'Data management')}
        </h2>
        <p className="font-mono text-sm tracking-wide text-gray-500">
          {tr('数据管理', 'DATA MANAGEMENT')}
        </p>
      </div>
    </div>
    <button
      type="button"
      onClick={onClose}
      aria-label={tr('关闭', 'Close')}
      className="rounded-xl p-2 text-gray-400 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
    >
      <X size={20} />
    </button>
  </div>
);

interface TabNavigationProps {
  activeTab: 'export' | 'import';
  onTabChange: (tab: 'export' | 'import') => void;
  tr: (zh: string, en: string) => string;
}

const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
  tr,
}) => (
  <div className="mb-8 flex rounded-2xl bg-gray-100 p-1 dark:bg-slate-700">
    <button
      type="button"
      onClick={() => onTabChange('export')}
      className={`flex flex-1 items-center justify-center space-x-2 rounded-xl px-4 py-3 font-chinese font-medium transition duration-300 ${
        activeTab === 'export'
          ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-600 dark:text-slate-100'
          : 'text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200'
      }`}
    >
      <Download size={16} />
      <span>{tr('导出数据', 'Export')}</span>
    </button>
    <button
      type="button"
      onClick={() => onTabChange('import')}
      className={`flex flex-1 items-center justify-center space-x-2 rounded-xl px-4 py-3 font-chinese font-medium transition duration-300 ${
        activeTab === 'import'
          ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-600 dark:text-slate-100'
          : 'text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200'
      }`}
    >
      <Upload size={16} />
      <span>{tr('导入数据', 'Import')}</span>
    </button>
  </div>
);

interface ImportTabProps {
  importData: string;
  importStatus: ImportStatus;
  importError: string;
  importOptions: ImportExportImportOptions;
  isImportDisabled: boolean;
  isImporting: boolean;
  onImportDataChange: (data: string) => void;
  onImportOptionsChange: (options: ImportExportImportOptions) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenFile?: () => void;
  onImport: () => void;
  tr: (zh: string, en: string) => string;
}

const ImportTab: React.FC<ImportTabProps> = ({
  importData,
  importStatus,
  importError,
  importOptions,
  isImportDisabled,
  isImporting,
  onImportDataChange,
  onImportOptionsChange,
  onFileUpload,
  onOpenFile,
  onImport,
  tr,
}) => (
  <div className="space-y-6">
    <ImportInfoBox tr={tr} />
    <FileUploadSection onFileUpload={onFileUpload} tr={tr} />
    {onOpenFile && <SystemFilePickerButton onOpenFile={onOpenFile} tr={tr} />}
    <ManualInputSection
      importData={importData}
      onImportDataChange={onImportDataChange}
      tr={tr}
    />
    <ImportOptionsSection
      importOptions={importOptions}
      onImportOptionsChange={onImportOptionsChange}
      tr={tr}
    />
    <ImportStatusDisplay
      importStatus={importStatus}
      importError={importError}
      tr={tr}
    />
    <ImportButton
      importStatus={importStatus}
      isImportDisabled={isImportDisabled}
      isImporting={isImporting}
      onImport={onImport}
      tr={tr}
    />
  </div>
);

const SystemFilePickerButton: React.FC<{
  onOpenFile: () => void;
  tr: (zh: string, en: string) => string;
}> = ({ onOpenFile, tr }) => (
  <button
    type="button"
    onClick={onOpenFile}
    className="rounded-xl border border-gray-200 px-4 py-2 font-chinese text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
  >
    {tr('使用系统文件选择器', 'Use system file picker')}
  </button>
);
