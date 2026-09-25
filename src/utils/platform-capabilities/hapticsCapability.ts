import { getHapticsAdapter } from '../platform-adapters';
import type { PlatformCapabilityCenter } from './types';
import { runBooleanCapability } from './runBooleanCapability';

export const hapticsCapability: PlatformCapabilityCenter['haptics'] = {
  impact: async (style) => {
    const adapter = await getHapticsAdapter();
    return runBooleanCapability({
      supported: adapter.getCapabilities().canImpact,
      unsupportedMessage: 'Haptic impact is not supported on this platform',
      failureMessage: 'Failed to perform haptic impact',
      context: { style },
      operation: () => adapter.impact(style),
    });
  },
  notification: async (type) => {
    const adapter = await getHapticsAdapter();
    return runBooleanCapability({
      supported: adapter.getCapabilities().canNotification,
      unsupportedMessage:
        'Haptic notification is not supported on this platform',
      failureMessage: 'Failed to perform haptic notification',
      context: { type },
      operation: () => adapter.notification(type),
    });
  },
  selectionChanged: async () => {
    const adapter = await getHapticsAdapter();
    return runBooleanCapability({
      supported: adapter.getCapabilities().canSelectionChanged,
      unsupportedMessage:
        'Haptic selection feedback is not supported on this platform',
      failureMessage: 'Failed to perform haptic selection feedback',
      operation: () => adapter.selectionChanged(),
    });
  },
};
