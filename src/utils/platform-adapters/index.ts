import { isTauri, isTauriMobile } from '../platform';
import type {
  PlatformNotificationAdapter,
  PlatformWindowAdapter,
  PlatformFileAdapter,
  PlatformHapticsAdapter,
} from './types';

export type {
  NotificationPayload,
  HapticImpactStyle,
  HapticNotificationType,
} from './types';
export type {
  PlatformNotificationAdapter,
  PlatformWindowAdapter,
  PlatformFileAdapter,
  PlatformHapticsAdapter,
};

export async function getNotificationAdapter(): Promise<PlatformNotificationAdapter> {
  if (isTauri) {
    const { tauriNotificationAdapter } = await import('./tauri');
    return tauriNotificationAdapter;
  } else {
    const { webNotificationAdapter } = await import('./web');
    return webNotificationAdapter;
  }
}

export async function getWindowAdapter(): Promise<PlatformWindowAdapter> {
  if (isTauri) {
    const { tauriWindowAdapter } = await import('./tauri-window');
    return tauriWindowAdapter;
  } else {
    const { webWindowAdapter } = await import('./web-window');
    return webWindowAdapter;
  }
}

export async function getFileAdapter(): Promise<PlatformFileAdapter> {
  if (isTauri) {
    const { tauriFileAdapter } = await import('./tauri-file');
    return tauriFileAdapter;
  } else {
    const { webFileAdapter } = await import('./web-file');
    return webFileAdapter;
  }
}

export async function getHapticsAdapter(): Promise<PlatformHapticsAdapter> {
  if (isTauriMobile) {
    const { tauriHapticsAdapter } = await import('./tauri-haptics');
    return tauriHapticsAdapter;
  } else {
    const { webHapticsAdapter } = await import('./web-haptics');
    return webHapticsAdapter;
  }
}
