import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import type { Translator } from '../../i18n';

interface AccountModalDeleteSectionProps {
  email: string | null | undefined;
  deleting: boolean;
  error: string | null;
  t: Translator;
  onDelete: (currentPassword: string) => void;
  onCancel: () => void;
}

const inputClassName =
  'w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-gray-900 outline-hidden focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-red-800 dark:bg-slate-800 dark:text-slate-100';

/**
 * Permanent account deletion. The user must type their email and current
 * password; the storage gateway re-checks the password before deleting.
 */
export function AccountModalDeleteSection({
  email,
  deleting,
  error,
  t,
  onDelete,
  onCancel,
}: AccountModalDeleteSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [typedEmail, setTypedEmail] = useState('');
  const [password, setPassword] = useState('');

  const emailMatches =
    !!email && typedEmail.trim().toLowerCase() === email.toLowerCase();
  const canDelete = emailMatches && password.length > 0 && !deleting;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full rounded-sm text-center text-xs font-medium text-gray-500 transition hover:text-red-600 hover:underline dark:text-slate-400 dark:hover:text-red-400"
      >
        {t('accountDeletion.start')}
      </button>
    );
  }

  const cancel = () => {
    setExpanded(false);
    setTypedEmail('');
    setPassword('');
    onCancel();
  };

  return (
    <form
      aria-labelledby="account-deletion-title"
      onSubmit={(event) => {
        event.preventDefault();
        if (canDelete) onDelete(password);
      }}
      className="space-y-4 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 shrink-0 text-red-600 dark:text-red-400"
          size={18}
        />
        <div className="space-y-2">
          <h4
            id="account-deletion-title"
            className="font-chinese text-base font-medium text-red-700 dark:text-red-300"
          >
            {t('accountDeletion.title')}
          </h4>
          <p className="text-xs text-red-700 dark:text-red-300">
            {t('accountDeletion.description')}
          </p>
          <p className="text-xs text-red-700 dark:text-red-300">
            {t('accountDeletion.exportHint')}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="account-deletion-email"
          className="text-xs font-medium text-red-700 dark:text-red-300"
        >
          {t('accountDeletion.confirmEmailLabel')}
        </label>
        <input
          id="account-deletion-email"
          type="email"
          autoComplete="off"
          spellCheck="false"
          placeholder={email ?? undefined}
          value={typedEmail}
          onChange={(event) => setTypedEmail(event.target.value)}
          className={inputClassName}
        />
      </div>
      <div className="space-y-1">
        <label
          htmlFor="account-deletion-password"
          className="text-xs font-medium text-red-700 dark:text-red-300"
        >
          {t('accountDeletion.passwordLabel')}
        </label>
        <input
          id="account-deletion-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClassName}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="text-sm font-medium text-red-700 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={cancel}
          disabled={deleting}
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
        >
          {t('accountDeletion.cancel')}
        </button>
        <button
          type="submit"
          disabled={!canDelete}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 size={16} />
          {deleting
            ? t('accountDeletion.deleting')
            : t('accountDeletion.confirm')}
        </button>
      </div>
    </form>
  );
}
