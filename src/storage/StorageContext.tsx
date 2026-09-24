import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { MomentumStorage } from './MomentumStorage';
import { localStorageAdapter } from './localStorageAdapter';
import { StorageContext } from './storageContextValue';
import {
  StorageModeContext,
  type StorageMode,
} from './storageModeContextValue';
import { isSupabaseConfigured } from '../utils/supabaseConfig';
import { realTimeSyncService } from '../services/RealTimeSyncService';
import { RecycleBinService } from '../services/RecycleBinService';
import { migrationCoordinator } from '../services/migration';
import { logger } from '../utils/logger';
import { useI18n } from '../i18n';
import { normalizeUnknownError } from '../utils/errors/normalizeError';
import { localPreferences } from '../utils/localPreferences';
import { isTauri } from '../utils/platform';
import { toast } from '../utils/toast';

interface StorageProviderProps {
  storage?: MomentumStorage;
  children: React.ReactNode;
}

export function StorageProvider({ storage, children }: StorageProviderProps) {
  const { t } = useI18n();
  const [mode, setModeState] = useState<StorageMode>(() => {
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
  const [isChoicePending, setIsChoicePending] = useState<boolean>(() => {
    if (storage || !isTauri || !isSupabaseConfigured) return false;
    return (
      localPreferences.getStorageMode() === null &&
      !localPreferences.getStorageModeHintDismissed()
    );
  });
  const [dynamicStorage, setDynamicStorage] = useState<MomentumStorage | null>(
    () => {
      if (storage) return storage;
      if (mode === 'supabase' && isSupabaseConfigured) return null;
      return localStorageAdapter;
    },
  );

  const dismissFirstLaunchHint = useCallback(() => {
    if (storage) return;

    setModeState('local');
    setDynamicStorage(localStorageAdapter);
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
    if (!storage) return;

    setModeState(storage.kind);
    setDynamicStorage(storage);
    setIsChoicePending(false);
  }, [storage]);

  useEffect(() => {
    if (storage) return;

    if (mode === 'local') {
      setDynamicStorage(localStorageAdapter);
      return;
    }

    if (!isSupabaseConfigured) {
      setDynamicStorage(localStorageAdapter);
      return;
    }

    if (dynamicStorage?.kind === 'supabase') return;

    let cancelled = false;
    setDynamicStorage(null);

    const loadSupabase = async () => {
      try {
        const { supabaseStorage } = await import('../utils/supabaseStorage');
        if (cancelled) return;

        logger.debug('STORAGE', 'Supabase storage loaded dynamically');
        setDynamicStorage(supabaseStorage);
      } catch (error) {
        const normalizedError = normalizeUnknownError(error);
        logger.error(
          'STORAGE',
          'Failed to load Supabase storage, falling back to localStorage',
          undefined,
          normalizedError,
        );

        if (cancelled) return;

        setModeState('local');
        setDynamicStorage(localStorageAdapter);
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
  }, [storage, mode, dynamicStorage?.kind, t]);

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

  useEffect(() => {
    if (!resolvedStorage) return;

    realTimeSyncService.setStorage(resolvedStorage);
    RecycleBinService.setStorage(resolvedStorage);
    migrationCoordinator.setStorage(resolvedStorage);
    return () => {
      realTimeSyncService.setStorage(null);
      RecycleBinService.setStorage(null);
      migrationCoordinator.setStorage(null);
    };
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
