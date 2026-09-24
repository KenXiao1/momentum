import type { Chain, RSIPNode, RSIPTaskLink } from '../../types';
import { useI18n } from '../../i18n';
import { RSIPTaskLinkForm } from './task-link/RSIPTaskLinkForm';
import { RSIPTaskLinkList } from './task-link/RSIPTaskLinkList';
import { useRSIPTaskLinkEditor } from './task-link/useRSIPTaskLinkEditor';

interface RSIPTaskLinkPanelProps {
  links: RSIPTaskLink[];
  nodes: RSIPNode[];
  chains: Chain[];
  onUpsertLinks: (links: RSIPTaskLink[]) => void | Promise<unknown>;
  fixedChainId?: string;
  title?: string;
  description?: string;
}

function getModeButtonClass(
  mode: 'task_to_rsip' | 'rsip_to_task',
  active: boolean,
): string {
  if (!active) {
    return 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-200';
  }
  return mode === 'task_to_rsip'
    ? 'bg-emerald-600 text-white'
    : 'bg-indigo-600 text-white';
}

export function RSIPTaskLinkPanel(props: RSIPTaskLinkPanelProps) {
  const { t } = useI18n();
  const editor = useRSIPTaskLinkEditor({ ...props, t });
  const title = props.title ?? t('rsip.rsipTaskLinkPanel.rsipTaskIntegration');
  const description =
    props.description ??
    t(
      'rsip.rsipTaskLinkPanel.taskEventsCanAutoUpdateRsipRsipTaskActionsDefaultTo',
    );

  return (
    <div className="space-y-4">
      <div className="bento-card">
        <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-slate-100">
          {title}
        </h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-slate-300">
          {description}
        </p>
        <div className="mb-3 flex gap-2">
          {(['task_to_rsip', 'rsip_to_task'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => editor.handleModeChange(mode)}
              className={`rounded-xl px-3 py-2 text-sm transition ${getModeButtonClass(
                mode,
                editor.mode === mode,
              )}`}
            >
              {mode === 'task_to_rsip'
                ? t('rsip.rsipTaskLinkPanel.taskRsip')
                : t('rsip.rsipTaskLinkPanel.rsipTask')}
            </button>
          ))}
        </div>
        <RSIPTaskLinkForm
          mode={editor.mode}
          nodes={props.nodes}
          fixedChainId={props.fixedChainId}
          chains={editor.availableChains}
          selectedNodeId={editor.selectedNodeId}
          onSelectedNodeIdChange={editor.setSelectedNodeId}
          selectedChainId={editor.selectedChainId}
          onSelectedChainIdChange={editor.setSelectedChainId}
          triggerEvent={editor.triggerEvent}
          onTriggerEventChange={editor.setTriggerEvent}
          effect={editor.effect}
          onEffectChange={editor.setEffect}
          automation={editor.automation}
          onAutomationChange={editor.setAutomation}
          canCreate={editor.canCreate}
          onCreate={editor.handleCreate}
          t={t}
        />
      </div>
      <RSIPTaskLinkList
        links={editor.visibleLinks}
        nodeTitleById={editor.nodeTitleById}
        chainLabelById={editor.chainLabelById}
        onToggle={editor.handleToggle}
        onDelete={editor.handleDelete}
        t={t}
      />
    </div>
  );
}
