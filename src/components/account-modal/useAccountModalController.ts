import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuthUser } from '../../domain/auth';
import type { GamblingSettings } from '../../domain/userSettings';
import { useDiagnosticsExport } from './useDiagnosticsExport';
import { useI18n, type Language, type Translator } from '../../i18n';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import { hasStorageCapability } from '../../storage/ports';
import { useStorage } from '../../storage/useStorage';
import { useStorageMode } from '../../storage/useStorageMode';
import {
  getSafeErrorDetail,
  getSafeErrorDetailFromUnknown,
  toError,
} from '../../utils/errorMessage';
import { logger } from '../../utils/logger';

const DEFAULT_GAMBLING_SETTINGS: GamblingSettings = {
  gambling_mode_enabled: false,
  daily_bet_limit: null,
  max_single_bet: null,
};

interface UserLoadOutcome {
  /** `undefined` leaves the current user unchanged. */
  user: AuthUser | null | undefined;
  error: string | null;
}

async function readCurrentUser(
  storage: Pick<MomentumStorage, 'getCurrentUser'>,
  language: Language,
  t: Translator,
): Promise<UserLoadOutcome> {
  try {
    const result = await storage.getCurrentUser();
    if (result.ok) return { user: result.value, error: null };
    return {
      user: null,
      error:
        getSafeErrorDetail(result.error.message || '', language) ??
        t(
          'accountModal.useAccountModalController.failedToLoadUserInfoCheckTheConsoleFor',
        ),
    };
  } catch (error) {
    logger.error(
      'ACCOUNT',
      'Failed to get user info',
      undefined,
      toError(error),
    );
    return {
      user: undefined,
      error: t('accountModal.useAccountModalController.failedToLoadUserInfo'),
    };
  }
}

async function readGamblingSettings(
  storage: Pick<MomentumStorage, 'getGamblingSettings'>,
  language: Language,
  t: Translator,
): Promise<{ settings?: GamblingSettings; error: string | null }> {
  try {
    const result = await storage.getGamblingSettings();
    if (result.ok) return { settings: result.value, error: null };
    return {
      error:
        getSafeErrorDetail(result.error.message || '', language) ??
        t(
          'accountModal.useAccountModalController.failedToLoadSettingsCheckTheConsoleForDetails',
        ),
    };
  } catch (error) {
    logger.error(
      'ACCOUNT',
      'Failed to load gambling settings',
      undefined,
      toError(error),
    );
    return {
      error: t('accountModal.useAccountModalController.failedToLoadSettings'),
    };
  }
}

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
  const [loadedUser, setUser] = useState<AuthUser | null>(null);
  const [userLoading, setLoading] = useState(true);
  // Without auth there is no user to load.
  const user = canUseAuth ? loadedUser : null;
  const loading = canUseAuth && userLoading;
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

  // Opening the modal (or switching storage while open) starts a fresh load.
  const loadRequest = params.isOpen && canUseAuth ? storage : null;
  const [previousLoadRequest, setPreviousLoadRequest] = useState(loadRequest);
  if (loadRequest !== previousLoadRequest) {
    setPreviousLoadRequest(loadRequest);
    if (loadRequest) {
      setLoading(true);
      setError(null);
      setGamblingError(null);
    }
  }

  const applyUserLoad = useCallback((outcome: UserLoadOutcome) => {
    if (outcome.user !== undefined) setUser(outcome.user);
    setError(outcome.error);
    setLoading(false);
  }, []);

  const loadUser = useCallback(async () => {
    if (!canUseAuth) return;
    setLoading(true);
    setError(null);
    applyUserLoad(await readCurrentUser(storage, language, t));
  }, [applyUserLoad, canUseAuth, language, storage, t]);

  useEffect(() => {
    if (!params.isOpen || !canUseAuth) return;
    let cancelled = false;
    void readCurrentUser(storage, language, t).then((outcome) => {
      if (!cancelled) applyUserLoad(outcome);
    });
    if (canUseBetting) {
      void readGamblingSettings(storage, language, t).then((outcome) => {
        if (cancelled) return;
        if (outcome.settings) setGamblingSettings(outcome.settings);
        setGamblingError(outcome.error);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [
    applyUserLoad,
    canUseAuth,
    canUseBetting,
    language,
    params.isOpen,
    storage,
    t,
  ]);

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
        toError(error),
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
      logger.error('ACCOUNT', 'Sign out failed', undefined, toError(error));
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
