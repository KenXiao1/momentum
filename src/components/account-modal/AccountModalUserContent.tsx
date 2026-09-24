import { type Translator } from '../../i18n';
import { Dices, LogOut, User, X } from 'lucide-react';
import type { AuthUser } from '../../domain/auth';
import type { GamblingSettings } from '../../domain/userSettings';
import { Switch } from '../Switch';

interface AccountModalUserContentProps {
  user: AuthUser;
  userFullName: string | null;
  locale: Intl.LocalesArgument;
  t: Translator;
  gamblingSettings: GamblingSettings;
  gamblingLoading: boolean;
  gamblingError: string | null;
  gamblingSuccess: string | null;
  signingOut: boolean;
  onToggleGambling: () => void;
  onDismissGamblingError: () => void;
  onSignOut: () => void;
}

const formatLocaleDateOrDash = (
  dateString: string | null | undefined,
  locale: Intl.LocalesArgument,
) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString(locale);
};

export function AccountModalUserContent({
  user,
  userFullName,
  locale,
  t,
  gamblingSettings,
  gamblingLoading,
  gamblingError,
  gamblingSuccess,
  signingOut,
  onToggleGambling,
  onDismissGamblingError,
  onSignOut,
}: AccountModalUserContentProps) {
  return (
    <div className="space-y-6">
      {/* User Info */}
      <div className="flex items-center space-x-4 rounded-2xl bg-gray-50 p-4 dark:bg-slate-700">
        <div className="gradient-primary flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg">
          <User className="text-white" size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="mb-1 font-chinese text-lg font-medium text-gray-900 dark:text-slate-100">
            {t('accountModal.accountModalUserContent.account')}
          </h3>
          <p className="truncate text-sm text-gray-600 dark:text-slate-400">
            {user.email}
          </p>
          {userFullName && (
            <p className="text-xs text-gray-500 dark:text-slate-500">
              {userFullName}
            </p>
          )}
        </div>
      </div>

      {/* Account Details */}
      <div className="space-y-3">
        <div className="flex items-center justify-between py-2">
          <span className="font-chinese text-sm text-gray-600 dark:text-slate-400">
            {t('accountModal.accountModalUserContent.created')}
          </span>
          <span className="text-sm text-gray-900 dark:text-slate-100">
            {formatLocaleDateOrDash(user.createdAt, locale)}
          </span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="font-chinese text-sm text-gray-600 dark:text-slate-400">
            {t('accountModal.accountModalUserContent.lastSignIn')}
          </span>
          <span className="text-sm text-gray-900 dark:text-slate-100">
            {user.lastSignInAt
              ? new Date(user.lastSignInAt).toLocaleDateString(locale)
              : t('accountModal.accountModalUserContent.firstSignIn')}
          </span>
        </div>
      </div>

      {/* 狂赌模式设置 */}
      <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-600 dark:bg-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg">
              <Dices className="text-white" size={16} />
            </div>
            <div>
              <h4 className="font-chinese text-base font-medium text-gray-900 dark:text-slate-100">
                {t('accountModal.accountModalUserContent.gamblingMode')}
              </h4>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {t(
                  'accountModal.accountModalUserContent.betPointsOnTasksForExtraRewards',
                )}
              </p>
            </div>
          </div>

          <Switch
            checked={gamblingSettings.gambling_mode_enabled}
            onCheckedChange={() => onToggleGambling()}
            disabled={gamblingLoading}
            loading={gamblingLoading}
            variant="danger"
            aria-label={t(
              'accountModal.accountModalUserContent.toggleGamblingMode',
            )}
          />
        </div>

        {/* 状态说明 */}
        <div className="text-xs text-gray-600 dark:text-slate-400">
          {gamblingSettings.gambling_mode_enabled ? (
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
              <span>
                {t(
                  'accountModal.accountModalUserContent.enabledYouCanBetWhenStartingATask',
                )}
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-gray-400"></div>
              <span>
                {t(
                  'accountModal.accountModalUserContent.disabledBettingIsUnavailable',
                )}
              </span>
            </div>
          )}
        </div>

        {/* 成功消息 */}
        {gamblingSuccess && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              {gamblingSuccess}
            </p>
          </div>
        )}

        {/* 错误消息 */}
        {gamblingError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-700 dark:text-red-300">
                {gamblingError}
              </p>
              <button
                type="button"
                onClick={onDismissGamblingError}
                aria-label={t(
                  'accountModal.accountModalUserContent.dismissError',
                )}
                className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sign Out Button */}
      <button
        type="button"
        onClick={onSignOut}
        disabled={signingOut}
        aria-label={t('accountModal.accountModalUserContent.signOut')}
        className="flex w-full items-center justify-center space-x-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 font-chinese font-medium text-red-600 shadow-sm transition duration-300 hover:scale-105 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
      >
        {signingOut ? (
          <>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-400/30 border-t-red-400"></div>
            <span>{t('accountModal.accountModalUserContent.signingOut')}</span>
          </>
        ) : (
          <>
            <LogOut size={20} />
            <span>{t('accountModal.accountModalUserContent.signOut')}</span>
          </>
        )}
      </button>
    </div>
  );
}
