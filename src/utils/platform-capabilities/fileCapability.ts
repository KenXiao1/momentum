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
    try {
      return await adapter.saveFile(data, defaultName);
    } catch (error) {
      const normalized =
        error instanceof Error ? error : new Error(String(error));
      logger.error(
        'PLATFORM_CAPABILITIES',
        'Failed to save file',
        { defaultName },
        normalized,
      );
      return false;
    }
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
    try {
      return await adapter.openFile(extensions);
    } catch (error) {
      const normalized =
        error instanceof Error ? error : new Error(String(error));
      logger.error(
        'PLATFORM_CAPABILITIES',
        'Failed to open file',
        { extensions },
        normalized,
      );
      return null;
    }
  },
};
