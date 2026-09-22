import { useCallback, useRef, useState } from 'react';
import type React from 'react';
import type { RSIPNode, RSIPNodeGroup } from '../../types';
import { useI18n, type Language } from '../../i18n';
import { prepareImportPlan } from '../../services/import-export/importPlan';
import { exceptionRuleManager } from '../../services/ExceptionRuleManager';
import { type ImportExportImportOptions } from '../../services/ImportExportService';
import { hasStorageCapability } from '../../storage/ports';
import { useStorage } from '../../storage/useStorage';
import { getSafeErrorDetail } from '../../utils/errorMessage';
import { normalizeUnknownError } from '../../utils/errors/normalizeError';
import { logger } from '../../utils/logger';
import { getPlatformCapabilityCenter } from '../../utils/platform-capabilities/center';
import type { ImportCallback, ImportStatus } from './types';

function getImportErrorMessage(
  error: unknown,
  language: Language,
  tr: (zh: string, en: string) => string,
) {
  if (error instanceof SyntaxError) {
    return tr(
      '导入数据格式错误：请确保上传的是有效的JSON格式文件。',
      'Invalid import format: please make sure you uploaded a valid JSON file.',
    );
  }
  if (!(error instanceof Error))
    return tr('导入失败：未知错误', 'Import failed: unknown error');
  if (
    error.message.includes('身份验证失败') ||
    error.message.includes('Authentication failed')
  ) {
    return tr(
      '用户身份验证失败：请确保您已正确登录，然后重试导入操作。',
      'Authentication failed: please make sure you are signed in and try importing again.',
    );
  }
  if (error.message.includes('导入数据格式错误')) {
    return tr(
      '导入数据格式错误：文件中未找到有效的链条数据。请确保文件是从Momentum导出的有效数据。',
      'Invalid import format: no valid chains found. Please make sure this file was exported from Momentum.',
    );
  }
  const detail = getSafeErrorDetail(error.message, language);
  return detail
    ? tr(`导入失败：${detail}`, `Import failed: ${detail}`)
    : tr(
        '导入失败，请重试（详情见控制台）',
        'Import failed. Check the console for details, then try again.',
      );
}

export function useImportWorkflow(params: {
  existingRsipNodes?: RSIPNode[];
  existingRsipGroups?: RSIPNodeGroup[];
  onImport: ImportCallback;
  onClose: () => void;
}) {
  const storage = useStorage();
  const { language, tr } = useI18n();
  const file = getPlatformCapabilityCenter().file;
  const [importData, setImportData] = useState('');
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importError, setImportError] = useState('');
  const [importOptions, setImportOptions] = useState<ImportExportImportOptions>(
    {
      preserveStatistics: false,
      preserveTimestamps: false,
      importCompletionHistory: true,
    },
  );

  const importing = useRef(false);
  const handleImport = useCallback(async () => {
    if (importing.current) return;
    importing.current = true;
    try {
      setImportStatus('checking-auth');
      setImportError('');
      let scope = storage.kind as string;
      let expectedUserId: string | undefined;
      if (hasStorageCapability(storage, 'auth')) {
        const result = await storage.waitForAuthentication(10000);
        if (!result.ok || !result.value.isAuthenticated || !result.value.user) {
          throw new Error(
            tr(
              '用户身份验证失败。请确保您已正确登录，然后重试导入操作。',
              'Authentication failed. Please make sure you are signed in and try importing again.',
            ),
          );
        }
        scope += `:${result.value.user.id}`;
        expectedUserId = result.value.user.id;
      }
      setImportStatus('creating-session');
      const { plan, save } = await prepareImportPlan(scope, {
        json: importData,
        options: importOptions,
        existingRsipNodes: params.existingRsipNodes,
        existingRsipGroups: params.existingRsipGroups,
        tr,
      });
      const parsed = plan.parsed;
      if (
        parsed.invalidReferences.rsipExecutionRecordsSkipped ||
        parsed.invalidReferences.rsipTaskLinksSkipped
      ) {
        logger.warn(
          'IMPORT_EXPORT',
          'Skipped invalid RSIP relation records during import',
          parsed.invalidReferences,
        );
      }
      setImportStatus('importing');
      if (plan.stage === 'data') {
        await params.onImport(parsed.chains, {
          expectedUserId,
          history: parsed.history,
          rsipNodes: parsed.rsipNodes,
          rsipMeta: parsed.rsipMeta,
          rsipGroups: parsed.rsipGroups,
          rsipPolicyLibrary: parsed.rsipPolicyLibrary,
          rsipRunHistory: parsed.rsipRunHistory,
          rsipExecutionRecords: parsed.rsipExecutionRecords,
          rsipTaskLinks: parsed.rsipTaskLinks,
          petState: parsed.petState,
        });
        await save('rules');
      }
      if (plan.stage === 'rules' && parsed.exceptionRulesToImport.length) {
        const result = await exceptionRuleManager.importRules(
          parsed.exceptionRulesToImport,
          { skipDuplicates: true, updateExisting: false },
        );
        if (result.errors.length > 0)
          throw new Error(
            'Some exception rules could not be imported. Retry to finish the saved import.',
          );
      }
      await save('committed');
      setImportStatus('success');
      setTimeout(params.onClose, 3000);
    } catch (error) {
      logger.error(
        'IMPORT_EXPORT',
        'Import failed',
        undefined,
        normalizeUnknownError(error),
      );
      setImportError(getImportErrorMessage(error, language, tr));
      setImportStatus('error');
    } finally {
      importing.current = false;
    }
  }, [importData, importOptions, language, params, storage, tr]);

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (!selectedFile) return;
      const reader = new FileReader();
      reader.onload = (loadEvent) =>
        setImportData(String(loadEvent.target?.result ?? ''));
      reader.readAsText(selectedFile);
    },
    [],
  );
  const handleOpenFile = useCallback(async () => {
    const content = await file.openFile(['json']);
    if (content) setImportData(content);
  }, [file]);

  return {
    importData,
    setImportData,
    importStatus,
    importError,
    importOptions,
    setImportOptions,
    handleImport,
    handleFileUpload,
    handleOpenFile,
  };
}
