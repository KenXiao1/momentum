import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n';
import { hasStorageCapability } from '../../storage/ports';
import { useStorage } from '../../storage/useStorage';
import { useStorageMode } from '../../storage/useStorageMode';
import { getTopLevelChains } from '../../utils/chainTree';
import { isDev } from '../../utils/env';
import { toError } from '../../utils/errorMessage';
import { logger } from '../../utils/logger';
import { buildChainTree } from '../../utils/chainTree';
import type { DashboardProps } from './types';

export function useDashboardController({
  chains,
  scheduledSessions,
  onImportChains,
  onRestoreChains,
  onPermanentDeleteChains,
}: DashboardProps) {
  const [showImportExport, setShowImportExport] = useState(false);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(isDev);
  const [recycleBinCount, setRecycleBinCount] = useState(0);
  const storage = useStorage();
  const { canUseSupabase, isChoicePending, setMode, dismissFirstLaunchHint } =
    useStorageMode();
  const { t, tr, language } = useI18n();
  const canUseCheckin = hasStorageCapability(storage, 'checkin');

  if (isDev) {
    logger.debug('DASHBOARD', 'Received chains', {
      chainCount: chains.length,
      chains: chains.map(({ id, name, type, parentId }) => ({
        id,
        name,
        type,
        parentId,
      })),
    });
  }

  const chainTree = useMemo(() => {
    if (isDev) {
      logger.debug('DASHBOARD', 'Rebuilding chainTree', {
        chainCount: chains.length,
      });
    }
    return buildChainTree(chains);
  }, [chains]);

  const topLevelChains = useMemo(() => {
    const result = getTopLevelChains(chainTree);
    if (isDev) {
      logger.debug('DASHBOARD', 'Top-level chains', {
        topLevelCount: result.length,
        chains: result.map(({ id, name, type }) => ({ id, name, type })),
      });
    }
    return result;
  }, [chainTree]);

  const loadRecycleBinStats = useCallback(async () => {
    try {
      const deletedChains = await storage.getDeletedChains();
      setRecycleBinCount(deletedChains.length);
    } catch (error) {
      if (isDev) {
        logger.error(
          'DASHBOARD',
          'Failed to load recycle bin statistics',
          undefined,
          toError(error),
        );
      }
    }
  }, [storage]);

  useEffect(() => {
    loadRecycleBinStats();
  }, [chains.length, loadRecycleBinStats]);

  const handleRestore = useCallback(
    async (chainIds: string[]) => {
      if (!onRestoreChains) return;
      await onRestoreChains(chainIds);
      await loadRecycleBinStats();
      logger.info('DASHBOARD', 'Restored chains and updated stats', {
        restoredCount: chainIds.length,
      });
    },
    [onRestoreChains, loadRecycleBinStats],
  );

  const handlePermanentDelete = useCallback(
    async (chainIds: string[]) => {
      if (!onPermanentDeleteChains) return;
      await onPermanentDeleteChains(chainIds);
      await loadRecycleBinStats();
      logger.info('DASHBOARD', 'Permanently deleted chains and updated stats', {
        deletedCount: chainIds.length,
      });
    },
    [onPermanentDeleteChains, loadRecycleBinStats],
  );

  return {
    t,
    tr,
    language,
    topLevelChains,
    recycleBinCount,
    canUseCheckin,
    canUseSupabase,
    isChoicePending,
    showImportExport,
    showRecycleBin,
    showAccountModal,
    showPerformanceMonitor,
    getScheduledSession: useCallback(
      (chainId: string) =>
        scheduledSessions.find((session) => session.chainId === chainId),
      [scheduledSessions],
    ),
    handleImport: useCallback(onImportChains, [onImportChains]),
    handleRestore,
    handlePermanentDelete,
    showImportExportModal: useCallback(() => setShowImportExport(true), []),
    hideImportExportModal: useCallback(() => setShowImportExport(false), []),
    showRecycleBinModal: useCallback(() => setShowRecycleBin(true), []),
    hideRecycleBinModal: useCallback(() => setShowRecycleBin(false), []),
    showAccount: useCallback(() => setShowAccountModal(true), []),
    hideAccount: useCallback(() => setShowAccountModal(false), []),
    togglePerformanceMonitor: useCallback(
      () => setShowPerformanceMonitor((visible) => !visible),
      [],
    ),
    enableCloudMode: useCallback(() => setMode('supabase'), [setMode]),
    keepLocalMode: useCallback(
      () => dismissFirstLaunchHint(),
      [dismissFirstLaunchHint],
    ),
  };
}

export type DashboardController = ReturnType<typeof useDashboardController>;
