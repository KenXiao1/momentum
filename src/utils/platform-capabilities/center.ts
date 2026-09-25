import { isTauriMobile } from '../platform';
import {
  getFileAdapter,
  getHapticsAdapter,
  getNotificationAdapter,
  getWindowAdapter,
} from '../platform-adapters';
import { fileCapability } from './fileCapability';
import { hapticsCapability } from './hapticsCapability';
import { notificationCapability } from './notificationCapability';
import type { PlatformCapabilityCenter, PlatformCapabilities } from './types';
import { windowCapability } from './windowCapability';

function toPlacement(supported: boolean): 'topbar' | 'settings' | 'hidden' {
  if (!supported) return 'hidden';
  return isTauriMobile ? 'settings' : 'topbar';
}

const center: PlatformCapabilityCenter = {
  notification: notificationCapability,
  window: windowCapability,
  file: fileCapability,
  haptics: hapticsCapability,

  async getCapabilities(): Promise<PlatformCapabilities> {
    const [notification, window, file, haptics] = await Promise.all([
      getNotificationAdapter(),
      getWindowAdapter(),
      getFileAdapter(),
      getHapticsAdapter(),
    ]);
    const notificationSupported = notification.isSupported();
    const notificationCaps = notification.getCapabilities();
    const windowCaps = window.getCapabilities();
    const fileCaps = file.getCapabilities();
    const hapticsCaps = haptics.getCapabilities();
    return {
      notification: {
        supported: notificationSupported,
        canRequestPermission:
          notificationSupported && notificationCaps.canRequestPermission,
        canShow: notificationSupported && notificationCaps.canShow,
        togglePlacement: toPlacement(notificationSupported),
      },
      window: {
        canSetFullscreen: windowCaps.canSetFullscreen,
        canMinimizeToTray: windowCaps.canMinimizeToTray,
        canFocus: windowCaps.canFocus,
      },
      file: {
        canSaveFile: fileCaps.canSaveFile,
        canOpenFile: fileCaps.canOpenFile,
      },
      haptics: {
        canImpact: hapticsCaps.canImpact,
        canNotification: hapticsCaps.canNotification,
        canSelectionChanged: hapticsCaps.canSelectionChanged,
      },
    };
  },
};

export function getPlatformCapabilityCenter(): PlatformCapabilityCenter {
  return center;
}
