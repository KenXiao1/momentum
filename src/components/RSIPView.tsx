import { useState } from 'react';
import type { RSIPViewProps } from './RSIPView.types';
import { BackButton } from './BackButton';
import { RSIPInsightsPanel } from './rsip/RSIPInsightsPanel';
import { RSIPPolicyLibrary } from './rsip/RSIPPolicyLibrary';
import { RSIPRunHistory } from './rsip/RSIPRunHistory';
import { RSIPTreeTab } from './rsip/RSIPTreeTab';
import { RSIPViolationDialog } from './rsip/RSIPViolationDialog';
import { useRSIPViewModel } from './rsip/hooks/useRSIPViewModel';

type RSIPTab = 'tree' | 'library' | 'history' | 'insights';

export function RSIPView(props: RSIPViewProps) {
  const [activeTab, setActiveTab] = useState<RSIPTab>('tree');
  const model = useRSIPViewModel(props);

  return (
    <div className="bg-background min-h-screen p-4 md:p-6">
      <div className="relative mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BackButton
              onClick={props.onBack}
              label={model.t('common.back')}
              iconSize={22}
              className="rounded-2xl p-3 text-gray-400 hover:bg-white/60 hover:text-gray-700 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
            />
            <div>
              <h1 className="font-chinese text-3xl font-bold text-gray-900 dark:text-slate-100 md:text-4xl">
                {model.t('rsipView.rsipPolicyTree')}
              </h1>
              <p className="font-mono text-xs uppercase tracking-wider text-gray-600 dark:text-slate-400">
                {model.t('rsipView.rsipProcessCollaboration')}
              </p>
            </div>
          </div>
        </header>

        <div className="mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('tree')}
            className={`rounded-xl px-4 py-2 text-sm transition ${
              activeTab === 'tree'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            {model.t('rsipView.tree')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`rounded-xl px-4 py-2 text-sm transition ${
              activeTab === 'library'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            {model.t('rsipView.library')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`rounded-xl px-4 py-2 text-sm transition ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            {model.t('rsipView.runs')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('insights')}
            className={`rounded-xl px-4 py-2 text-sm transition ${
              activeTab === 'insights'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            {model.t('rsipView.insights')}
          </button>
        </div>

        {activeTab === 'tree' && <RSIPTreeTab model={model} />}

        {activeTab === 'library' && (
          <RSIPPolicyLibrary
            entries={props.policyLibrary ?? []}
            tree={model.tree}
            onRestore={model.handleRestoreFromLibrary}
          />
        )}

        {activeTab === 'history' && (
          <RSIPRunHistory records={props.runHistory ?? []} />
        )}

        {activeTab === 'insights' && (
          <RSIPInsightsPanel insights={model.insights} />
        )}

        {model.violationDialogNode && (
          <RSIPViolationDialog
            isOpen={true}
            node={model.violationDialogNode}
            descendants={model.violationDescendants}
            groupMessage={model.violationGroupMessage}
            onConfirm={model.handleConfirmViolation}
            onCancel={model.closeViolationDialog}
          />
        )}
      </div>
    </div>
  );
}
