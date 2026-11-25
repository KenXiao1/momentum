import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import type { MomentumStorage } from './MomentumStorage';
import { localStorageAdapter } from './localStorageAdapter';
import { StorageContext } from './storageContextValue';
import {
  StorageModeContext,
  type StorageMode,
} from './storageModeContextValue';
import { isSupabaseConfigured } from '../utils/supabaseConfig';
import { exceptionRuleManager } from '../services/exception-rule-manager/ExceptionRuleManager';
import { logger } from '../utils/logger';
import { useI18n } from '../i18n';
import { toError } from '../utils/errorMessage';
import { localPreferences } from '../utils/localPreferences';
import { isTauri } from '../utils/platform';
import { toast } from '../utils/toast';

interface StorageProviderProps {
  storage?: MomentumStorage;
  children: React.ReactNode;
}

export function StorageProvider({ storage, children }: StorageProviderProps) {
  const { t } = useI18n();
  const [selectedMode, setModeState] = useState<StorageMode>(() => {
    if (storage) return storage.kind;

    if (isTauri) {
      const preferredMode = localPreferences.getStorageMode();
      if (preferredMode === 'supabase' && isSupabaseConfigured) {
        return 'supabase';
      }
      return 'local';
    }

    return isSupabaseConfigured ? 'supabase' : 'local';
  });
  const [isChoiceStatePending, setIsChoicePending] = useState<boolean>(() => {
    if (storage || !isTauri || !isSupabaseConfigured) return false;
    return (
      localPreferences.getStorageMode() === null &&
      !localPreferences.getStorageModeHintDismissed()
    );
  });
  // Supabase storage is imported on demand; null until it has loaded.
  const [loadedSupabaseStorage, setLoadedSupabaseStorage] =
    useState<MomentumStorage | null>(null);

  // An injected storage fixes the mode and skips the first-launch choice.
  const mode = storage ? storage.kind : selectedMode;
  const isChoicePending = storage ? false : isChoiceStatePending;
  const needsSupabase = mode === 'supabase' && isSupabaseConfigured;
  const dynamicStorage = needsSupabase
    ? loadedSupabaseStorage
    : localStorageAdapter;

  const dismissFirstLaunchHint = useCallback(() => {
    if (storage) return;

    setModeState('local');
    setIsChoicePending(false);
    localPreferences.setStorageMode('local');
    localPreferences.setStorageModeHintDismissed(true);
  }, [storage]);

  const setMode = useCallback(
    (nextMode: StorageMode) => {
      if (storage) return;

      if (nextMode === 'supabase' && !isSupabaseConfigured) {
        toast.error(
          t(
            'storage.storageContext.supabaseIsNotConfiguredSoCloudModeIsUnavailable',
          ),
        );
        return;
      }

      setModeState(nextMode);
      localPreferences.setStorageMode(nextMode);
      localPreferences.setStorageModeHintDismissed(true);
      setIsChoicePending(false);

      logger.info('STORAGE', 'Storage mode switched', { mode: nextMode });
    },
    [storage, t],
  );

  useEffect(() => {
    if (storage || !needsSupabase || loadedSupabaseStorage) return;

    let cancelled = false;

    const loadSupabase = async () => {
      try {
        const { supabaseStorage } = await import('../infra/storage/supabase');
        if (cancelled) return;

        logger.debug('STORAGE', 'Supabase storage loaded dynamically');
        setLoadedSupabaseStorage(supabaseStorage);
      } catch (error) {
        const normalizedError = toError(error);
        logger.error(
          'STORAGE',
          'Failed to load Supabase storage, falling back to localStorage',
          undefined,
          normalizedError,
        );

        if (cancelled) return;

        setModeState('local');
        localPreferences.setStorageMode('local');
        toast.error(
          t(
            'storage.storageContext.failedToLoadCloudStorageSwitchedBackToLocal',
          ),
        );
      }
    };

    loadSupabase();

    return () => {
      cancelled = true;
    };
  }, [storage, needsSupabase, loadedSupabaseStorage, t]);

  const resolvedStorage = useMemo<MomentumStorage | null>(() => {
    if (storage) return storage;
    return dynamicStorage;
  }, [storage, dynamicStorage]);

  const storageModeContextValue = useMemo(
    () => ({
      mode,
      canUseSupabase: isSupabaseConfigured,
      isChoicePending,
      setMode,
      dismissFirstLaunchHint,
    }),
    [mode, isChoicePending, setMode, dismissFirstLaunchHint],
  );

  // A layout effect runs before any child's passive effect, so no rule
  // operation started by the app can reach the previous storage's rules.
  useLayoutEffect(() => {
    if (resolvedStorage) exceptionRuleManager.setStore(resolvedStorage);
  }, [resolvedStorage]);

  if (!resolvedStorage) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="gradient-primary mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t('storage.storageContext.initializingStorage')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <StorageModeContext.Provider value={storageModeContextValue}>
      <StorageContext.Provider value={resolvedStorage}>
        {children}
      </StorageContext.Provider>
    </StorageModeContext.Provider>
  );
}
