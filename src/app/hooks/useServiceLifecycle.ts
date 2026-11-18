import { useEffect, useState } from 'react';
import { isDev } from '../../utils/env';
import { fireAndForget } from '../../utils/fireAndForget';
import { forwardTimerManager } from '../../utils/forwardTimer';
import { exceptionRuleManager } from '../../services/ExceptionRuleManager';
import { performanceMonitor } from '../../utils/performanceMonitor';
import { checkForUpdates } from '../../utils/platform-adapters/updater';

interface ServiceLifecycleResult {
  isInitialized: boolean;
}

/**
 * Manages global service lifecycle (start/stop) for the application.
 * Handles the forward timer and dev-only monitoring.
 */
export function useServiceLifecycle(): ServiceLifecycleResult {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    setIsInitialized(true);

    forwardTimerManager.start();

    let devCleanup: (() => void) | undefined;
    if (isDev) {
      performanceMonitor.start();
      devCleanup = () => performanceMonitor.stop();
    }

    const initializeNonCritical = () => {
      fireAndForget(exceptionRuleManager.initialize(), {
        label: 'rule-system-init',
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
      devCleanup?.();
    };
  }, []);

  return { isInitialized };
}
