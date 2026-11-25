import React, { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { useStorage } from '../storage/useStorage';
import { getSafeErrorDetail } from '../utils/errorMessage';
import { logger } from '../utils/logger';
import { toast } from '../utils/toast';

/** Supabase Auth's default minimum; a stricter project setting reports its own error. */
const MIN_PASSWORD_LENGTH = 6;

const inputClassName =
  'h-14 w-full rounded-2xl border border-violet-200/50 bg-violet-50/50 px-4 font-medium text-slate-800 outline-hidden transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-violet-500/20 dark:bg-violet-900/10 dark:text-white dark:placeholder:text-slate-500';
const labelClassName =
  'ml-4 text-[10px] font-bold tracking-widest text-violet-600 uppercase dark:text-violet-400';

interface PasswordRecoveryFormProps {
  email: string | null | undefined;
  /** Called after the password is saved, or when the user skips. */
  onDone: () => void;
}

/** Shown after a password reset link signs the user in. */
export const PasswordRecoveryForm: React.FC<PasswordRecoveryFormProps> = ({
  email,
  onDone,
}) => {
  const { language, t } = useI18n();
  const storage = useStorage();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('passwordRecovery.tooShort', { count: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirmation) {
      setError(t('passwordRecovery.mismatch'));
      return;
    }

    setSaving(true);
    setError(null);
    const result = await storage.updatePassword(password);
    setSaving(false);
    if (!result.ok) {
      setError(
        getSafeErrorDetail(result.error.message, language) ??
          t('passwordRecovery.failed'),
      );
      logger.error(
        'AUTH',
        'Password update failed',
        { code: result.error.code },
        new Error(result.error.message),
      );
      return;
    }
    toast.success(t('passwordRecovery.saved'));
    onDone();
  };

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4 font-sans">
      <div className="glass-panel w-full max-w-md rounded-[40px] p-10 shadow-2xl">
        <div className="mb-10 text-center">
          <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
            {t('passwordRecovery.title')}
          </h2>
          {email && (
            <p className="text-sm font-medium break-all text-slate-500 dark:text-slate-400">
              {t('passwordRecovery.description', { email })}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label htmlFor="recovery-password" className={labelClassName}>
              {t('passwordRecovery.newPassword')}
            </label>
            <input
              id="recovery-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClassName}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="recovery-confirmation" className={labelClassName}>
              {t('passwordRecovery.confirmPassword')}
            </label>
            <input
              id="recovery-confirmation"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              required
              className={inputClassName}
            />
          </div>

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

          <button
            type="submit"
            disabled={saving}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-linear-to-r from-violet-600 to-purple-600 text-sm font-bold tracking-wide text-white shadow-lg shadow-violet-500/25 transition hover:from-violet-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              t('passwordRecovery.save')
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onDone}
            disabled={saving}
            className="rounded-sm text-xs font-medium text-slate-500 transition hover:text-slate-700 hover:underline disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {t('passwordRecovery.skip')}
          </button>
        </div>
      </div>
    </div>
  );
};
