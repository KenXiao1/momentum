import { type Translator } from '../../i18n';
/**
 * DashboardRecommendSection — 今日推荐区域
 *
 * 根据条纹危险程度（快断了）、上次完成时间自动排序，
 * 让用户打开 app 时第一眼知道该点哪张卡。
 */

import React from 'react';
import { AlertTriangle, Flame, Sparkles, Zap } from 'lucide-react';
import type { ChainTreeNode } from '../../types';

interface DashboardRecommendSectionProps {
  chains: ChainTreeNode[];
  onStartChain: (chainId: string) => void;
  t: Translator;
}

type Urgency = 'at-risk' | 'active' | 'new';

interface RecommendItem {
  chain: ChainTreeNode;
  urgency: Urgency;
}

function getUrgency(isAtRisk: boolean, isActive: boolean): Urgency {
  if (isAtRisk) return 'at-risk';
  if (isActive) return 'active';
  return 'new';
}

function getBaseScore(isAtRisk: boolean, isActive: boolean): number {
  if (isAtRisk) return 3000;
  if (isActive) return 1000;
  return 0;
}

function computeRecommendations(chains: ChainTreeNode[]): RecommendItem[] {
  const now = Date.now();
  const MS_20H = 20 * 60 * 60 * 1000;

  const scored = chains
    .filter((c) => !c.deletedAt)
    .map((chain) => {
      const lastMs = chain.lastCompletedAt
        ? new Date(chain.lastCompletedAt).getTime()
        : null;
      const isAtRisk =
        chain.currentStreak > 0 && lastMs !== null && now - lastMs > MS_20H;
      const isActive = chain.currentStreak > 0;
      const urgency = getUrgency(isAtRisk, isActive);

      // 排序分数：危险条纹 > 活跃条纹 > 新任务
      const baseScore = getBaseScore(isAtRisk, isActive);
      const streakBonus = chain.currentStreak * 10;
      return { chain, urgency, score: baseScore + streakBonus };
    });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ chain, urgency }) => ({ chain, urgency }));
}

const urgencyConfig: Record<
  Urgency,
  {
    label: (t: DashboardRecommendSectionProps['t']) => string;
    icon: React.ReactNode;
    color: string;
  }
> = {
  'at-risk': {
    label: (t) => t('dashboard.dashboardRecommendSection.streakAtRisk'),
    icon: <AlertTriangle size={13} aria-hidden="true" />,
    color:
      'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40',
  },
  active: {
    label: (t) => t('dashboard.dashboardRecommendSection.keepTheStreak'),
    icon: <Flame size={13} aria-hidden="true" />,
    color:
      'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-700/40',
  },
  new: {
    label: (t) => t('dashboard.dashboardRecommendSection.newChain'),
    icon: <Sparkles size={13} aria-hidden="true" />,
    color:
      'text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700',
  },
};

const DashboardRecommendSectionComponent: React.FC<
  DashboardRecommendSectionProps
> = ({ chains, onStartChain, t }) => {
  const recommendations = computeRecommendations(chains);
  if (recommendations.length === 0) return null;

  // 只在有活跃条纹时显示，避免干扰刚开始使用的用户
  const hasActiveChains = recommendations.some(
    (r) => r.urgency === 'at-risk' || r.urgency === 'active',
  );
  if (!hasActiveChains) return null;

  return (
    <section
      className="mb-10 animate-fade-in"
      aria-label={t('dashboard.dashboardRecommendSection.todaySPicks')}
    >
      <div className="mb-3 flex items-center gap-2">
        <Zap size={15} className="text-primary-500" aria-hidden="true" />
        <h2 className="font-chinese text-sm font-semibold text-gray-600 dark:text-slate-400">
          {t('dashboard.dashboardRecommendSection.todaySPicksVariant2')}
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {recommendations.map(({ chain, urgency }) => {
          const cfg = urgencyConfig[urgency];
          return (
            <button
              key={chain.id}
              type="button"
              onClick={() => onStartChain(chain.id)}
              className={`focus-ring flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${cfg.color}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-chinese text-sm font-semibold text-gray-900 dark:text-slate-100">
                  {chain.name}
                </p>
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  {cfg.icon}
                  <span>{cfg.label(t)}</span>
                  {chain.currentStreak > 0 && (
                    <span className="ml-1 font-mono font-bold">
                      #{chain.currentStreak}
                    </span>
                  )}
                </div>
              </div>
              <Flame
                size={16}
                className={`flex-shrink-0 ${urgency === 'at-risk' ? 'text-amber-500' : 'text-primary-400'}`}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </section>
  );
};

export const DashboardRecommendSection = React.memo(
  DashboardRecommendSectionComponent,
);
DashboardRecommendSection.displayName = 'DashboardRecommendSection';
