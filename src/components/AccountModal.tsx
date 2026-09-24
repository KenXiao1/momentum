import type React from 'react';
import { AlertCircle, User } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { isTauri } from '../utils/platform';
import { fireAndForget } from '../utils/fireAndForget';
import { AccountModalDiagnosticsSection } from './account-modal/AccountModalDiagnosticsSection';
import { AccountModalHeader } from './account-modal/AccountModalHeader';
import { AccountModalLanguageSection } from './account-modal/AccountModalLanguageSection';
import { AccountModalStorageSection } from './account-modal/AccountModalStorageSection';
import { AccountModalUserContent } from './account-modal/AccountModalUserContent';
import { useAccountModalController } from './account-modal/useAccountModalController';
import { NotificationToggle } from './NotificationToggle';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
}) => {
  const controller = useAccountModalController({ isOpen, onClose });
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);
  if (!isOpen) return null;

  let accountContent: React.ReactNode;
  if (!controller.canUseAuth) {
    accountContent = (
      <div className="py-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 dark:bg-slate-700">
          <User className="text-gray-400 dark:text-slate-500" size={24} />
        </div>
        <p className="font-chinese text-gray-600 dark:text-slate-400">
          {controller.t('accountModal.usingLocalStorageNoAccountRequired')}
        </p>
      </div>
    );
  } else if (controller.loading) {
    accountContent = (
      <div className="py-8 text-center">
        <div className="gradient-primary mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
        <p className="font-chinese text-gray-600 dark:text-slate-400">
          {controller.t('accountModal.loadingAccount')}
        </p>
      </div>
    );
  } else if (controller.error) {
    accountContent = (
      <div className="py-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/20">
          <AlertCircle className="text-red-500 dark:text-red-400" size={24} />
        </div>
        <p className="mb-4 font-chinese text-red-600 dark:text-red-400">
          {controller.error}
        </p>
        <button
          type="button"
          onClick={() =>
            fireAndForget(controller.loadUser(), {
              label: 'ACCOUNT reload user',
            })
          }
          aria-label={controller.t('accountModal.retryLoadingUserInfo')}
          className="font-chinese font-medium text-primary-500 transition-colors hover:text-primary-600"
        >
          {controller.t('accountModal.retry')}
        </button>
      </div>
    );
  } else if (controller.user) {
    accountContent = (
      <AccountModalUserContent
        user={controller.user}
        userFullName={controller.userFullName}
        locale={controller.locale}
        t={controller.t}
        gamblingSettings={controller.gamblingSettings}
        gamblingLoading={controller.gamblingLoading}
        gamblingError={controller.gamblingError}
        gamblingSuccess={controller.gamblingSuccess}
        signingOut={controller.signingOut}
        onToggleGambling={() =>
          fireAndForget(controller.toggleGambling(), {
            label: 'ACCOUNT toggle gambling',
          })
        }
        onDismissGamblingError={controller.dismissGamblingError}
        onSignOut={() =>
          fireAndForget(controller.signOut(), { label: 'ACCOUNT sign out' })
        }
      />
    );
  } else {
    accountContent = (
      <div className="py-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 dark:bg-slate-700">
          <User className="text-gray-400 dark:text-slate-500" size={24} />
        </div>
        <p className="font-chinese text-gray-600 dark:text-slate-400">
          {controller.t('accountModal.userInfoNotFound')}
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800"
        style={{ overscrollBehavior: 'contain' }}
      >
        <AccountModalHeader
          title={controller.t('settings.title')}
          closeLabel={controller.t('accountModal.close')}
          onClose={onClose}
        />
        <div className="space-y-6 p-6">
          <AccountModalLanguageSection
            language={controller.language}
            setLanguage={controller.setLanguage}
            t={controller.t}
          />
          {isTauri && (
            <AccountModalStorageSection
              mode={controller.mode}
              canUseSupabase={controller.canUseSupabase}
              t={controller.t}
              onSwitchToLocal={() => controller.setMode('local')}
              onSwitchToSupabase={() => controller.setMode('supabase')}
            />
          )}
          <NotificationToggle placement="settings" />
          {accountContent}
          <AccountModalDiagnosticsSection
            t={controller.t}
            busy={controller.diagnostics.busy}
            status={controller.diagnostics.status}
            onExport={() => {
              void controller.diagnostics.exportFile();
            }}
            onClear={controller.diagnostics.clear}
          />
        </div>
      </div>
    </div>
  );
};
