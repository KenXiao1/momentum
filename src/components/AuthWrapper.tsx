import React, { useState, useEffect, useCallback } from 'react';
import type { AuthUser } from '../domain/auth';
import { useStorage } from '../storage/useStorage';
import { hasStorageCapability } from '../storage/ports';
import { useStorageMode } from '../storage/useStorageMode';
import { logger } from '../utils/logger';
import { AuthForm } from './AuthForm';
import { IntroScreen } from './IntroScreen';
import { Loader2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { isTauri } from '../utils/platform';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const { t } = useI18n();
  const storage = useStorage();
  const { setMode } = useStorageMode();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'intro' | 'auth'>('intro');
  const [initialIsSignUp, setInitialIsSignUp] = useState(false);
  const canUseAuth = hasStorageCapability(storage, 'auth');

  const handleSwitchToLocalMode = useCallback(() => {
    setMode('local');
  }, [setMode]);

  useEffect(() => {
    if (!canUseAuth) {
      setUser(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const unsubscribeResult = storage.onAuthStateChange((event, session) => {
      logger.debug('AUTH', 'Auth state changed', {
        event,
        hasUser: Boolean(session.user),
      });
      setUser(session.user);
      setLoading(false);
    });

    const init = async () => {
      const authResult = await storage.waitForAuthentication(3000);
      if (!isMounted) return;

      if (!authResult.ok) {
        logger.warn('AUTH', 'waitForAuthentication failed', {
          code: authResult.error.code,
          message: authResult.error.message,
        });
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(authResult.value.user);
      setLoading(false);
    };

    init();

    return () => {
      isMounted = false;
      if (unsubscribeResult.ok) {
        unsubscribeResult.value();
      }
    };
  }, [canUseAuth, storage]);

  if (!canUseAuth) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="gradient-primary mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl shadow-xl">
            <Loader2 className="animate-spin text-white" size={24} />
          </div>
          <h2 className="mb-2 font-chinese text-2xl font-bold text-gray-900 dark:text-slate-100">
            {t('authWrapper.authenticating')}
          </h2>
          <p className="font-mono text-sm text-gray-600 dark:text-slate-400">
            {t('authWrapper.authenticatingVariant2')}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (view === 'intro') {
      return (
        <IntroScreen
          onSignIn={() => {
            setInitialIsSignUp(false);
            setView('auth');
          }}
          onSignUp={() => {
            setInitialIsSignUp(true);
            setView('auth');
          }}
          onUseLocalMode={isTauri ? handleSwitchToLocalMode : undefined}
        />
      );
    }
    return (
      <AuthForm
        initialIsSignUp={initialIsSignUp}
        onBack={() => setView('intro')}
        onUseLocalMode={isTauri ? handleSwitchToLocalMode : undefined}
      />
    );
  }

  return <>{children}</>;
};
