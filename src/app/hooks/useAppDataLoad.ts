import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppState, Chain } from '../../types';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import { hasStorageCapability } from '../../storage/ports';
import { fireAndForget } from '../../utils/fireAndForget';
import { migrateCompletionHistoryForTiming } from '../../utils/completionHistoryTimingMigration';
import { toError } from '../../utils/errorMessage';
import { logger } from '../../utils/logger';
import { runWhenIdle } from '../../utils/runWhenIdle';
import { cleanupExpiredDeletedChains } from './appDataLoadHelpers';
import { navigationStore } from '../../stores/navigationStore';
import { loadAppDataSnapshot } from './appDataSnapshot';

interface SettledLoad {
  storage: MomentumStorage;
  attempt: number;
  error: Error | null;
}

interface UseAppDataLoadParams {
  storage: MomentumStorage;
  isInitialized: boolean;
  setState: Dispatch<SetStateAction<AppState>>;
}

/** Clears self-parenting chains, persisting only the chains it changed. */
async function repairSelfParentedChains(
  storage: MomentumStorage,
  chains: Chain[],
): Promise<Chain[]> {
  const repaired = chains
    .filter((chain) => chain.parentId === chain.id)
    .map((chain) => ({ ...chain, parentId: undefined }));
  if (repaired.length === 0) return chains;

  await storage.upsertChains(repaired);
  logger.info('APP_SHELL', 'Repaired self-parented chains', {
    chainIds: repaired.map((chain) => chain.id),
  });
  const repairedById = new Map(repaired.map((chain) => [chain.id, chain]));
  return chains.map((chain) => repairedById.get(chain.id) ?? chain);
}

/**
 * Loads persisted data into app state.
 *
 * App state is only populated from a complete, successful load. On failure
 * `loadError` is set and state is left untouched, so no view can render, edit
 * and persist a partial or empty data set. `retryDataLoad` starts a new load.
 */
export function useAppDataLoad({
  storage,
  isInitialized,
  setState,
}: UseAppDataLoadParams) {
  const [loadAttempt, setLoadAttempt] = useState(0);
  // Outcome of the most recent load that ran to completion. Loading and error
  // state are derived from whether it belongs to the current request, so a new
  // request (storage change or retry) reads as loading without resetting state
  // from the effect.
  const [settledLoad, setSettledLoad] = useState<SettledLoad | null>(null);
  const canUseAuth = hasStorageCapability(storage, 'auth');
  const retryDataLoad = useCallback(
    () => setLoadAttempt((attempt) => attempt + 1),
    [],
  );
  const currentLoadSettled =
    settledLoad?.storage === storage && settledLoad.attempt === loadAttempt;
  const isLoadingData = isInitialized && !currentLoadSettled;
  const loadError = currentLoadSettled ? settledLoad.error : null;

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      let loadFailure: Error | null = null;
      logger.debug('APP_SHELL', 'Starting data load', {
        storage: storage.kind,
        attempt: loadAttempt,
      });

      try {
        if (canUseAuth) {
          const authResult = await storage.waitForAuthentication(10000);
          if (!authResult.ok) {
            throw new Error(
              `Authentication check failed: ${authResult.error.message}`,
            );
          }

          if (!authResult.value.isAuthenticated) {
            logger.warn('APP_SHELL', 'Not authenticated; skipping data load');
            return;
          }
        }

        const snapshot = await loadAppDataSnapshot(storage);
        const chains = await repairSelfParentedChains(storage, snapshot.chains);
        if (cancelled) return;

        // Derived on every load and kept in memory only: persisting it would
        // mean replacing the whole history, racing completions recorded since.
        const { updatedHistory: completionHistory } =
          migrateCompletionHistoryForTiming(snapshot.completionHistory, chains);

        setState((prev) => ({
          ...prev,
          ...snapshot,
          chains,
          completionHistory,
        }));
        navigationStore
          .getState()
          .navigateToView(snapshot.activeSession ? 'focus' : 'dashboard');

        // Maintenance runs only after a successful load.
        runWhenIdle(() => {
          fireAndForget(cleanupExpiredDeletedChains(storage), {
            label: 'APP_SHELL auto cleanup',
          });
        });
      } catch (error) {
        if (cancelled) return;
        const normalized = toError(error);
        logger.error('APP_SHELL', 'Failed to load data', undefined, normalized);
        loadFailure = normalized;
      } finally {
        if (!cancelled) {
          setSettledLoad({ storage, attempt: loadAttempt, error: loadFailure });
        }
      }
    };

    if (isInitialized) {
      fireAndForget(loadData(), { label: 'APP_SHELL loadData' });
    }

    return () => {
      cancelled = true;
    };
  }, [canUseAuth, storage, isInitialized, setState, loadAttempt]);

  return { isLoadingData, loadError, retryDataLoad };
}
