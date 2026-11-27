import type { MomentumStorage } from '../../storage/MomentumStorage';
import { getAppStateSnapshot } from '../../stores/appShellStore';
import { getPlatformCapabilityCenter } from '../../utils/platform-capabilities/center';
import { useAppDataLoad } from '../hooks/useAppDataLoad';
import { useAuthController } from '../hooks/useAuthController';
import { useDailyReminderScheduler } from '../hooks/useDailyReminderScheduler';
import { usePeriodicCleanup } from '../hooks/usePeriodicCleanup';
import { useRemoteChangeNotice } from '../hooks/useRemoteChangeNotice';
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

  useDailyReminderScheduler(
    state.chains,
    isInitialized && !isLoadingData && !loadError,
  );
  const remoteChanges = useRemoteChangeNotice(
    storage,
    isInitialized && !isLoadingData && !loadError,
  );

  const exportLocalData = async () =>
    getPlatformCapabilityCenter().file.saveFile(
      await storage.exportLocalRawData(),
      `momentum-device-backup-${new Date().toISOString().slice(0, 10)}.json`,
    );
  const discardInterruptedOperation = async () => {
    await storage.discardInterruptedOperation();
    retryDataLoad();
  };

  return {
    isInitialized,
    isLoadingData,
    loadError,
    retryDataLoad,
    remoteChanges,
    exportLocalData,
    discardInterruptedOperation,
  };
}

export type AppShellBootstrap = ReturnType<typeof useAppShellBootstrap>;
