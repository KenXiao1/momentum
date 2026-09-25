import { getWindowAdapter } from '../platform-adapters';
import type { PlatformCapabilityCenter } from './types';
import { runBooleanCapability } from './runBooleanCapability';

export const windowCapability: PlatformCapabilityCenter['window'] = {
  setFullscreen: async (fullscreen) => {
    const adapter = await getWindowAdapter();
    return runBooleanCapability({
      supported: adapter.getCapabilities().canSetFullscreen,
      unsupportedMessage:
        'Fullscreen operation is not supported on this platform',
      failureMessage: 'Failed to set fullscreen state',
      context: { fullscreen },
      operation: () => adapter.setFullscreen(fullscreen),
    });
  },
  minimizeToTray: async () => {
    const adapter = await getWindowAdapter();
    return runBooleanCapability({
      supported: adapter.getCapabilities().canMinimizeToTray,
      unsupportedMessage: 'Minimize-to-tray is not supported on this platform',
      failureMessage: 'Failed to minimize window to tray',
      operation: () => adapter.minimizeToTray(),
    });
  },
  focus: async () => {
    const adapter = await getWindowAdapter();
    return runBooleanCapability({
      supported: adapter.getCapabilities().canFocus,
      unsupportedMessage: 'Window focus is not supported on this platform',
      failureMessage: 'Failed to focus window',
      operation: () => adapter.focus(),
    });
  },
};
