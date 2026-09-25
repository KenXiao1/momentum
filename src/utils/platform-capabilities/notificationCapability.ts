import { logger } from '../logger';
import { getNotificationAdapter } from '../platform-adapters';
import type { PlatformCapabilityCenter } from './types';

export const notificationCapability: PlatformCapabilityCenter['notification'] =
  {
    isSupported: async () => (await getNotificationAdapter()).isSupported(),
    getPermissionState: async () =>
      (await getNotificationAdapter()).getPermissionState(),
    requestPermission: async () => {
      const adapter = await getNotificationAdapter();
      if (
        !adapter.isSupported() ||
        !adapter.getCapabilities().canRequestPermission
      ) {
        logger.warn(
          'PLATFORM_CAPABILITIES',
          'Notification permission request is not supported on this platform',
        );
        return 'default';
      }
      return adapter.requestPermission();
    },
    show: async (payload) => {
      const adapter = await getNotificationAdapter();
      if (!adapter.isSupported() || !adapter.getCapabilities().canShow) {
        logger.warn(
          'PLATFORM_CAPABILITIES',
          'Notification show is not supported on this platform',
        );
        return;
      }
      await adapter.show(payload);
    },
  };
