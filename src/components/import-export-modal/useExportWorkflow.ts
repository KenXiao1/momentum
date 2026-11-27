import { useCallback, useContext, useState } from 'react';
import { ChainTagsContext } from '../chain-tags/ChainTagsContext';
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
} from '../../types';
import type { PetState } from '../../types/pet';
import { exceptionRuleManager } from '../../services/exception-rule-manager/ExceptionRuleManager';
import {
  importExportService,
  type MomentumExportDataV3,
} from '../../services/ImportExportService';
import { toError } from '../../utils/errorMessage';
import { logger } from '../../utils/logger';
import { getPlatformCapabilityCenter } from '../../utils/platform-capabilities/center';

export function useExportWorkflow(data: {
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
}) {
  const file = getPlatformCapabilityCenter().file;
  const chainTags = useContext(ChainTagsContext)?.tagSet;
  const [exportFailed, setExportFailed] = useState(false);
  const handleExport = useCallback(async () => {
    setExportFailed(false);
    try {
      const exportData: MomentumExportDataV3 =
        importExportService.createExportData({
          ...data,
          exceptionRules: await exceptionRuleManager.exportRules(true),
          chainTags,
        });
      const saved = await file.saveFile(
        JSON.stringify(exportData, null, 2),
        `momentum-data-${new Date().toISOString().split('T')[0]}.json`,
      );
      if (!saved)
        logger.warn('IMPORT_EXPORT', 'Export canceled or unsupported');
    } catch (error) {
      logger.error('IMPORT_EXPORT', 'Export failed', undefined, toError(error));
      setExportFailed(true);
    }
  }, [chainTags, data, file]);
  return { handleExport, exportFailed };
}
