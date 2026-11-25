/**
 * @module useRecycleBinDomain
 * @description 回收箱（软删除）功能的领域 Hook
 *
 * 职责：
 * - 软删除链条（移入回收箱）
 * - 恢复已删除的链条
 * - 永久删除链条
 *
 * @see docs/features/README-回收箱功能.md - 功能说明
 */
import type { Dispatch, SetStateAction } from 'react';
import type { AppState } from '../../types';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import { resolveAppStateReader } from './appStateAccess';
import {
  PartialRestoreError,
  permanentlyDeleteChains,
  restoreChains,
  softDeleteChain,
} from '../../services/chainOperations';
import { logger } from '../../utils/logger';
import { toast } from '../../utils/toast';
import { useI18n } from '../../i18n';
import {
  getSafeErrorDetailFromUnknown,
  toError,
} from '../../utils/errorMessage';

interface UseRecycleBinDomainParams {
  state?: AppState;
  getState?: () => AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  storage: MomentumStorage;
  onChainDeleted?: (chainId: string, hasActiveSession: boolean) => void;
}

export function useRecycleBinDomain({
  state,
  getState,
  setState,
  storage,
  onChainDeleted,
}: UseRecycleBinDomainParams) {
  const readState = resolveAppStateReader({ state, getState });
  const { language, t } = useI18n();
  const handleDeleteChain = async (chainId: string) => {
    try {
      const updatedChains = await softDeleteChain(storage, chainId);

      const currentState = readState();
      const updatedScheduledSessions = currentState.scheduledSessions.filter(
        (session) => session.chainId !== chainId,
      );
      const updatedActiveSession =
        currentState.activeSession?.chainId === chainId
          ? null
          : currentState.activeSession;

      storage.removeScheduledSession(chainId).catch((error) => {
        logger.error(
          'RECYCLE_BIN',
          'Failed to persist scheduled sessions after delete',
          { chainId },
          toError(error),
        );
      });
      if (!updatedActiveSession) {
        storage.saveActiveSession(null).catch((error) => {
          logger.error(
            'RECYCLE_BIN',
            'Failed to clear active session after delete',
            { chainId },
            toError(error),
          );
        });
      }

      setState((prev) => ({
        ...prev,
        chains: updatedChains,
        scheduledSessions: updatedScheduledSessions,
        activeSession: updatedActiveSession,
      }));
      onChainDeleted?.(chainId, Boolean(updatedActiveSession));
    } catch (error) {
      const safeDetail = getSafeErrorDetailFromUnknown(error, language);
      logger.error('RECYCLE_BIN', 'Delete failed', { chainId }, toError(error));
      toast.error(
        safeDetail
          ? t('useRecycleBinDomain.deleteFailedSafeDetail', {
              safeDetail: safeDetail,
            })
          : t(
              'useRecycleBinDomain.deleteFailedCheckTheConsoleForDetailsThenTry',
            ),
      );

      try {
        const currentChains = await storage.getActiveChains();
        setState((prev) => ({
          ...prev,
          chains: currentChains,
        }));
      } catch {
        toast.warning(
          t(
            'useRecycleBinDomain.couldNotRestoreStateAfterTheErrorRefreshThePage',
          ),
        );
      }
    }
  };

  // Failures propagate to the recycle bin modal, which logs and reports them.
  const handleRestoreChains = async (chainIds: string[]) => {
    try {
      const updatedChains = await restoreChains(storage, chainIds);
      setState((prev) => ({ ...prev, chains: updatedChains }));
    } catch (error) {
      // Show the chains that were restored before reporting the rest.
      if (error instanceof PartialRestoreError)
        setState((prev) => ({ ...prev, chains: error.chains }));
      throw error;
    }
  };

  // Failures propagate to the recycle bin modal, which logs and reports them.
  const handlePermanentDeleteChains = async (chainIds: string[]) => {
    const updatedChains = await permanentlyDeleteChains(storage, chainIds);
    setState((prev) => ({ ...prev, chains: updatedChains }));
  };

  return {
    handleDeleteChain,
    handleRestoreChains,
    handlePermanentDeleteChains,
  };
}
