import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import { hasStorageCapability } from '../../storage/ports';
import { useStorage } from '../../storage/useStorage';
import { useStorageMode } from '../../storage/useStorageMode';
import { getTopLevelChains } from '../../utils/chain-tree';
import { isDev } from '../../utils/env';
import { toError } from '../../utils/errorMessage';
import { logger } from '../../utils/logger';
import { buildChainTree } from '../../utils/chain-tree';
import type { DashboardProps } from './types';

/** Counts recycle-bin chains, or returns null when they cannot be read. */
async function readRecycleBinCount(
  storage: Pick<MomentumStorage, 'getDeletedChains'>,
): Promise<number | null> {
  try {
    const deletedChains = await storage.getDeletedChains();
    return deletedChains.length;
  } catch (error) {
    if (isDev) {
      logger.error(
        'DASHBOARD',
        'Failed to load recycle bin statistics',
        undefined,
        toError(error),
      );
    }
    return null;
  }
}

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
  const [showRuleManager, setShowRuleManager] = useState(false);
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(isDev);
  const [recycleBinCount, setRecycleBinCount] = useState(0);
  const storage = useStorage();
  const { canUseSupabase, isChoicePending, setMode, dismissFirstLaunchHint } =
    useStorageMode();
  const { t, language } = useI18n();
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
    const count = await readRecycleBinCount(storage);
    if (count !== null) setRecycleBinCount(count);
  }, [storage]);

  // Refresh the count when the number of live chains changes (a chain may
  // have been deleted into, or restored from, the recycle bin).
  useEffect(() => {
    let cancelled = false;
    void readRecycleBinCount(storage).then((count) => {
      if (!cancelled && count !== null) setRecycleBinCount(count);
    });
    return () => {
      cancelled = true;
    };
  }, [chains.length, storage]);

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
    language,
    topLevelChains,
    recycleBinCount,
    canUseCheckin,
    canUseSupabase,
    isChoicePending,
    showImportExport,
    showRecycleBin,
    showAccountModal,
    showRuleManager,
    showPerformanceMonitor,
    getScheduledSession: useCallback(
      (chainId: string) =>
        scheduledSessions.find((session) => session.chainId === chainId),
      [scheduledSessions],
    ),
    handleImport: onImportChains,
    handleRestore,
    handlePermanentDelete,
    showImportExportModal: useCallback(() => setShowImportExport(true), []),
    hideImportExportModal: useCallback(() => setShowImportExport(false), []),
    showRecycleBinModal: useCallback(() => setShowRecycleBin(true), []),
    hideRecycleBinModal: useCallback(() => setShowRecycleBin(false), []),
    showAccount: useCallback(() => setShowAccountModal(true), []),
    hideAccount: useCallback(() => setShowAccountModal(false), []),
    showRuleManagerModal: useCallback(() => setShowRuleManager(true), []),
    hideRuleManagerModal: useCallback(() => setShowRuleManager(false), []),
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
