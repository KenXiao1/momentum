import type { MomentumStorage } from '../../storage/MomentumStorage';
import { getAppStateSnapshot } from '../../stores/appShellStore';
import { useAppDataLoad } from '../hooks/useAppDataLoad';
import { useAuthController } from '../hooks/useAuthController';
import { usePeriodicCleanup } from '../hooks/usePeriodicCleanup';
import { useServiceLifecycle } from '../hooks/useServiceLifecycle';
import { useViewUrlSync } from '../hooks/useViewUrlSync';
import { useViewValidation } from '../hooks/useViewValidation';
import type { AppShellStateController } from './useAppShellState';

export function useAppShellBootstrap(
  storage: MomentumStorage,
  state: AppShellStateController,
) {
  const { isInitialized } = useServiceLifecycle();
  useAuthController({
    storage,
    resetAppState: state.resetAppState,
    setState: state.setState,
    resetUIState: state.resetUIState,
  });

  const { isLoadingData, loadError, retryDataLoad } = useAppDataLoad({
    storage,
    isInitialized,
    setState: state.setState,
  });
  useViewValidation({
    chains: state.chains,
    activeSession: state.activeSession,
    isInitialized,
  });
  useViewUrlSync({
    chains: state.chains,
    activeSession: state.activeSession,
    shouldLoadData: isInitialized,
    isLoadingData,
  });
  usePeriodicCleanup({
    getState: getAppStateSnapshot,
    setState: state.setState,
    storage,
    isInitialized,
  });

  return { isInitialized, isLoadingData, loadError, retryDataLoad };
}

export type AppShellBootstrap = ReturnType<typeof useAppShellBootstrap>;
