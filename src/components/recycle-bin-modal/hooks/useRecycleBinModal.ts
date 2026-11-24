import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeletedChain } from '../../../types';
import { useStorage } from '../../../storage/useStorage';
import { useI18n } from '../../../i18n';
import { logger } from '../../../utils/logger';
import { toast } from '../../../utils/toast';
import {
  getSafeErrorDetailFromUnknown,
  toError,
} from '../../../utils/errorMessage';
import type { AsyncOrSyncVoid, ConfirmDialogState } from '../types';
import { performRecycleBinOperation } from './operations';
import { formatDeletedTime } from './timeFormat';

interface UseRecycleBinModalOptions {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (chainIds: string[]) => AsyncOrSyncVoid;
  onPermanentDelete: (chainIds: string[]) => AsyncOrSyncVoid;
}

export function useRecycleBinModal({
  isOpen,
  onRestore,
  onPermanentDelete,
}: UseRecycleBinModalOptions) {
  const { language, t } = useI18n();
  const storage = useStorage();

  const [deletedChains, setDeletedChains] = useState<DeletedChain[]>([]);
  const [selectedChains, setSelectedChains] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(isOpen);
  const [showConfirmDialog, setShowConfirmDialog] =
    useState<ConfirmDialogState | null>(null);
  const loadRequestIdRef = useRef(0);
  const operationInFlightRef = useRef(false);

  // Opening the modal starts loading; closing it stops showing a load.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    setIsLoading(isOpen);
  }

  // Applies a load's outcome unless a newer load or a close superseded it.
  const applyLoadedChains = useCallback(
    (requestId: number, chains: DeletedChain[]) => {
      if (requestId !== loadRequestIdRef.current) return;
      setDeletedChains(chains);
      setSelectedChains(new Set());
      setIsLoading(false);
    },
    [],
  );
  const applyLoadFailure = useCallback(
    (requestId: number, error: unknown) => {
      if (requestId !== loadRequestIdRef.current) return;
      logger.error(
        'RECYCLE_BIN',
        '加载已删除链条失败',
        undefined,
        toError(error),
      );
      toast.error(
        t(
          'recycleBinModal.useRecycleBinModal.failedToLoadRecycleBinPleaseTryAgain',
        ),
      );
      setIsLoading(false);
    },
    [t],
  );

  const loadDeletedChains = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    setIsLoading(true);
    try {
      applyLoadedChains(requestId, await storage.getDeletedChains());
    } catch (error) {
      applyLoadFailure(requestId, error);
    }
  }, [applyLoadFailure, applyLoadedChains, storage]);

  useEffect(() => {
    if (!isOpen) {
      loadRequestIdRef.current += 1;
      return;
    }
    const requestId = ++loadRequestIdRef.current;
    storage.getDeletedChains().then(
      (chains) => applyLoadedChains(requestId, chains),
      (error: unknown) => applyLoadFailure(requestId, error),
    );
    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [applyLoadFailure, applyLoadedChains, isOpen, storage]);

  const handleSelectChain = useCallback(
    (chainId: string, selected: boolean) => {
      setSelectedChains((prev) => {
        const next = new Set(prev);
        if (selected) {
          next.add(chainId);
        } else {
          next.delete(chainId);
        }
        return next;
      });
    },
    [],
  );

  const handleSelectAll = useCallback(() => {
    if (selectedChains.size === deletedChains.length) {
      setSelectedChains(new Set());
    } else {
      setSelectedChains(new Set(deletedChains.map((chain) => chain.id)));
    }
  }, [selectedChains.size, deletedChains]);

  const handleSingleRestore = useCallback(
    (chainId: string) => {
      const chain = deletedChains.find((c) => c.id === chainId);
      if (chain) {
        setShowConfirmDialog({
          type: 'restore',
          chainIds: [chainId],
          chainNames: [chain.name],
        });
      }
    },
    [deletedChains],
  );

  const handleSinglePermanentDelete = useCallback(
    (chainId: string) => {
      const chain = deletedChains.find((c) => c.id === chainId);
      if (chain) {
        setShowConfirmDialog({
          type: 'delete',
          chainIds: [chainId],
          chainNames: [chain.name],
        });
      }
    },
    [deletedChains],
  );

  const handleBulkRestore = useCallback(() => {
    if (selectedChains.size === 0) return;

    const chainNames = Array.from(selectedChains)
      .map((id) => deletedChains.find((c) => c.id === id)?.name)
      .filter(Boolean) as string[];

    setShowConfirmDialog({
      type: 'restore',
      chainIds: Array.from(selectedChains),
      chainNames,
    });
  }, [selectedChains, deletedChains]);

  const handleBulkPermanentDelete = useCallback(() => {
    if (selectedChains.size === 0) return;

    const chainNames = Array.from(selectedChains)
      .map((id) => deletedChains.find((c) => c.id === id)?.name)
      .filter(Boolean) as string[];

    setShowConfirmDialog({
      type: 'delete',
      chainIds: Array.from(selectedChains),
      chainNames,
    });
  }, [selectedChains, deletedChains]);

  const handleConfirmAction = useCallback(async () => {
    if (!showConfirmDialog || operationInFlightRef.current) return;

    operationInFlightRef.current = true;
    setIsLoading(true);
    try {
      const dialog = showConfirmDialog;
      logger.debug('RECYCLE_BIN', 'Starting operation', {
        type: dialog.type,
        chainIds: dialog.chainIds,
      });

      const operationResult = await performRecycleBinOperation({
        dialog,
        onRestore,
        onPermanentDelete,
        language,
        t,
      });

      logger.debug('RECYCLE_BIN', 'Refreshing local recycle bin data', {
        type: dialog.type,
      });
      await loadDeletedChains();
      logger.debug('RECYCLE_BIN', 'Local data refreshed successfully', {
        type: dialog.type,
      });

      if (operationResult.success) {
        toast.success(operationResult.message);
        logger.info('RECYCLE_BIN', 'Operation completed successfully', {
          type: dialog.type,
          chainIds: dialog.chainIds,
        });
      }
    } catch (error) {
      logger.error(
        'RECYCLE_BIN',
        'Operation failed with unexpected error',
        { type: showConfirmDialog?.type },
        toError(error),
      );
      const safeDetail = getSafeErrorDetailFromUnknown(error, language);
      toast.error(
        safeDetail
          ? t('recycleBinModal.useRecycleBinModal.operationFailedSafeDetail', {
              safeDetail: safeDetail,
            })
          : t(
              'recycleBinModal.useRecycleBinModal.operationFailedCheckTheConsoleForDetailsThenTry',
            ),
      );
    } finally {
      operationInFlightRef.current = false;
      setIsLoading(false);
      setShowConfirmDialog(null);
      setSelectedChains(new Set());
      logger.debug(
        'RECYCLE_BIN',
        'Operation cleanup completed, selections cleared',
      );
    }
  }, [
    showConfirmDialog,
    onPermanentDelete,
    onRestore,
    loadDeletedChains,
    language,
    t,
  ]);

  const handleCancelConfirm = useCallback(() => {
    setShowConfirmDialog(null);
  }, []);

  const formatDeletedTimeForDisplay = useCallback(
    (deletedAt: Date) => formatDeletedTime({ deletedAt, language, t }),
    [language, t],
  );

  return {
    deletedChains,
    selectedChains,
    isLoading,
    showConfirmDialog,
    language,
    t,
    formatDeletedTime: formatDeletedTimeForDisplay,
    handleSelectChain,
    handleSelectAll,
    handleSingleRestore,
    handleSinglePermanentDelete,
    handleBulkRestore,
    handleBulkPermanentDelete,
    handleConfirmAction,
    handleCancelConfirm,
  };
}

export type { ConfirmDialogState } from '../types';
