import { useMemo, useState } from 'react';
import type { RSIPLibraryEntry, RSIPTreeNode } from '../../types';
import { useI18n } from '../../i18n';

interface RSIPPolicyLibraryProps {
  entries: RSIPLibraryEntry[];
  tree: RSIPTreeNode[];
  onRestore: (entryId: string, parentId?: string) => void | Promise<void>;
}

interface ParentOption {
  id: string;
  label: string;
}

function flattenTree(tree: RSIPTreeNode[]): ParentOption[] {
  const options: ParentOption[] = [];
  const walk = (node: RSIPTreeNode) => {
    options.push({
      id: node.id,
      label: `${'  '.repeat(node.depth)}${node.title}`,
    });
    node.children.forEach(walk);
  };
  tree.forEach(walk);
  return options;
}

export function RSIPPolicyLibrary({
  entries,
  tree,
  onRestore,
}: RSIPPolicyLibraryProps) {
  const { t } = useI18n();
  const [parentSelections, setParentSelections] = useState<
    Record<string, string | undefined>
  >({});

  const parentOptions = useMemo(() => flattenTree(tree), [tree]);
  const sortedEntries = useMemo(
    () =>
      [...entries].sort(
        (a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime(),
      ),
    [entries],
  );

  if (sortedEntries.length === 0) {
    return (
      <div className="bento-card">
        <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-slate-100">
          {t('rsip.rsipPolicyLibrary.policyLibrary')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-slate-300">
          {t(
            'rsip.rsipPolicyLibrary.noArchivedPoliciesYetRemovedNodesWillBeStored',
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bento-card">
        <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-slate-100">
          {t('rsip.rsipPolicyLibrary.policyLibrary')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-slate-300">
          {t(
            'rsip.rsipPolicyLibrary.archivedEntriesPreserveInternalizationProgressAndCanBeRestored',
          )}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sortedEntries.map((entry) => {
          const progress = Math.max(
            0,
            Math.min(100, entry.internalizationProgress),
          );
          const statusText = t('rsip.rsipPolicyLibrary.status', {
            progress,
            days: entry.cumulativeExecutionDays,
            times: entry.timesUsed,
          });

          return (
            <div
              key={entry.id}
              className="rounded-2xl border border-gray-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/60"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="text-lg">{entry.emoji || '🧭'}</span>
                <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                  {entry.title}
                </h3>
              </div>

              <p className="mb-3 text-sm text-gray-600 dark:text-slate-300">
                {entry.rule}
              </p>

              <div className="mb-2 h-2 w-full rounded-full bg-gray-200 dark:bg-slate-700">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mb-3 text-xs text-gray-600 dark:text-slate-400">
                {statusText}
              </p>

              <div className="flex items-center gap-2">
                <select
                  value={parentSelections[entry.id] ?? ''}
                  onChange={(event) =>
                    setParentSelections((prev) => ({
                      ...prev,
                      [entry.id]: event.target.value || undefined,
                    }))
                  }
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">
                    {t('rsip.rsipPolicyLibrary.restoreAsNewRoot')}
                  </option>
                  {parentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() =>
                    void onRestore(entry.id, parentSelections[entry.id])
                  }
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                >
                  {t('deletedChainCard.restore')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
