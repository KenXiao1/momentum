import { useMemo, useState } from 'react';
import type React from 'react';
import type {
  Chain,
  CompletionHistory,
  RSIPExecutionRecord,
  RSIPLibraryEntry,
  RSIPMeta,
  RSIPNode,
  RSIPNodeGroup,
  RSIPRunRecord,
  RSIPTaskLink,
} from '../types';
import type { PetState } from '../types/pet';
import { useI18n } from '../i18n';
import { ImportExportModalView } from './ImportExportModalView';
import type { ImportCallback } from './import-export-modal/types';
import { useExportWorkflow } from './import-export-modal/useExportWorkflow';
import { useImportWorkflow } from './import-export-modal/useImportWorkflow';

interface ImportExportModalContainerProps {
  chains: Chain[];
  history?: CompletionHistory[];
  rsipNodes?: RSIPNode[];
  rsipMeta?: RSIPMeta;
  rsipGroups?: RSIPNodeGroup[];
  rsipPolicyLibrary?: RSIPLibraryEntry[];
  rsipRunHistory?: RSIPRunRecord[];
  rsipExecutionRecords?: RSIPExecutionRecord[];
  rsipTaskLinks?: RSIPTaskLink[];
  petState?: PetState | null;
  userPreferences?: unknown;
  onImport: ImportCallback;
  onClose: () => void;
}

export const ImportExportModalContainer: React.FC<
  ImportExportModalContainerProps
> = (props) => {
  const { language, t } = useI18n();
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(
    props.chains.length === 0 ? 'import' : 'export',
  );
  const exportData = useMemo(
    () => ({
      chains: props.chains,
      history: props.history,
      rsipNodes: props.rsipNodes,
      rsipMeta: props.rsipMeta,
      rsipGroups: props.rsipGroups,
      rsipPolicyLibrary: props.rsipPolicyLibrary,
      rsipRunHistory: props.rsipRunHistory,
      rsipExecutionRecords: props.rsipExecutionRecords,
      rsipTaskLinks: props.rsipTaskLinks,
      petState: props.petState,
      userPreferences: props.userPreferences,
    }),
    [
      props.chains,
      props.history,
      props.petState,
      props.rsipExecutionRecords,
      props.rsipGroups,
      props.rsipMeta,
      props.rsipNodes,
      props.rsipPolicyLibrary,
      props.rsipRunHistory,
      props.rsipTaskLinks,
      props.userPreferences,
    ],
  );
  const handleExport = useExportWorkflow(exportData);
  const importWorkflow = useImportWorkflow({
    existingRsipNodes: props.rsipNodes,
    existingRsipGroups: props.rsipGroups,
    onImport: props.onImport,
    onClose: props.onClose,
  });

  return (
    <ImportExportModalView
      chainsCount={props.chains.length}
      activeTab={activeTab}
      importData={importWorkflow.importData}
      importStatus={importWorkflow.importStatus}
      importError={importWorkflow.importError}
      importOptions={importWorkflow.importOptions}
      language={language}
      onTabChange={setActiveTab}
      onImportDataChange={importWorkflow.setImportData}
      onImportOptionsChange={importWorkflow.setImportOptions}
      onFileUpload={importWorkflow.handleFileUpload}
      onOpenFile={importWorkflow.handleOpenFile}
      onExport={handleExport}
      onImport={importWorkflow.handleImport}
      onClose={props.onClose}
      t={t}
    />
  );
};
