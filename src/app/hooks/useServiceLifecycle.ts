import { useEffect, useSyncExternalStore } from 'react';
import { isDev } from '../../utils/env';
import { fireAndForget } from '../../utils/fireAndForget';
import { forwardTimerManager } from '../../utils/forwardTimer';
import { exceptionRuleManager } from '../../services/ExceptionRuleManager';
import { performanceMonitor } from '../../utils/performanceMonitor';
import { checkForUpdates } from '../../utils/platform-adapters/updater';

interface ServiceLifecycleResult {
  isInitialized: boolean;
}

// Number of mounted owners whose global services are running. Kept outside
// React because the services themselves are module singletons.
let runningServiceOwners = 0;
const serviceStatusListeners = new Set<() => void>();

function setServicesRunning(running: boolean): void {
  runningServiceOwners += running ? 1 : -1;
  serviceStatusListeners.forEach((listener) => listener());
}

function subscribeToServiceStatus(listener: () => void): () => void {
  serviceStatusListeners.add(listener);
  return () => {
    serviceStatusListeners.delete(listener);
  };
}

const getServicesRunning = () => runningServiceOwners > 0;
const getServerServicesRunning = () => false;

/**
 * Manages global service lifecycle (start/stop) for the application.
 * Handles the forward timer and dev-only monitoring.
 */
export function useServiceLifecycle(): ServiceLifecycleResult {
  const isInitialized = useSyncExternalStore(
    subscribeToServiceStatus,
    getServicesRunning,
    getServerServicesRunning,
  );

  useEffect(() => {
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

    setServicesRunning(true);

    return () => {
      setServicesRunning(false);
      forwardTimerManager.stop();
      devCleanup?.();
    };
  }, []);

  return { isInitialized };
}
