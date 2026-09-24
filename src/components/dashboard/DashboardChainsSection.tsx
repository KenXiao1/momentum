import { type Translator } from '../../i18n';
import React from 'react';
import { Download, Layers, Plus, Trash2, TreePine } from 'lucide-react';

import type { ChainTreeNode, ScheduledSession } from '../../types';
import { VirtualizedChainList } from '../VirtualizedChainList';

interface DashboardChainsSectionProps {
  topLevelChains: ChainTreeNode[];
  recycleBinCount: number;
  getScheduledSession: (chainId: string) => ScheduledSession | undefined;
  onStartChain: (chainId: string) => void;
  onScheduleChain: (chainId: string) => void;
  onViewChainDetail: (chainId: string) => void;
  onCancelScheduledSession?: (chainId: string) => void;
  onCompleteBooking?: (chainId: string) => void;
  onDeleteChain: (chainId: string) => void;
  onShowRecycleBin: () => void;
  onShowImportExport: () => void;
  onOpenRSIP?: () => void;
  onCreateChain: () => void;
  onCreateTaskGroup?: () => void;
  t: Translator;
}

const DashboardChainsSectionComponent: React.FC<
  DashboardChainsSectionProps
> = ({
  topLevelChains,
  recycleBinCount,
  getScheduledSession,
  onStartChain,
  onScheduleChain,
  onViewChainDetail,
  onCancelScheduledSession,
  onCompleteBooking,
  onDeleteChain,
  onShowRecycleBin,
  onShowImportExport,
  onOpenRSIP,
  onCreateChain,
  onCreateTaskGroup,
  t,
}) => (
  <div className="animate-slide-up">
    <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h2 className="mb-1 font-chinese text-2xl font-bold tracking-tight text-gray-950 dark:text-slate-100 sm:text-3xl">
          {t('dashboard.dashboardChainsSection.yourTaskChains')}
        </h2>
        <p className="font-chinese text-sm text-gray-500 dark:text-slate-400">
          {t(
            'dashboard.dashboardChainsSection.chooseWhatYouWantToMoveForwardNow',
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onCreateChain}
          aria-label={t('dashboard.dashboardChainsSection.newChain')}
          className="focus-ring flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-gray-950 px-5 py-2.5 font-medium text-white transition-colors hover:bg-primary-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-primary-200"
        >
          <Plus size={16} aria-hidden="true" />
          <span className="font-chinese font-semibold">
            {t('dashboard.dashboardChainsSection.newChain')}
          </span>
        </button>
        {onCreateTaskGroup && (
          <button
            type="button"
            onClick={onCreateTaskGroup}
            aria-label={t('dashboard.dashboardChainsSection.newGroup')}
            className="focus-ring flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 font-medium text-gray-800 transition-colors hover:border-primary-300 hover:text-primary-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-primary-500"
          >
            <Layers size={16} aria-hidden="true" />
            <span className="font-chinese font-medium">
              {t('dashboard.dashboardChainsSection.newGroup')}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={onShowRecycleBin}
          aria-label={t('dashboard.dashboardChainsSection.recycleBin')}
          className="focus-ring relative flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <Trash2 size={16} aria-hidden="true" />
          <span className="font-chinese font-medium">
            {t('dashboard.dashboardChainsSection.recycleBin')}
          </span>
          {recycleBinCount > 0 && (
            <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
              {recycleBinCount > 99 ? '99+' : recycleBinCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onShowImportExport}
          aria-label={t('dashboard.dashboardChainsSection.data')}
          className="focus-ring flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <Download size={16} aria-hidden="true" />
          <span className="font-chinese font-medium">
            {t('dashboard.dashboardChainsSection.data')}
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenRSIP}
          aria-label={t('dashboard.dashboardChainsSection.rsipTree')}
          className="focus-ring flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300"
        >
          <TreePine size={16} aria-hidden="true" />
          <span className="font-chinese font-medium">
            {t('dashboard.dashboardChainsSection.rsipTree')}
          </span>
        </button>
      </div>
    </div>

    <VirtualizedChainList
      topLevelChains={topLevelChains}
      getScheduledSession={getScheduledSession}
      onStartChain={onStartChain}
      onScheduleChain={onScheduleChain}
      onViewDetail={onViewChainDetail}
      onCancelScheduledSession={onCancelScheduledSession}
      onCompleteBooking={onCompleteBooking}
      onDelete={onDeleteChain}
    />
  </div>
);

export const DashboardChainsSection = React.memo(
  DashboardChainsSectionComponent,
);

DashboardChainsSection.displayName = 'DashboardChainsSection';
