import { translate } from '../../i18n/translate';
import type {
  NotificationPermissionState,
  NotificationTogglePlacement,
} from '../../utils/platform-capabilities/types';
import { getPlatformCapabilityCenter } from '../../utils/platform-capabilities/center';
import { localPreferences } from '../../utils/localPreferences';
import { randomId } from '../../utils/random';
import { getCurrentLanguage } from '../../utils/runtimeI18n';
import { logger } from '../../utils/logger';
import { normalizeUnknownError } from '../../utils/errors/normalizeError';

const DEFAULT_NOTIFICATION_ICON = '/icons/icon-192.png';

type NotificationPermissionSource = 'toggle' | 'feature';

export interface SystemNotificationState {
  initialized: boolean;
  supported: boolean;
  permission: NotificationPermissionState;
  enabled: boolean;
  togglePlacement: NotificationTogglePlacement;
}

type Listener = (state: SystemNotificationState) => void;

function formatChainWithReason(
  language: 'zh' | 'en',
  chainName: string,
  reason?: string,
) {
  const quotedChainName = `"${chainName}"`;
  if (!reason) return quotedChainName;
  return translate(
    language === 'zh' ? 'zh' : 'en',
    'platform.systemNotificationService.quotedChainNameReason',
    { quotedChainName: quotedChainName, reason: reason },
  );
}

class SystemNotificationService {
  private readonly center = getPlatformCapabilityCenter();

  private state: SystemNotificationState = {
    initialized: false,
    supported: false,
    permission: 'default',
    enabled: false,
    togglePlacement: 'hidden',
  };

  private listeners = new Set<Listener>();
  private initPromise: Promise<SystemNotificationState> | null = null;

  async init(): Promise<SystemNotificationState> {
    if (this.state.initialized) {
      return this.state;
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      const capabilities = await this.center.getCapabilities();
      const permission = await this.center.notification.getPermissionState();
      const storedEnabled = localPreferences.getNotificationsEnabled();
      const enabled =
        capabilities.notification.supported &&
        permission === 'granted' &&
        storedEnabled === true;

      this.setState({
        initialized: true,
        supported: capabilities.notification.supported,
        permission,
        enabled,
        togglePlacement: capabilities.notification.togglePlacement,
      });

      return this.state;
    })();

