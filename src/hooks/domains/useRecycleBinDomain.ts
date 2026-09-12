/**
 * @module useRecycleBinDomain
 * @description 回收箱（软删除）功能的领域 Hook
 *
 * 职责：
 * - 软删除链条（移入回收箱）
 * - 恢复已删除的链条
 * - 永久删除链条
 * - 通过 RealTimeSyncService 确保多端同步
 *
 * @see docs/features/README-回收箱功能.md - 功能说明
 * @see src/services/RecycleBinService.ts - 底层服务
 */
import type { Dispatch, SetStateAction } from 'react';
import type { AppState } from '../../types';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import { resolveAppStateReader } from './appStateAccess';
import { realTimeSyncService } from '../../services/RealTimeSyncService';
import { logger } from '../../utils/logger';
import { toast } from '../../utils/toast';
import { useI18n } from '../../i18n';
import { getSafeErrorDetailFromUnknown } from '../../utils/errorMessage';
import { normalizeUnknownError } from '../../utils/errors/normalizeError';

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
  const { language, tr } = useI18n();
  const handleDeleteChain = async (chainId: string) => {
    try {
      const updatedChains = await realTimeSyncService.deleteWithSync(
        storage,
        chainId,
      );

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
          normalizeUnknownError(error),
        );
      });
      if (!updatedActiveSession) {
        storage.saveActiveSession(null).catch((error) => {
          logger.error(
            'RECYCLE_BIN',
            'Failed to clear active session after delete',
            { chainId },
            normalizeUnknownError(error),
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
      logger.error(
        'RECYCLE_BIN',
        'Delete failed',
        { chainId },
        normalizeUnknownError(error),
      );
      toast.error(
        safeDetail
          ? tr(`删除失败: ${safeDetail}`, `Delete failed: ${safeDetail}`)
          : tr(
              '删除失败，请重试（详情见控制台）',
              'Delete failed. Check the console for details, then try again.',
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
          tr(
            '发生错误后无法恢复状态，建议刷新页面。',
            "Couldn't restore state after the error. Refresh the page to recover.",
          ),
        );
      }
    }
  };

  const handleRestoreChains = async (chainIds: string[]) => {
    try {
      const updatedChains = await realTimeSyncService.restoreWithSync(
        storage,
        chainIds,
      );

      setState((prev) => ({
        ...prev,
        chains: updatedChains,
      }));
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : '';
      logger.error(
        'RECYCLE_BIN',
        'Restore failed',
        { chainIds },
        normalizeUnknownError(error),
      );
      if (
        rawMessage.includes('Partial restore failure') ||
        rawMessage.includes('failed to restore')
      ) {
        try {
          const currentChains = await storage.getActiveChains();
          setState((prev) => ({
            ...prev,
            chains: currentChains,
          }));
        } catch (recoveryError) {
          logger.error(
            'RECYCLE_BIN',
            'Failed to reload chains after restore failure',
            { chainIds },
            normalizeUnknownError(recoveryError),
          );
        }
        throw error;
      }
      throw error;
    }
  };

  const handlePermanentDeleteChains = async (chainIds: string[]) => {
    try {
      const updatedChains = await realTimeSyncService.permanentDeleteWithSync(
        storage,
        chainIds,
      );

      setState((prev) => ({
        ...prev,
        chains: updatedChains,
      }));
    } catch (error) {
      logger.error(
        'RECYCLE_BIN',
        'Permanent delete failed',
        { chainIds },
        normalizeUnknownError(error),
      );
      throw error;
    }
  };

  return {
    handleDeleteChain,
    handleRestoreChains,
    handlePermanentDeleteChains,
  };
}
