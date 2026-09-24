import { type Translator } from '../../i18n';
import React, { useMemo } from 'react';
import { Clock, Plus } from 'lucide-react';
import type { RSIPMeta, RSIPNodeGroup, RSIPTreeNode } from '../../types';
import { getRsipTypeLabel, rsipTypeEmojiMap } from './rsipUi';

interface RSIPFormProps {
  tree: RSIPTreeNode[];
  meta: RSIPMeta;
  canAddToday: boolean;
  selectedParentId: string | undefined;
  setSelectedParentId: (id: string | undefined) => void;
  title: string;
  setTitle: (title: string) => void;
  rule: string;
  setRule: (rule: string) => void;
  createUseTimer: boolean;
  setCreateUseTimer: (enabled: boolean) => void;
  createTimerMinutes: number;
  setCreateTimerMinutes: (minutes: number) => void;
  createType: string;
  setCreateType: (type: string) => void;
  setCreateEmoji: (emoji: string) => void;
  groups?: RSIPNodeGroup[];
  selectedGroupId?: string;
  setSelectedGroupId?: (groupId: string | undefined) => void;
  createIsPassive?: boolean;
  setCreateIsPassive?: (isPassive: boolean) => void;
  onCreateGroup?: () => void;
  onAdd: () => void;
  language: string;
  t: Translator;
}

