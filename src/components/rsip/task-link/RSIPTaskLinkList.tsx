import type { RSIPTaskLink } from '../../../types';
import {
  automationLabel,
  effectLabel,
  eventLabel,
  type Tr,
} from './taskLinkUi';

export function RSIPTaskLinkList(props: {
  links: RSIPTaskLink[];
  nodeTitleById: Map<string, string>;
  chainLabelById: Map<string, string>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  t: Tr;
}) {
  return (
    <div className="space-y-2">
      {props.links.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600 dark:border-slate-700 dark:text-slate-400">
          {props.t('rsip.taskLink.rsipTaskLinkList.noIntegrationLinksYet')}
        </div>
      )}
      {props.links.map((link) => (
        <div
          key={link.id}
          className="flex items-center justify-between rounded-xl border border-gray-200 bg-white/80 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
        >
          <div>
            <p className="font-medium">
              {eventLabel(link.triggerEvent, props.t)} {'->'}{' '}
              {effectLabel(link.effect, props.t)}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {props.t('rsip.taskLink.rsipTaskLinkList.node')}:{' '}
              {props.nodeTitleById.get(link.rsipNodeId) ?? link.rsipNodeId}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {props.t('rsip.taskLink.rsipTaskLinkList.target')}:{' '}
              {props.chainLabelById.get(link.chainId) ?? link.chainId} |{' '}
              {link.chainKind === 'group'
                ? props.t('rsip.taskLink.rsipTaskLinkForm.group')
                : props.t('rsip.taskLink.rsipTaskLinkForm.task')}{' '}
              | {automationLabel(link.automation, props.t)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => props.onToggle(link.id)}
              className={`rounded-lg px-3 py-1.5 text-xs transition ${link.isActive ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-300'}`}
            >
              {link.isActive
                ? props.t('rsip.taskLink.rsipTaskLinkList.enabled')
                : props.t('rsip.taskLink.rsipTaskLinkList.disabled')}
            </button>
            <button
              type="button"
              onClick={() => props.onDelete(link.id)}
              className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs text-red-700 transition hover:bg-red-500/30 dark:text-red-300"
            >
              {props.t('deletedChainCard.delete')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
