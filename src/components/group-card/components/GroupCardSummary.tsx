import { translate } from '../../../i18n/translate';
import { type Translator } from '../../../i18n';
import { Flame, Users } from 'lucide-react';
import type { ChainTreeNode } from '../../../types';
import type {
  getChainTypeConfig,
  getGroupProgress,
} from '../../../utils/chainTree';
import { Icon } from '../../../utils/iconMap';

export function GroupCardSummary(props: {
  group: ChainTreeNode;
  progress: ReturnType<typeof getGroupProgress>;
  typeConfig: ReturnType<typeof getChainTypeConfig>;
  language: 'zh' | 'en';
  t: Translator;
}) {
  const { group, progress, typeConfig, language, t } = props;
  return (
    <>
      <div className="mb-6 flex items-start justify-between">
        <div className="flex-1 pr-4">
          <div className="mb-3 flex items-center space-x-3">
            <div
              className={`h-10 w-10 rounded-2xl ${typeConfig.bgColor} flex items-center justify-center`}
            >
              <Icon
                name={typeConfig.icon}
                size={18}
                className={typeConfig.color}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <h3 className="font-chinese text-2xl font-bold text-gray-900 transition-colors group-hover:text-primary-500 dark:text-slate-100">
                  {group.name}
                </h3>
                {group.totalCompletions > 0 && (
                  <div className="rounded-lg bg-amber-100 px-2 py-1 text-sm font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    {translate(
                      language === 'zh' ? 'zh' : 'en',
                      'groupCard.groupCardSummary.groupTotalCompletionsCycles',
                      { groupTotalCompletions: group.totalCompletions },
                    )}
                  </div>
                )}
              </div>
              <p className="font-mono text-xs uppercase tracking-wide text-gray-500">
                {typeConfig.name}
                {group.totalCompletions > 0 && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400">
                    {translate(
                      language === 'zh' ? 'zh' : 'en',
                      'groupCard.groupCardSummary.cycleGroupTotalCompletions1InProgress',
                      { groupTotalCompletions1: group.totalCompletions + 1 },
                    )}
                  </span>
                )}
              </p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-slate-300">
            {group.description}
          </p>
        </div>
      </div>
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-chinese text-sm text-gray-600 dark:text-slate-400">
            {t('groupCard.groupCardSummary.progress')}
          </span>
          <span className="font-mono text-sm font-semibold text-blue-500">
            {progress.completed}/{progress.total}
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-gray-200 dark:bg-slate-700">
          <div
            className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-[width] duration-500"
            style={{
              width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`,
            }}
          />
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-blue-200/50 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-4 text-center dark:border-blue-400/30 dark:from-blue-500/20 dark:to-blue-600/10">
          <div className="mb-2 flex items-center justify-center space-x-2 text-blue-500">
            <Users size={16} />
            <span className="font-mono text-2xl font-bold">
              {group.children.length}
            </span>
          </div>
          <div className="font-chinese text-xs font-medium text-gray-600 dark:text-slate-400">
            {t('groupCard.groupCardSummary.tasks')}
          </div>
        </div>
        <div className="rounded-2xl border border-primary-200/50 bg-gradient-to-br from-primary-500/10 to-primary-600/5 p-4 text-center dark:border-primary-400/30 dark:from-primary-500/20 dark:to-primary-600/10">
          <div className="mb-2 flex items-center justify-center space-x-2 text-primary-500">
            <Flame size={18} />
            <span className="font-mono text-2xl font-bold">
              #{group.currentStreak}
            </span>
            {group.groupRepeatCount && group.groupRepeatCount > 1 && (
              <span className="font-mono text-sm text-gray-500 dark:text-slate-400">
                ×{group.groupRepeatCount}
              </span>
            )}
          </div>
          <div className="font-chinese text-xs font-medium text-gray-600 dark:text-slate-400">
            {t('groupCard.groupCardSummary.groupStreak')}
          </div>
        </div>
      </div>
    </>
  );
}
