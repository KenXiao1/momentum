import { type Translator } from '../../i18n';
import type { Dispatch, SetStateAction } from 'react';
import type { SplitDraftItem } from './rsipViewHelpers';

interface RSIPSplitModeSectionProps {
  splitMode: boolean;
  setSplitMode: (value: boolean) => void;
  splitGoal: string;
  setSplitGoal: (value: string) => void;
  splitItems: SplitDraftItem[];
  setSplitItems: Dispatch<SetStateAction<SplitDraftItem[]>>;
  splitTemplateKeys: string[];
  onApplySplitTemplate: (templateKey: string) => void;
  onAddSplitRow: () => void;
  onSubmitSplit: () => void;
  canAddToday: boolean;
  t: Translator;
}

function getTemplateLabel(templateKey: string, t: Translator): string {
  if (templateKey === 'sleep') {
    return t('rsip.rsipSplitModeSection.sleepTemplate');
  }
  if (templateKey === 'exercise') {
    return t('rsip.rsipSplitModeSection.exerciseTemplate');
  }
  if (templateKey === 'diet') {
    return t('rsip.rsipSplitModeSection.dietTemplate');
  }
  return templateKey;
}

export function RSIPSplitModeSection({
  splitMode,
  setSplitMode,
  splitGoal,
  setSplitGoal,
  splitItems,
  setSplitItems,
  splitTemplateKeys,
  onApplySplitTemplate,
  onAddSplitRow,
  onSubmitSplit,
  canAddToday,
  t,
}: RSIPSplitModeSectionProps) {
  const updateSplitItem = (itemId: string, patch: Partial<SplitDraftItem>) => {
    setSplitItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item,
      ),
    );
  };

  return (
    <div className="bento-card mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
          {t('rsip.rsipSplitModeSection.splitModeShatterOversizedPolicies')}
        </h3>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={splitMode}
            onChange={(event) => setSplitMode(event.target.checked)}
          />
          {t('rsip.rsipSplitModeSection.enable')}
        </label>
      </div>

      {splitMode && (
        <div className="space-y-3">
          <input
            value={splitGoal}
            onChange={(event) => setSplitGoal(event.target.value)}
            placeholder={t(
              'rsip.rsipSplitModeSection.goalEGSleepEarlyAndWakeEarly',
            )}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />

          <div className="flex gap-2">
            {splitTemplateKeys.map((templateKey) => (
              <button
                key={templateKey}
                type="button"
                onClick={() => onApplySplitTemplate(templateKey)}
                className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-700 dark:bg-slate-700 dark:text-slate-200"
              >
                {getTemplateLabel(templateKey, t)}
              </button>
            ))}
            <button
              type="button"
              onClick={onAddSplitRow}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white"
            >
              {t('rsip.rsipSplitModeSection.addSubPolicy')}
            </button>
          </div>

          {splitItems.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-1 gap-2 rounded-xl border border-gray-200 p-3 dark:border-slate-700 md:grid-cols-12"
            >
              <input
                value={item.title}
                onChange={(event) =>
                  updateSplitItem(item.id, { title: event.target.value })
                }
                placeholder={t('rsip.rsipSplitModeSection.subPolicyTitle')}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 md:col-span-4"
              />
              <input
                value={item.rule}
                onChange={(event) =>
                  updateSplitItem(item.id, { rule: event.target.value })
                }
                placeholder={t('rsip.rsipSplitModeSection.subPolicyRule')}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 md:col-span-6"
              />
              <label className="inline-flex items-center justify-center gap-2 text-xs text-gray-600 dark:text-slate-300 md:col-span-2">
                <input
                  type="checkbox"
                  checked={item.isPassive}
                  onChange={(event) =>
                    updateSplitItem(item.id, {
                      isPassive: event.target.checked,
                    })
                  }
                />
                {t('rsip.rsipSplitModeSection.passive')}
              </label>
            </div>
          ))}

          <button
            type="button"
            onClick={onSubmitSplit}
            disabled={!canAddToday || splitItems.length === 0}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              !canAddToday || splitItems.length === 0
                ? 'cursor-not-allowed bg-gray-200 text-gray-500 dark:bg-slate-700 dark:text-slate-500'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {t('rsip.rsipSplitModeSection.createSplitPolicies')}
          </button>
        </div>
      )}
    </div>
  );
}
