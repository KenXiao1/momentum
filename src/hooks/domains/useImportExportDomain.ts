/**
 * @module useImportExportDomain
 * @description 数据导入导出功能的领域 Hook
 *
 * 职责：
 * - 导入链条数据（支持增量合并）
 * - 导入完成历史、RSIP 节点
 * - 处理 ID 冲突检测
 * - Supabase 模式下的身份验证检查
 *
 * 导入时会检查：
 * 1. 数据有效性
 * 2. ID 冲突
 * 3. 用户身份验证（Supabase 模式）
 */
import type { Dispatch, SetStateAction } from 'react';
import type { AppState, Chain } from '../../types';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import { hasStorageCapability } from '../../storage/ports';
import type { SafelySaveChains } from './useChainsDomain';
import { useI18n } from '../../i18n';
import { logger } from '../../utils/logger';
import { normalizeUnknownError } from '../../utils/errors/normalizeError';
import {
  mergeImportedState,
  persistImportedData,
  reloadStateAfterImportFailure,
  type ImportChainsOptions,
} from './importPersistence';

interface UseImportExportDomainParams {
  storage: MomentumStorage;
  safelySaveChains: SafelySaveChains;
  setState: Dispatch<SetStateAction<AppState>>;
  onPetImported?: () => Promise<void>;
}

export function useImportExportDomain({
  storage,
  safelySaveChains,
  setState,
  onPetImported,
}: UseImportExportDomainParams) {
  const { tr } = useI18n();
  const canUseAuth = hasStorageCapability(storage, 'auth');

  async function ensureAuthenticatedForImport(): Promise<void> {
    if (!canUseAuth) return;

    logger.debug(
      'APP_SHELL',
      'Double-checking authentication state before import operations',
    );
    const isAuth = await storage.isUserAuthenticated();

    if (!isAuth.ok) {
      logger.warn('IMPORT', 'isUserAuthenticated failed', {
        code: isAuth.error.code,
        message: isAuth.error.message,
      });
    }

    if (isAuth.ok && isAuth.value) return;

    logger.debug('IMPORT', 'Authentication not ready; waiting');
    const authResult = await storage.waitForAuthentication(10000);

    if (
      !authResult.ok ||
      !authResult.value.isAuthenticated ||
      !authResult.value.user
    ) {
      throw new Error(
        tr(
          '导入时身份验证失败：请确保您已正确登录，然后重试导入操作。',
          'Authentication failed during import. Please make sure you are signed in and try again.',
        ),
      );
    }

    logger.debug('IMPORT', 'Authentication confirmed after wait', {
      userId: authResult.value.user.id,
    });
  }

  function assertValidImportedChains(
    importedChains: Chain[],
    options?: ImportChainsOptions,
  ): void {
    const hasOtherData =
      options &&
      Object.values(options).some((value) =>
        Array.isArray(value) ? value.length > 0 : value != null,
      );
    if (
      !Array.isArray(importedChains) ||
      (importedChains.length === 0 && !hasOtherData)
    ) {
      throw new Error(
        tr('没有有效的链条数据可导入', 'No valid chains found to import'),
      );
    }
  }

  function assertNoIdConflicts(
    currentChains: Chain[],
    importedChains: Chain[],
  ): void {
    const existingIds = new Set(currentChains.map((chain) => chain.id));
    const conflictingIds = importedChains
      .filter((chain) => existingIds.has(chain.id))
      .map((chain) => chain.id);

    if (conflictingIds.length === 0) return;

    logger.error('IMPORT', 'Detected chain ID conflicts', { conflictingIds });
    throw new Error(
      tr(
        `导入失败：发现 ${conflictingIds.length} 个ID冲突的链条`,
        `Import failed: found ${conflictingIds.length} chains with conflicting IDs`,
      ),
    );
  }

  const handleImportChains = async (
    importedChains: Chain[],
    options?: ImportChainsOptions,
  ) => {
    logger.info('APP_SHELL', '开始导入数据', {
      chainCount: importedChains.length,
      options,
    });

    try {
      await ensureAuthenticatedForImport();
      assertValidImportedChains(importedChains, options);

      logger.debug('APP_SHELL', '准备保存导入的数据到存储');

      const currentChains = await storage.getChains();
      logger.debug('APP_SHELL', '当前数据库中的链条数量', {
        count: currentChains.length,
      });
      logger.debug('APP_SHELL', '准备导入的链条数量', {
        count: importedChains.length,
      });

      assertNoIdConflicts(currentChains, importedChains);

      const updatedChains = [...currentChains, ...importedChains];
      await safelySaveChains(updatedChains);

      await persistImportedData({ storage, canUseAuth, options });
      if (options?.petState) await onPetImported?.();

      logger.info('APP_SHELL', '导入数据保存成功，更新 UI 状态');

      setState((previous) =>
        mergeImportedState(previous, updatedChains, options),
      );

      logger.info('APP_SHELL', '导入完成，UI 状态更新完成');
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : tr('未知错误', 'Unknown error');
      logger.error(
        'IMPORT',
        'Failed to import data',
        { errorMessage },
        error instanceof Error ? error : undefined,
      );

      try {
        await reloadStateAfterImportFailure(storage, setState);
      } catch (reloadError) {
        logger.error(
          'IMPORT',
          'Reload after import failure also failed',
          undefined,
          normalizeUnknownError(reloadError),
        );
      }

      throw error instanceof Error ? error : new Error(errorMessage);
    }
  };

  return { handleImportChains };
}
