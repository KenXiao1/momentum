import type { RSIPNode, RSIPTaskLink } from '../../types';
import { useI18n } from '../../i18n';
import { DialogShell } from '../shared/DialogShell';

export function RSIPTaskLinkConfirmationDialog({
  link,
  node,
  onRespond,
}: {
  link: RSIPTaskLink;
  node: RSIPNode;
  onRespond: (approved: boolean) => void;
}) {
  const { tr } = useI18n();
  const isViolation = link.effect === 'mark_rsip_violated';
  return (
    <DialogShell
      titleId="rsip-link-confirm-title"
      onClose={() => onRespond(false)}
      className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800"
    >
      <h2
        id="rsip-link-confirm-title"
        className="mb-4 text-xl font-semibold text-gray-900 dark:text-slate-100"
      >
        {tr('确认任务联动', 'Confirm task integration')}
      </h2>
      <p className="mb-6 text-gray-700 dark:text-slate-200">
        {isViolation
          ? tr(
              `是否将国策「${node.title}」标记为已违反？这可能移除节点及其子节点，并消耗国策组容错。`,
              `Mark policy "${node.title}" as violated? This may remove nodes and their descendants and consume group tolerance.`,
            )
          : tr(
              `是否将国策「${node.title}」标记为今日已执行？`,
              `Mark policy "${node.title}" as executed today?`,
            )}
      </p>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => onRespond(false)}
          className="rounded-xl bg-gray-100 px-4 py-2 text-gray-800 dark:bg-slate-700 dark:text-slate-100"
        >
          {tr('取消', 'Cancel')}
        </button>
        <button
          type="button"
          onClick={() => onRespond(true)}
          className="rounded-xl bg-primary-500 px-4 py-2 text-white"
        >
          {tr('确认联动', 'Confirm')}
        </button>
      </div>
    </DialogShell>
  );
}