    try {
      return await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  getState(): SystemNotificationState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async requestPermission(
    source: NotificationPermissionSource,
  ): Promise<boolean> {
    await this.init();
    if (!this.state.supported) return false;

    try {
      const permission = await this.center.notification.requestPermission();
      const storedEnabled = localPreferences.getNotificationsEnabled();
      const enabled = permission === 'granted' && storedEnabled === true;

      this.setState({
        permission,
        enabled,
      });

      logger.info('SYSTEM_NOTIFICATIONS', 'Notification permission requested', {
        source,
        permission,
      });

      return permission === 'granted';
    } catch (error) {
      logger.error(
        'SYSTEM_NOTIFICATIONS',
        'Failed to request notification permission',
        { source },
        normalizeUnknownError(error),
      );
      return false;
    }
  }

  async enable(): Promise<boolean> {
    const granted = await this.requestPermission('toggle');
    const enabled = this.state.supported && granted;
    this.setEnabledState(enabled);
    return enabled;
  }

  disable(): void {
    this.setEnabledState(false);
  }

  isEnabled(): boolean {
    return this.state.enabled;
  }

  async notifyTaskFailed(chainName: string, reason: string): Promise<void> {
    const language = getCurrentLanguage();
    await this.show({
      title: translate(
        language,
        'platform.systemNotificationService.taskFailed',
      ),
      body: formatChainWithReason(language, chainName, reason),
      icon: DEFAULT_NOTIFICATION_ICON,
      tag: randomId('task-failed'),
      requireInteraction: true,
    });
  }

  async notifyTaskCompleted(
    chainName: string,
    streak: number,
    message?: string,
  ): Promise<void> {
    const language = getCurrentLanguage();
    const suffix = message ? ` ${message}` : '';
    await this.show({
      title: translate(language, 'rsip.taskLink.taskLinkUi.taskCompleted'),
      body: translate(
        language === 'zh' ? 'zh' : 'en',
        'platform.systemNotificationService.chainNameCompletedSuffixCurrentStreakStreak',
        { chainName: chainName, suffix: suffix, streak: streak },
      ),
      icon: DEFAULT_NOTIFICATION_ICON,
      tag: randomId('task-completed'),
      requireInteraction: false,
    });
  }

  async notifyTaskWarning(
    chainName: string,
    timeRemaining: string,
  ): Promise<void> {
    const language = getCurrentLanguage();
    await this.show({
      title: translate(
        language,
        'platform.systemNotificationService.taskEndingSoon',
      ),
      body: translate(
        language === 'zh' ? 'zh' : 'en',
        'platform.systemNotificationService.chainNameHasTimeRemainingLeftStayFocused',
        { chainName: chainName, timeRemaining: timeRemaining },
      ),
      icon: DEFAULT_NOTIFICATION_ICON,
      tag: randomId('task-warning'),
      requireInteraction: false,
    });
  }

  async notifyScheduleWarning(
    chainName: string,
    timeRemaining: string,
  ): Promise<void> {
    const language = getCurrentLanguage();
    await this.show({
      title: translate(
        language,
        'platform.systemNotificationService.scheduleExpiring',
      ),
      body: translate(
        language === 'zh' ? 'zh' : 'en',
        'platform.systemNotificationService.chainNameScheduleHasTimeRemainingLeftGetReady',
        { chainName: chainName, timeRemaining: timeRemaining },
      ),
      icon: DEFAULT_NOTIFICATION_ICON,
      tag: randomId('schedule-warning'),
      requireInteraction: true,
    });
  }

  async notifyScheduleFailed(chainName: string): Promise<void> {
    const language = getCurrentLanguage();
    await this.show({
      title: translate(
        language,
        'platform.systemNotificationService.scheduleFailed',
      ),
      body: translate(
        language === 'zh' ? 'zh' : 'en',
        'platform.systemNotificationService.chainNameScheduleExpiredAdjudicationRequired',
        { chainName: chainName },
      ),
      icon: DEFAULT_NOTIFICATION_ICON,
      tag: randomId('schedule-failed'),
      requireInteraction: true,
    });
  }

  async notifyTimerCompleted(
    title: string,
    body: string,
    requestPermissionOnDemand: boolean = true,
  ): Promise<void> {
    if (requestPermissionOnDemand && this.state.permission === 'default') {
      await this.requestPermission('feature');
    }
    await this.show({
      title,
      body,
      icon: DEFAULT_NOTIFICATION_ICON,
      tag: randomId('timer-completed'),
      requireInteraction: false,
    });
  }

  private async show(options: {
    title: string;
    body: string;
    icon?: string;
    tag?: string;
    requireInteraction?: boolean;
    silent?: boolean;
  }): Promise<void> {
    await this.init();
    if (!this.state.enabled || this.state.permission !== 'granted') {
      return;
    }

    try {
      await this.center.notification.show(options);
    } catch (error) {
      logger.error(
        'SYSTEM_NOTIFICATIONS',
        'Failed to show notification',
        { tag: options.tag },
        normalizeUnknownError(error),
      );
    }
  }

  private setEnabledState(enabled: boolean): void {
    const nextEnabled = enabled && this.state.permission === 'granted';
    localPreferences.setNotificationsEnabled(nextEnabled);
    this.setState({
      enabled: nextEnabled,
    });
  }

  private setState(patch: Partial<SystemNotificationState>): void {
    this.state = {
      ...this.state,
      ...patch,
    };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

export const systemNotificationService = new SystemNotificationService();
