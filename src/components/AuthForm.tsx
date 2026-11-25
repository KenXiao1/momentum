import React, { useState } from 'react';
import { useStorage } from '../storage/useStorage';
import { hasStorageCapability } from '../storage/ports';
import { logger } from '../utils/logger';
import { isTauri } from '../utils/platform';
import {
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { useI18n, type Translator } from '../i18n';
import {
  getSafeErrorDetail,
  getSafeErrorDetailFromUnknown,
} from '../utils/errorMessage';

export type AuthFormMode = 'sign-in' | 'sign-up' | 'reset';

interface AuthFormProps {
  initialMode?: AuthFormMode;
  /** Shown until the user acts, e.g. for an expired email link. */
  initialError?: string | null;
  onBack?: () => void;
  onUseLocalMode?: () => void;
}

function modeCopy(mode: AuthFormMode, t: Translator) {
  switch (mode) {
    case 'sign-up':
      return {
        title: t('authForm.createAccount'),
        description: t('authForm.startYourJourneyToMastery'),
        submit: t('authForm.createAccount'),
        failed: t('authForm.signUpFailedCheckTheConsoleForDetailsThen'),
      };
    case 'reset':
      return {
        title: t('authForm.resetPasswordTitle'),
        description: t('authForm.resetPasswordDescription'),
        submit: t('authForm.sendResetLink'),
        failed: t('authForm.resetRequestFailed'),
      };
    default:
      return {
        title: t('authForm.welcomeBack'),
        description: t('authForm.enterYourCredentialsToContinue'),
        submit: t('authForm.signIn'),
        failed: t('authForm.signInFailedCheckTheConsoleForDetailsThen'),
      };
  }
}

export const AuthForm: React.FC<AuthFormProps> = ({
  initialMode = 'sign-in',
  initialError = null,
  onBack,
  onUseLocalMode,
}) => {
  const { language, t } = useI18n();
  const [mode, setMode] = useState<AuthFormMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const storage = useStorage();
  const canUseAuth = hasStorageCapability(storage, 'auth');
  const copy = modeCopy(mode, t);

  const switchMode = (nextMode: AuthFormMode) => {
    setMode(nextMode);
    setError(null);
    setSuccessMessage(null);
  };

  const submit = async () => {
    if (mode === 'reset') {
      const result = await storage.requestPasswordReset(email);
      if (result.ok) {
        setSuccessMessage(
          isTauri
            ? t('authForm.resetLinkSentNative')
            : t('authForm.resetLinkSent'),
        );
        return;
      }
      setError(
        getSafeErrorDetail(result.error.message, language) ?? copy.failed,
      );
      logger.error(
        'AUTH',
        'Password reset request failed',
        { code: result.error.code },
        new Error(result.error.message),
      );
      return;
    }

    const result =
      mode === 'sign-up'
        ? await storage.signUp(email, password)
        : await storage.signIn(email, password);
    if (result.ok) {
      if (mode === 'sign-up')
        setSuccessMessage(
          t('authForm.accountCreatedPleaseCheckYourEmailToConfirm'),
        );
      logger.info('AUTH', `${mode} successful`);
      return;
    }
    setError(getSafeErrorDetail(result.error.message, language) ?? copy.failed);
    logger.error(
      'AUTH',
      `${mode} failed`,
      undefined,
      new Error(result.error.message),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUseAuth) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await submit();
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
            <span className="text-xs font-bold tracking-wide uppercase">
              {t('common.back')}
            </span>
          </button>
        )}

        <div className="glass-panel rounded-[40px] p-10 shadow-2xl">
          <div className="mb-10 text-center">
            <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              {copy.title}
            </h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {copy.description}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label
                htmlFor="auth-email"
                className="ml-4 text-[10px] font-bold tracking-widest text-violet-600 uppercase dark:text-violet-400"
              >
                {t('authForm.email')}
              </label>
              <div className="relative">
                <input
                  id="auth-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  spellCheck="false"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-14 w-full rounded-2xl border border-violet-200/50 bg-violet-50/50 pr-4 pl-4 font-medium text-slate-800 outline-hidden transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-violet-500/20 dark:bg-violet-900/10 dark:text-white dark:placeholder:text-slate-500"
                  placeholder={t('authForm.enterYourEmail')}
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div className="space-y-1">
                <label
                  htmlFor="auth-password"
                  className="ml-4 text-[10px] font-bold tracking-widest text-violet-600 uppercase dark:text-violet-400"
                >
                  {t('authForm.password')}
                </label>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete={
                      mode === 'sign-up' ? 'new-password' : 'current-password'
                    }
                    spellCheck="false"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-14 w-full rounded-2xl border border-violet-200/50 bg-violet-50/50 pr-12 pl-4 font-medium text-slate-800 outline-hidden transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-violet-500/20 dark:bg-violet-900/10 dark:text-white dark:placeholder:text-slate-500"
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
                    className="absolute top-1/2 right-4 -translate-y-1/2 rounded-sm text-slate-400 transition-colors hover:text-violet-600 focus:ring-2 focus:ring-violet-500/50 focus:outline-hidden dark:hover:text-violet-400"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {mode === 'sign-in' && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => switchMode('reset')}
                      className="mr-2 rounded-sm text-xs font-medium text-slate-500 transition hover:text-violet-600 hover:underline focus:ring-2 focus:ring-violet-500/50 focus:outline-hidden dark:text-slate-400 dark:hover:text-violet-400"
                    >
                      {t('authForm.forgotPassword')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-900/10"
              >
                <AlertCircle
                  className="mt-0.5 shrink-0 text-[#FF3B30]"
                  size={16}
                />
                <p className="text-sm font-medium text-[#FF3B30]">{error}</p>
              </div>
            )}

            {successMessage && (
              <div
                role="status"
                className="flex items-start gap-3 rounded-2xl border border-green-100 bg-green-50 p-4 dark:border-green-900/30 dark:bg-green-900/10"
              >
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
              className="mt-8 flex h-14 w-full items-center justify-center space-x-2 rounded-2xl bg-linear-to-r from-violet-600 to-purple-600 font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:from-violet-700 hover:to-purple-700 hover:shadow-xl hover:shadow-violet-500/30 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <span className="text-sm font-bold tracking-wide">
                  {copy.submit}
                </span>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            {mode === 'reset' ? (
              <button
                type="button"
                onClick={() => switchMode('sign-in')}
                className="rounded-sm text-sm font-bold text-violet-600 transition hover:underline focus:ring-2 focus:ring-violet-500/50 focus:outline-hidden dark:text-violet-400"
              >
                {t('authForm.backToSignIn')}
              </button>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {mode === 'sign-up'
                  ? t('authForm.alreadyHaveAnAccount')
                  : t('authForm.donTHaveAnAccount')}{' '}
                <button
                  type="button"
                  onClick={() =>
                    switchMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')
                  }
                  aria-label={
                    mode === 'sign-up'
                      ? t('authForm.switchToSignIn')
                      : t('authForm.switchToSignUp')
                  }
                  className="rounded-sm font-bold text-violet-600 transition hover:underline focus:ring-2 focus:ring-violet-500/50 focus:outline-hidden dark:text-violet-400"
                >
                  {mode === 'sign-up'
                    ? t('authForm.signIn')
                    : t('authForm.signUp')}
                </button>
              </p>
            )}

            {onUseLocalMode && (
              <button
                type="button"
                onClick={onUseLocalMode}
                className="mt-3 rounded-sm text-xs font-medium text-slate-500 transition hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
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
