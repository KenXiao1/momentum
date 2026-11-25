import React, { useState, useEffect, useCallback } from 'react';
import type { AuthUser } from '../domain/auth';
import { useStorage } from '../storage/useStorage';
import { hasStorageCapability } from '../storage/ports';
import { useStorageMode } from '../storage/useStorageMode';
import { logger } from '../utils/logger';
import { AuthForm, type AuthFormMode } from './AuthForm';
import { IntroScreen } from './intro/IntroScreen';
import { PasswordRecoveryForm } from './PasswordRecoveryForm';
import { Loader2 } from 'lucide-react';
import { useI18n } from '../i18n';
import {
  getInitialAuthRedirect,
  type AuthRedirect,
} from '../utils/authRedirect';
import { isTauri } from '../utils/platform';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const { t } = useI18n();
  const storage = useStorage();
  const { setMode } = useStorageMode();
  // Auth result reported by a storage; it is only current for that storage.
  // Until the active storage reports, the wrapper is loading.
  const [authState, setAuthState] = useState<{
    storage: typeof storage;
    user: AuthUser | null;
  } | null>(null);
  const [view, setView] = useState<'intro' | 'auth'>('intro');
  const [initialMode, setInitialMode] = useState<AuthFormMode>('sign-in');
  // An email link the app opened with, until the user has dealt with it.
  const [redirect, setRedirect] = useState<AuthRedirect>(
    getInitialAuthRedirect,
  );
  const canUseAuth = hasStorageCapability(storage, 'auth');
  const loading = authState?.storage !== storage;
  const user = loading ? null : authState.user;

  const handleSwitchToLocalMode = useCallback(() => {
    setMode('local');
  }, [setMode]);

  useEffect(() => {
    if (!canUseAuth) return;

    let isMounted = true;

    const unsubscribeResult = storage.onAuthStateChange((event, session) => {
      logger.debug('AUTH', 'Auth state changed', {
        event,
        hasUser: Boolean(session.user),
      });
      if (event === 'PASSWORD_RECOVERY') setRedirect('password-recovery');
      setAuthState({ storage, user: session.user });
    });

    const init = async () => {
      const authResult = await storage.waitForAuthentication(3000);
      if (!isMounted) return;

      if (!authResult.ok) {
        logger.warn('AUTH', 'waitForAuthentication failed', {
          code: authResult.error.code,
          message: authResult.error.message,
        });
        setAuthState({ storage, user: null });
        return;
      }

      setAuthState({ storage, user: authResult.value.user });
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

  // A failed link only matters to someone who is signed out.
  if (user && redirect === 'invalid-link') setRedirect('none');

  if (user && redirect === 'password-recovery') {
    return (
      <PasswordRecoveryForm
        email={user.email}
        onDone={() => setRedirect('none')}
      />
    );
  }

  if (!user) {
    // A failed link, or a recovery link that did not produce a session.
    if (redirect !== 'none') {
      return (
        <AuthForm
          initialMode={redirect === 'password-recovery' ? 'reset' : 'sign-in'}
          initialError={t('authForm.emailLinkInvalid')}
          onBack={() => setRedirect('none')}
          onUseLocalMode={isTauri ? handleSwitchToLocalMode : undefined}
        />
      );
    }
    if (view === 'intro') {
      return (
        <IntroScreen
          onSignIn={() => {
            setInitialMode('sign-in');
            setView('auth');
          }}
          onSignUp={() => {
            setInitialMode('sign-up');
            setView('auth');
          }}
          onUseLocalMode={isTauri ? handleSwitchToLocalMode : undefined}
        />
      );
    }
    return (
      <AuthForm
        initialMode={initialMode}
        onBack={() => setView('intro')}
        onUseLocalMode={isTauri ? handleSwitchToLocalMode : undefined}
      />
    );
  }

  return <>{children}</>;
};
