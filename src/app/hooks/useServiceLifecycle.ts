import { useEffect, useState } from 'react';
import { isDev } from '../../utils/env';
import { logger } from '../../utils/logger';
import { toError } from '../../utils/errorHandling';
import { fireAndForget } from '../../utils/fireAndForget';
import { forwardTimerManager } from '../../utils/forwardTimer';
import { ruleStateManager } from '../../services/RuleStateManager';
import { migrationCoordinator } from '../../services/migration';
import { exceptionRuleCache } from '../../utils/cache';
import { performanceMonitor } from '../../utils/performanceMonitor';
import { initializeRuleSystem } from '../../utils/initializeRuleSystem';
import { checkForUpdates } from '../../utils/platform-adapters/updater';

interface ServiceLifecycleResult {
  isInitialized: boolean;
}

/**
 * Manages global service lifecycle (start/stop) for the application.
 * Handles: forwardTimerManager, cache runtime, ruleStateManager,
 * and dev-only monitoring runtime.
 */
export function useServiceLifecycle(): ServiceLifecycleResult {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    setIsInitialized(true);

    forwardTimerManager.start();
    exceptionRuleCache.start();
    ruleStateManager.start();

    let devCleanup: (() => void) | undefined;
    if (isDev) {
      performanceMonitor.start();
      devCleanup = () => performanceMonitor.stop();
    }

    const initializeNonCritical = () => {
      initializeRuleSystem()
        .then((result) => {
          if (!result.success) {
            logger.error(
              'SERVICE_LIFECYCLE',
              `Rule system initialization failed: ${result.message}`,
            );
          }
        })
        .catch((error) => {
          logger.error(
            'SERVICE_LIFECYCLE',
            'Rule system initialization error',
            undefined,
            toError(error),
          );
        });

      fireAndForget(migrationCoordinator.runStartupMigrations(), {
        label: 'startup-migrations',
      });
      fireAndForget(checkForUpdates(), { label: 'updater-check' });
    };

    const requestIdleCallbackFn = window.requestIdleCallback;
    if (typeof requestIdleCallbackFn === 'function') {
      requestIdleCallbackFn(() => initializeNonCritical(), { timeout: 2000 });
    } else {
      setTimeout(initializeNonCritical, 100);
    }

    return () => {
      forwardTimerManager.stop();
      exceptionRuleCache.stop();
      ruleStateManager.stop();
      devCleanup?.();
    };
  }, []);

  return { isInitialized };
}
