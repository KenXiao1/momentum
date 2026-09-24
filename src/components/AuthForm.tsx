import React, { useState } from 'react';
import { useStorage } from '../storage/useStorage';
import { hasStorageCapability } from '../storage/ports';
import { logger } from '../utils/logger';
import {
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { useI18n } from '../i18n';
import {
  getSafeErrorDetail,
  getSafeErrorDetailFromUnknown,
} from '../utils/errorMessage';

interface AuthFormProps {
  initialIsSignUp?: boolean;
  onBack?: () => void;
  onUseLocalMode?: () => void;
}

export const AuthForm: React.FC<AuthFormProps> = ({
  initialIsSignUp = false,
  onBack,
  onUseLocalMode,
}) => {
  const { language, t } = useI18n();
  const [isSignUp, setIsSignUp] = useState(initialIsSignUp);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const storage = useStorage();
  const canUseAuth = hasStorageCapability(storage, 'auth');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUseAuth) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isSignUp) {
        const result = await storage.signUp(email, password);
        if (result.ok) {
          setSuccessMessage(
            t('authForm.accountCreatedPleaseCheckYourEmailToConfirm'),
          );
          logger.info('AUTH', 'Sign up successful', { email });
        } else {
          const safeDetail = getSafeErrorDetail(result.error.message, language);
          setError(
            safeDetail ??
              t('authForm.signUpFailedCheckTheConsoleForDetailsThen'),
          );
          logger.error(
            'AUTH',
            'Sign up failed',
            undefined,
            new Error(result.error.message),
          );
        }
      } else {
        const result = await storage.signIn(email, password);
        if (result.ok) {
          logger.info('AUTH', 'Sign in successful', { email });
        } else {
          const safeDetail = getSafeErrorDetail(result.error.message, language);
          setError(
            safeDetail ??
              t('authForm.signInFailedCheckTheConsoleForDetailsThen'),
          );
          logger.error(
            'AUTH',
            'Sign in failed',
            undefined,
            new Error(result.error.message),
          );
        }
      }
    } catch (err: unknown) {
      const safeDetail = getSafeErrorDetailFromUnknown(err, language);
      setError(
        safeDetail ??
          t('authForm.anUnexpectedErrorOccurredCheckTheConsoleForDetails'),
      );
      const errToLog = err instanceof Error ? err : new Error(String(err));
      logger.error('AUTH', 'Unexpected error during auth', undefined, errToLog);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4 font-sans transition-colors duration-500">
      <div className="w-full max-w-md">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t('authForm.goBack')}
            className="mb-8 flex items-center space-x-2 pl-2 text-slate-500 transition-colors hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400"
          >
            <ArrowLeft size={20} />
            <span className="text-xs font-bold uppercase tracking-wide">
              {t('common.back')}
            </span>
          </button>
        )}

        <div className="glass-panel rounded-[40px] p-10 shadow-2xl">
          <div className="mb-10 text-center">
            <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              {isSignUp
                ? t('authForm.createAccount')
                : t('authForm.welcomeBack')}
            </h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {isSignUp
                ? t('authForm.startYourJourneyToMastery')
                : t('authForm.enterYourCredentialsToContinue')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label className="ml-4 text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">
                {t('authForm.email')}
              </label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  spellCheck="false"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-14 w-full rounded-2xl border border-violet-200/50 bg-violet-50/50 pl-4 pr-4 font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-violet-500/20 dark:bg-violet-900/10 dark:text-white dark:placeholder:text-slate-500"
                  placeholder={t('authForm.enterYourEmail')}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="ml-4 text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">
                {t('authForm.password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  spellCheck="false"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-14 w-full rounded-2xl border border-violet-200/50 bg-violet-50/50 pl-4 pr-12 font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-violet-500/20 dark:bg-violet-900/10 dark:text-white dark:placeholder:text-slate-500"
                  placeholder={t('authForm.enterYourPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword
                      ? t('authForm.hidePassword')
                      : t('authForm.showPassword')
                  }
                  aria-pressed={showPassword}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded text-slate-400 transition-colors hover:text-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 dark:hover:text-violet-400"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-900/10">
                <AlertCircle
                  className="mt-0.5 shrink-0 text-[#FF3B30]"
                  size={16}
                />
                <p className="text-sm font-medium text-[#FF3B30]">{error}</p>
              </div>
            )}

            {successMessage && (
              <div className="flex items-start gap-3 rounded-2xl border border-green-100 bg-green-50 p-4 dark:border-green-900/30 dark:bg-green-900/10">
                <CheckCircle
                  className="mt-0.5 shrink-0 text-[#34C759]"
                  size={16}
                />
                <p className="text-sm font-medium text-[#34C759]">
                  {successMessage}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-8 flex h-14 w-full items-center justify-center space-x-2 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:from-violet-700 hover:to-purple-700 hover:shadow-xl hover:shadow-violet-500/30 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <span className="text-sm font-bold tracking-wide">
                  {isSignUp
                    ? t('authForm.createAccount')
                    : t('authForm.signIn')}
                </span>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isSignUp
                ? t('authForm.alreadyHaveAnAccount')
                : t('authForm.donTHaveAnAccount')}{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                aria-label={
                  isSignUp
                    ? t('authForm.switchToSignIn')
                    : t('authForm.switchToSignUp')
                }
                className="rounded font-bold text-violet-600 transition hover:underline focus:outline-none focus:ring-2 focus:ring-violet-500/50 dark:text-violet-400"
              >
                {isSignUp ? t('authForm.signIn') : t('authForm.signUp')}
              </button>
            </p>

            {onUseLocalMode && (
              <button
                type="button"
                onClick={onUseLocalMode}
                className="mt-3 rounded text-xs font-medium text-slate-500 transition hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
              >
                {t('authForm.switchToLocalMode')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
