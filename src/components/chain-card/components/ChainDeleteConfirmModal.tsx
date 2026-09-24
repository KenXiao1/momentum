import { type Translator } from '../../../i18n';
import { Calendar, Flame, Settings, Trash2, TrendingUp } from 'lucide-react';
import type { Chain, ChainTreeNode } from '../../../types';
import { DeleteConfirmDialogShell } from '../../shared/DeleteConfirmDialogShell';

export function ChainDeleteConfirmModal({
  isOpen,
  chain,
  language: _language,
  t,
  onCancel,
  onConfirm,
}: {
  isOpen: boolean;
  chain: Chain | ChainTreeNode;
  language: 'zh' | 'en';
  t: Translator;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const successRate =
    chain.totalCompletions > 0
      ? Math.round(
          (chain.totalCompletions /
            (chain.totalCompletions + chain.totalFailures)) *
            100,
        )
      : 0;

  return (
    <DeleteConfirmDialogShell
      isOpen={isOpen}
      titleId="delete-dialog-title"
      descriptionId="delete-dialog-description"
      headerIcon={
        <Trash2 size={24} className="text-red-500" aria-hidden="true" />
      }
      title={t('chainCard.chainDeleteConfirmModal.deleteChain')}
      description={
        <>
          {t(
            'chainCard.chainDeleteConfirmModal.areYouSureYouWantToDeleteTheChain',
          )}
          <span className="font-semibold text-primary-500">{chain.name}</span>
          {t('chainCard.chainDeleteConfirmModal.label')}
        </>
      }
      warningContent={
        <div className="mb-8 rounded-2xl border border-red-200/60 bg-red-50/80 p-6 dark:border-red-800/40 dark:bg-red-900/20">
          <div className="mb-6 text-center">
            <p className="font-chinese text-sm font-medium text-red-600 dark:text-red-400">
              {t('chainCard.chainDeleteConfirmModal.thisWillPermanentlyDelete')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm text-red-600 dark:text-red-400">
            <div className="rounded-xl border border-red-200/60 bg-white/80 p-4 dark:border-red-800/40 dark:bg-slate-700/50">
              <div className="mb-3 flex items-center font-chinese font-semibold">
                <Flame size={14} className="mr-2" />
                {t('chainCard.chainDeleteConfirmModal.mainChain')}
              </div>
              <div className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                <div>
                  {t('chainCard.chainDeleteConfirmModal.streak')}#
                  {chain.currentStreak}
                </div>
                <div>
                  {t('chainCard.chainDeleteConfirmModal.completions')}
                  {chain.totalCompletions}
                </div>
                <div>
                  {t('chainCard.chainDeleteConfirmModal.failures')}
                  {chain.totalFailures}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-red-200/60 bg-white/80 p-4 dark:border-red-800/40 dark:bg-slate-700/50">
              <div className="mb-3 flex items-center font-chinese font-semibold">
                <Calendar size={14} className="mr-2" />
                {t('chainCard.chainDeleteConfirmModal.booking')}
              </div>
              <div className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                <div>
                  {t('chainCard.chainDeleteConfirmModal.streak')}#
                  {chain.auxiliaryStreak}
                </div>
                <div>
                  {t('chainCard.chainDeleteConfirmModal.failures')}
                  {chain.auxiliaryFailures}
                </div>
                <div>
                  {t('chainCard.chainDeleteConfirmModal.exceptions')}
                  {chain.auxiliaryExceptions?.length || 0}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-red-600 dark:text-red-400">
            <div className="rounded-xl border border-red-200/60 bg-white/80 p-4 dark:border-red-800/40 dark:bg-slate-700/50">
              <div className="mb-3 flex items-center font-chinese font-semibold">
                <TrendingUp size={14} className="mr-2" />
                {t('chainCard.chainDeleteConfirmModal.history')}
              </div>
              <div className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                <div>
                  {t('chainCard.chainDeleteConfirmModal.completions')}
                  {chain.totalCompletions}
                </div>
                <div>
                  {t('chainCard.chainDeleteConfirmModal.failures')}
                  {chain.totalFailures}
                </div>
                <div>
                  {t('chainCard.chainDeleteConfirmModal.successRate')}
                  {successRate}%
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-red-200/60 bg-white/80 p-4 dark:border-red-800/40 dark:bg-slate-700/50">
              <div className="mb-3 flex items-center font-chinese font-semibold">
                <Settings size={14} className="mr-2" />
                {t('chainCard.chainDeleteConfirmModal.rules')}
              </div>
              <div className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
                <div>
                  {t('chainCard.chainDeleteConfirmModal.exceptions')}
                  {chain.exceptions.length}
                </div>
                <div>
                  {t('chainCard.chainDeleteConfirmModal.bookingExceptions')}
                  {chain.auxiliaryExceptions?.length || 0}
                </div>
                <div>{t('chainCard.chainDeleteConfirmModal.allSettings')}</div>
              </div>
            </div>
          </div>
        </div>
      }
      cancelLabel={t('chainCard.chainDeleteConfirmModal.cancel')}
      confirmLabel={t('chainCard.chainDeleteConfirmModal.delete')}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