export const RSIPForm: React.FC<RSIPFormProps> = ({
  tree,
  meta,
  canAddToday,
  selectedParentId,
  setSelectedParentId,
  title,
  setTitle,
  rule,
  setRule,
  createUseTimer,
  setCreateUseTimer,
  createTimerMinutes,
  setCreateTimerMinutes,
  createType,
  setCreateType,
  setCreateEmoji,
  groups,
  selectedGroupId,
  setSelectedGroupId,
  createIsPassive,
  setCreateIsPassive,
  onCreateGroup,
  onAdd,
  language,
  t,
}) => {
  const parentOptions = useMemo(() => {
    const res: RSIPTreeNode[] = [];
    const walk = (n: RSIPTreeNode) => {
      res.push(n);
      n.children.forEach(walk);
    };
    tree.forEach(walk);
    return res;
  }, [tree]);

  const isAddDisabled = !canAddToday || !title.trim() || !rule.trim();

  return (
    <div className="bento-card mb-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <label className="mb-2 block font-chinese text-sm font-medium text-gray-700 dark:text-slate-300">
            {t('rsip.rsipForm.parentOptionalEmptyNewBranch')}
          </label>
          <select
            value={selectedParentId || ''}
            onChange={(e) => setSelectedParentId(e.target.value || undefined)}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-chinese text-gray-900 transition duration-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            <option value="">{t('rsip.rsipForm.noParentCreateNewRoot')}</option>
            {parentOptions.map((n) => (
              <option key={n.id} value={n.id}>
                {'—'.repeat(n.depth)}
                {n.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block font-chinese text-sm font-medium text-gray-700 dark:text-slate-300">
            {t('rsip.rsipForm.policyTitle')}
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t(
              'rsip.rsipForm.eGStartShoweringWithin15MinutesOfGettingHome',
            )}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-chinese text-gray-900 placeholder-gray-400 transition duration-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
          />
        </div>
        <div>
          <label className="mb-2 block font-chinese text-sm font-medium text-gray-700 dark:text-slate-300">
            {t('rsip.rsipForm.rule')}
          </label>
          <input
            value={rule}
            onChange={(e) => setRule(e.target.value)}
            placeholder={t(
              'rsip.rsipForm.eGStartA15MinuteTimerWhenHomeEnterThe',
            )}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-chinese text-gray-900 placeholder-gray-400 transition duration-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
          />
        </div>
      </div>

      {/* Timer settings */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="bento-subtle flex items-center justify-between rounded-2xl px-4 py-3">
          <div className="flex items-center space-x-2">
            <Clock size={16} className="text-emerald-600" />
            <span className="font-chinese text-sm text-gray-700 dark:text-slate-300">
              {t('rsip.rsipForm.enableTimer')}
            </span>
          </div>
          <label
            className="relative inline-flex cursor-pointer items-center"
            aria-label={t('rsip.rsipForm.enableTimer')}
          >
            <input
              type="checkbox"
              checked={createUseTimer}
              onChange={(e) => setCreateUseTimer(e.target.checked)}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-emerald-800"></div>
          </label>
        </div>

        <div className={`${createUseTimer ? '' : 'opacity-60'}`}>
          <label className="mb-2 block font-chinese text-sm font-medium text-gray-700 dark:text-slate-300">
            {t('rsip.rsipForm.timerMinutes')}
          </label>
          <input
            type="number"
            min={1}
            max={180}
            disabled={!createUseTimer}
            value={createTimerMinutes}
            onChange={(e) =>
              setCreateTimerMinutes(
                Math.max(1, Math.min(180, Number(e.target.value) || 1)),
              )
            }
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-chinese text-gray-900 transition duration-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Type selection */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-2 block font-chinese text-sm font-medium text-gray-700 dark:text-slate-300">
            {t('rsip.rsipForm.nodeType')}
          </label>
          <select
            value={createType}
            onChange={(e) => {
              const t = e.target.value;
              setCreateType(t);
              setCreateEmoji(rsipTypeEmojiMap[t] || '📜');
            }}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 font-chinese text-gray-900 transition duration-200 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            {Object.entries(rsipTypeEmojiMap).map(([type, emoji]) => (
              <option key={type} value={type}>
                {emoji} {getRsipTypeLabel(language, type)} ({type})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block font-chinese text-sm font-medium text-gray-700 dark:text-slate-300">
            {t('rsip.rsipForm.policyGroup')}
          </label>
          <div className="flex items-center gap-2">
            <select
              value={selectedGroupId || ''}
              onChange={(e) =>
                setSelectedGroupId?.(e.target.value || undefined)
              }
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 font-chinese text-gray-900 transition duration-200 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              <option value="">{t('rsip.rsipForm.noGroup')}</option>
              {(groups ?? []).map((group) => (
                <option key={group.id} value={group.id}>
                  {group.emoji ? `${group.emoji} ` : ''}
                  {group.title} ({t('rsip.rsipForm.tolerance')}{' '}
                  {group.faultTolerance})
                </option>
              ))}
            </select>
            {onCreateGroup && (
              <button
                type="button"
                onClick={onCreateGroup}
                className="rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-700 transition hover:bg-gray-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {t('rsip.rsipForm.newGroup')}
              </button>
            )}
          </div>
        </div>

        <div className="bento-subtle flex items-center justify-between rounded-2xl px-4 py-3">
          <span className="font-chinese text-sm text-gray-700 dark:text-slate-300">
            {t('rsip.rsipForm.passivePolicy')}
          </span>
          <label
            className="relative inline-flex cursor-pointer items-center"
            aria-label={t('rsip.rsipForm.passivePolicy')}
          >
            <input
              type="checkbox"
              checked={Boolean(createIsPassive)}
              onChange={(e) => setCreateIsPassive?.(e.target.checked)}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition after:content-[''] peer-checked:bg-indigo-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-indigo-800"></div>
          </label>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="font-chinese text-sm text-gray-600 dark:text-slate-400">
          {meta.allowMultiplePerDay
            ? t('rsip.rsipForm.multiplePerDayIsEnabledYouCanAddMore')
            : t('rsip.rsipForm.addAtMostOnePolicyPerDay')}{' '}
          {!meta.allowMultiplePerDay &&
            (canAddToday
              ? t('rsip.rsipForm.youCanAddToday')
              : t('rsip.rsipForm.alreadyAddedTodayTryAgainTomorrow'))}
        </div>
        <button
          onClick={onAdd}
          disabled={isAddDisabled}
          className={`flex items-center space-x-2 rounded-2xl px-6 py-3 font-medium shadow-lg transition duration-300 ${isAddDisabled ? 'bg-gray-200 text-gray-400 dark:bg-slate-700 dark:text-slate-500' : 'gradient-primary text-white hover:scale-105 hover:shadow-xl'}`}
        >
          <Plus size={18} />
          <span className="font-chinese">{t('rsip.rsipForm.addPolicy')}</span>
        </button>
      </div>
    </div>
  );
};
