import { useEffect, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppState } from '../../types';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import { resolveAppStateReader } from '../../hooks/domains/appStateAccess';
import { logger } from '../../utils/logger';
import { fireAndForget } from '../../utils/fireAndForget';
import { toError } from '../../utils/errorHandling';
import { isSessionExpired } from '../../utils/time';
import { systemNotificationService } from '../../services/platform/SystemNotificationService';
import { isGroupExpired, resetGroupProgress } from '../../utils/timeLimit';
import { soundManager } from '../../utils/soundManager';
import { navigationStore } from '../../stores/navigationStore';

interface UsePeriodicCleanupParams {
  state?: AppState;
  getState?: () => AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  storage: MomentumStorage;
  isInitialized: boolean;
}

/**
 * Handles periodic cleanup tasks:
 * - Expired task group reset
 * - Expired scheduled session cleanup with notifications
 */
export function usePeriodicCleanup({
  state,
  getState,
  setState,
  storage,
  isInitialized,
}: UsePeriodicCleanupParams): void {
  const readState = useMemo(
    () => resolveAppStateReader({ state, getState }),
    [getState, state],
  );

  useEffect(() => {
    if (!isInitialized) return;

    const checkExpiredGroups = () => {
      const current = readState();
      let hasChanges = false;
      const resetChains: AppState['chains'] = [];

      const updatedChains = current.chains.map((chain) => {
        if (chain.type === 'group' && isGroupExpired(chain)) {
          hasChanges = true;
          const resetChain = resetGroupProgress(chain);
          resetChains.push(resetChain);
          return resetChain;
        }
        return chain;
      });

      if (!hasChanges) return;

      Promise.all(resetChains.map((chain) => storage.upsertChain(chain))).catch(
        (error) => {
          logger.error(
            'PERIODIC_CLEANUP',
            'Failed to persist group expiry cleanup',
            undefined,
            toError(error),
          );
        },
      );

      setState((prev) => ({
        ...prev,
        chains: updatedChains,
        chainsRevision: prev.chainsRevision + 1,
      }));
    };

    const interval = setInterval(checkExpiredGroups, 60000);
    return () => clearInterval(interval);
  }, [storage, isInitialized, setState, readState]);

  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(() => {
      const current = readState();
      if (navigationStore.getState().showAuxiliaryJudgment) return;

      const expiredSessions = current.scheduledSessions.filter((session) =>
        isSessionExpired(session.expiresAt),
      );
      if (expiredSessions.length === 0) return;

      soundManager.playTimerFinished();

      for (const session of expiredSessions) {
        const chain = current.chains.find((c) => c.id === session.chainId);
        if (chain) {
          fireAndForget(
            systemNotificationService.notifyScheduleFailed(chain.name),
            { label: 'expired-schedule-notification' },
          );
        }
      }

      navigationStore
        .getState()
        .setShowAuxiliaryJudgment(expiredSessions[0].chainId);
    }, 10000);

    return () => clearInterval(interval);
  }, [isInitialized, readState]);
}
