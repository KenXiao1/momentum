import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuthUser } from '../../domain/auth';
import type { GamblingSettings } from '../../domain/userSettings';
import { useDiagnosticsExport } from './useDiagnosticsExport';
import { useI18n } from '../../i18n';
import { hasStorageCapability } from '../../storage/ports';
import { useStorage } from '../../storage/useStorage';
import { useStorageMode } from '../../storage/useStorageMode';
import {
  getSafeErrorDetail,
  getSafeErrorDetailFromUnknown,
} from '../../utils/errorMessage';
import { normalizeUnknownError } from '../../utils/errors/normalizeError';
import { logger } from '../../utils/logger';

const DEFAULT_GAMBLING_SETTINGS: GamblingSettings = {
  gambling_mode_enabled: false,
  daily_bet_limit: null,
  max_single_bet: null,
};

export function useAccountModalController(params: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const storage = useStorage();
  const storageMode = useStorageMode();
  const i18n = useI18n();
  const diagnostics = useDiagnosticsExport();
  const { language, t } = i18n;
  const canUseAuth = hasStorageCapability(storage, 'auth');
  const canUseBetting = hasStorageCapability(storage, 'betting');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gamblingSettings, setGamblingSettings] = useState(
    DEFAULT_GAMBLING_SETTINGS,
  );
  const [gamblingLoading, setGamblingLoading] = useState(false);
  const [gamblingError, setGamblingError] = useState<string | null>(null);
  const [gamblingSuccess, setGamblingSuccess] = useState<string | null>(null);
  const userFullName = useMemo(() => {
    const value = user?.userMetadata?.['full_name'];
    return typeof value === 'string' ? value : null;
  }, [user]);

  const loadUser = useCallback(async () => {
    if (!canUseAuth) return;
    setLoading(true);
    setError(null);
    try {
      const result = await storage.getCurrentUser();
      if (result.ok) {
        setUser(result.value);
      } else {
        setUser(null);
        setError(
          getSafeErrorDetail(result.error.message || '', language) ??
            t(
              'accountModal.useAccountModalController.failedToLoadUserInfoCheckTheConsoleFor',
            ),
        );
      }
    } catch (error) {
      logger.error(
        'ACCOUNT',
        'Failed to get user info',
        undefined,
        normalizeUnknownError(error),
      );
      setError(
        t('accountModal.useAccountModalController.failedToLoadUserInfo'),
      );
    } finally {
      setLoading(false);
    }
  }, [canUseAuth, language, storage, t]);

  const loadGamblingSettings = useCallback(async () => {
    if (!canUseBetting) return;
    try {
      setGamblingError(null);
      const result = await storage.getGamblingSettings();
      if (result.ok) setGamblingSettings(result.value);
      else {
        setGamblingError(
          getSafeErrorDetail(result.error.message || '', language) ??
            t(
              'accountModal.useAccountModalController.failedToLoadSettingsCheckTheConsoleForDetails',
            ),
        );
      }
    } catch (error) {
      logger.error(
        'ACCOUNT',
        'Failed to load gambling settings',
        undefined,
        normalizeUnknownError(error),
      );
      setGamblingError(
        t('accountModal.useAccountModalController.failedToLoadSettings'),
      );
    }
  }, [canUseBetting, language, storage, t]);

  useEffect(() => {
    if (!params.isOpen) return;
    if (!canUseAuth) {
      setUser(null);
      setLoading(false);
      return;
    }
    void loadUser();
    void loadGamblingSettings();
  }, [canUseAuth, loadGamblingSettings, loadUser, params.isOpen]);

  const toggleGambling = async () => {
    if (!canUseBetting) return;
    setGamblingLoading(true);
    setGamblingError(null);
    setGamblingSuccess(null);
    try {
      const nextEnabled = !gamblingSettings.gambling_mode_enabled;
      const result = await storage.toggleGamblingMode();
      if (result.ok && result.value.success) {
        setGamblingSettings((previous) => ({
          ...previous,
          gambling_mode_enabled: !previous.gambling_mode_enabled,
        }));
        setGamblingSuccess(
          nextEnabled
            ? t('accountModal.useAccountModalController.gamblingModeEnabled')
            : t('accountModal.useAccountModalController.gamblingModeDisabled'),
        );
        setTimeout(() => setGamblingSuccess(null), 3000);
      } else {
        const message = result.ok ? result.value.message : result.error.message;
        setGamblingError(
          getSafeErrorDetail(message || '', language) ??
            t(
              'accountModal.useAccountModalController.failedToUpdateSettingsCheckTheConsoleForDetails',
            ),
        );
      }
    } catch (error) {
      logger.error(
        'ACCOUNT',
        'Failed to toggle gambling mode',
        undefined,
        normalizeUnknownError(error),
      );
      setGamblingError(
        getSafeErrorDetailFromUnknown(error, language) ??
          t(
            'accountModal.useAccountModalController.failedToUpdateSettingsCheckTheConsoleForDetails',
          ),
      );
    } finally {
      setGamblingLoading(false);
    }
  };

  const signOut = async () => {
    if (!canUseAuth) return;
    setSigningOut(true);
    setError(null);
    try {
      const result = await storage.signOut();
      if (!result.ok) {
        setError(
          getSafeErrorDetail(result.error.message || '', language) ??
            t(
              'accountModal.useAccountModalController.signOutFailedCheckTheConsoleForDetailsThen',
            ),
        );
        return;
      }
      params.onClose();
    } catch (error) {
      logger.error(
        'ACCOUNT',
        'Sign out failed',
        undefined,
        normalizeUnknownError(error),
      );
      setError(
        t('accountModal.useAccountModalController.signOutFailedPleaseTryAgain'),
      );
    } finally {
      setSigningOut(false);
    }
  };

  return {
    diagnostics,
    ...i18n,
    ...storageMode,
    canUseAuth,
    user,
    userFullName,
    loading,
    signingOut,
    error,
    gamblingSettings,
    gamblingLoading,
    gamblingError,
    gamblingSuccess,
    loadUser,
    toggleGambling,
    signOut,
    dismissGamblingError: () => setGamblingError(null),
  };
}
