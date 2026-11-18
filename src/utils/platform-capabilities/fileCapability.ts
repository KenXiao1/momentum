import { logger } from '../logger';
import { getFileAdapter } from '../platform-adapters';
import type { PlatformCapabilityCenter } from './types';

export const fileCapability: PlatformCapabilityCenter['file'] = {
  saveFile: async (data, defaultName) => {
    const adapter = await getFileAdapter();
    if (!adapter.getCapabilities().canSaveFile) {
      logger.warn(
        'PLATFORM_CAPABILITIES',
        'Save-file operation is not supported on this platform',
        { defaultName },
      );
      return false;
    }
    // false means canceled; a failed save throws so the caller can report it.
    return adapter.saveFile(data, defaultName);
  },
  openFile: async (extensions) => {
    const adapter = await getFileAdapter();
    if (!adapter.getCapabilities().canOpenFile) {
      logger.warn(
        'PLATFORM_CAPABILITIES',
        'Open-file operation is not supported on this platform',
        { extensions },
      );
      return null;
    }
    // null means canceled; a failed read throws so the caller can report it.
    return adapter.openFile(extensions);
  },
};
