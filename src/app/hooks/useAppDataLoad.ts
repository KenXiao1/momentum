import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppState } from '../../types';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import { hasStorageCapability } from '../../storage/ports';
import { fireAndForget } from '../../utils/fireAndForget';
import { migrateCompletionHistoryForTiming } from '../../utils/completionHistoryTimingMigration';
import { toError } from '../../utils/errorMessage';
import { isDev } from '../../utils/env';
import { logger } from '../../utils/logger';
import { runWhenIdle } from '../../utils/runWhenIdle';
import {
  cleanupExpiredDeletedChains,
  persistCompletionHistoryTimingMigration,
  runDevDataMigration,
} from './appDataLoadHelpers';
import { navigationStore } from '../../stores/navigationStore';
import { loadAppDataSnapshot } from './appDataSnapshot';

interface UseAppDataLoadParams {
  storage: MomentumStorage;
  isInitialized: boolean;
  setState: Dispatch<SetStateAction<AppState>>;
}

export function useAppDataLoad({
  storage,
  isInitialized,
  setState,
}: UseAppDataLoadParams) {
  const [isLoadingData, setIsLoadingData] = useState(true);
  const canUseAuth = hasStorageCapability(storage, 'auth');

  useEffect(() => {
    const loadData = async () => {
      logger.debug('APP_SHELL', 'Starting data load', {
        storage: storage.kind,
      });
      setIsLoadingData(true);

      try {
        if (canUseAuth) {
          const authResult = await storage.waitForAuthentication(10000);
          if (!authResult.ok) {
            logger.warn(
              'APP_SHELL',
              'Authentication check failed; delaying data load',
              {
                code: authResult.error.code,
                message: authResult.error.message,
              },
            );
            return;
          }

          if (!authResult.value.isAuthenticated) {
            logger.warn('APP_SHELL', 'Not authenticated; skipping data load');
            return;
          }
        }

        // Run maintenance tasks without blocking initial render.
        runWhenIdle(() => {
          fireAndForget(cleanupExpiredDeletedChains(storage), {
            label: 'APP_SHELL auto cleanup',
          });
        });

        const {
          chains,
          scheduledSessions,
          activeSession,
          completionHistory,
          rsipNodes,
          rsipMeta,
          rsipGroups,
          rsipPolicyLibrary,
          rsipRunHistory,
          rsipTaskLinks,
          rsipExecutionRecords,
          taskTimeStats,
        } = await loadAppDataSnapshot(storage);

        // Check and fix circular reference data.
        const hasCircularReferences = chains.some(
          (chain) => chain.parentId === chain.id,
        );
        if (hasCircularReferences) {
          logger.debug('APP_SHELL', 'Detected circular reference data; fixing');
          const fixedChains = chains.map((chain) => {
            if (chain.parentId === chain.id) {
              logger.debug(
                'APP_SHELL',
                `Fixed circular reference for chain ${chain.name}`,
              );
              return { ...chain, parentId: undefined };
            }
            return chain;
          });

          // Persist the fixed data before continuing.
          await storage.saveChains(fixedChains);
          logger.info(
            'APP_SHELL',
            'Circular reference data fix completed and saved',
          );

          setState((prev) => ({
            ...prev,
            chains: fixedChains,
            chainsRevision: prev.chainsRevision + 1,
            scheduledSessions: [],
            activeSession: null,
            completionHistory: [],
          }));
          navigationStore.getState().navigateToDashboard();
          return;
        }

        logger.debug('APP_SHELL', 'Loaded chain data', {
          count: chains.length,
        });
        logger.debug('APP_SHELL', 'Chain data details', {
          chains: chains.map((c) => ({ id: c.id, name: c.name })),
        });

        // Migrate completion history to include timing info.
        const {
          updatedHistory: migratedCompletionHistory,
          hasChanges: didMigrateCompletionHistory,
        } = migrateCompletionHistoryForTiming(completionHistory, chains);
        if (didMigrateCompletionHistory) {
          runWhenIdle(() => {
            fireAndForget(
              persistCompletionHistoryTimingMigration(
                storage,
                migratedCompletionHistory,
              ),
              {
                label: 'APP_SHELL completion history timing migration',
              },
            );
          });
        }

        // Run full data migration (dev-only) to validate data.
        if (isDev && storage.kind === 'local') {
          runWhenIdle(() => {
            fireAndForget(runDevDataMigration(), {
              label: 'APP_SHELL data migration',
            });
          }, 5000);
        }

        logger.debug('APP_SHELL', 'Setting app state', {
          chainCount: chains.length,
        });
        setState((prev) => ({
          ...prev,
          chains,
          chainsRevision: prev.chainsRevision + 1,
          scheduledSessions,
          activeSession,
          completionHistory: migratedCompletionHistory,
          rsipNodes,
          rsipMeta,
          rsipGroups,
          rsipPolicyLibrary,
          rsipRunHistory,
          rsipTaskLinks,
          rsipExecutionRecords,
          taskTimeStats,
        }));
        navigationStore
          .getState()
          .navigateToView(activeSession ? 'focus' : 'dashboard');
      } catch (error) {
        logger.error(
          'APP_SHELL',
          'Failed to load data',
          undefined,
          toError(error),
        );
      } finally {
        setIsLoadingData(false);
      }
    };

    if (isInitialized) {
      logger.debug(
        'APP_SHELL',
        'Application initialization complete; starting data load',
      );
      fireAndForget(loadData(), { label: 'APP_SHELL loadData' });
    } else {
      setIsLoadingData(false);
    }
  }, [canUseAuth, storage, isInitialized, setState]);

  return { isLoadingData };
}
