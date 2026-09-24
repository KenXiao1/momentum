import { useI18n } from '../../i18n';
import { Check, Shield, X } from 'lucide-react';
import type { RSIPNode, RSIPStabilityPhase } from '../../types';
import { RSIPConstraintIndicator } from './RSIPConstraintIndicator';
import { RSIPPhaseBadge } from './RSIPPhaseBadge';
import { RSIPPhaseProgress } from './RSIPPhaseProgress';

const CARD_BG_CLASS_BY_PHASE: Record<RSIPStabilityPhase, string> = {
  E0: 'bg-white border-slate-200 dark:bg-white/5 dark:border-white/10',
  E1: 'bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30',
  E2: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30',
};

const HOVER_BORDER_CLASS_BY_PHASE: Record<RSIPStabilityPhase, string> = {
  E0: 'hover:border-slate-300 dark:hover:border-white/20',
  E1: 'hover:border-blue-300 dark:hover:border-blue-500/50',
  E2: 'hover:border-emerald-300 dark:hover:border-emerald-500/50',
};

interface RSIPStrictModeCardProps {
  node: RSIPNode;
  descendantCount: number;
  failureCost: number;
  onMarkExecuted: () => void;
  onMarkViolated: () => void;
  onReinforce?: () => void;
}

export function RSIPStrictModeCard({
  node,
  descendantCount,
  failureCost,
  onMarkExecuted,
  onMarkViolated,
  onReinforce,
}: RSIPStrictModeCardProps) {
  const { t } = useI18n();
  const phase: RSIPStabilityPhase = node.stabilityPhase ?? 'E0';
  const consecutiveExecutions = node.consecutiveExecutions ?? 0;
  const reinforcementLevel = node.reinforcementLevel ?? 0;

  const cardBgClass = CARD_BG_CLASS_BY_PHASE[phase];
  const hoverBorderClass = HOVER_BORDER_CLASS_BY_PHASE[phase];
  const depthShadowClass =
    descendantCount > 3
      ? 'shadow-md shadow-indigo-500/10 dark:shadow-indigo-500/10'
      : 'shadow-sm';

  return (
    <div
      className={`relative rounded-2xl border p-4 transition ${cardBgClass} ${depthShadowClass} hover:shadow-lg ${hoverBorderClass}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="group/title relative flex min-w-0 flex-1 items-center gap-2">
          <span className="flex-shrink-0 text-xl">{node.emoji || '🧭'}</span>
          <h3
            className="cursor-help break-words font-medium text-slate-900 dark:text-white"
            title={node.title}
          >
            {node.title}
          </h3>
          <div className="pointer-events-none invisible absolute left-0 top-full z-50 mt-1 max-w-xs break-words rounded-lg bg-gray-800 p-2 text-sm text-white opacity-0 shadow-xl transition group-hover/title:visible group-hover/title:opacity-100">
            {node.title}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {reinforcementLevel > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <Shield size={12} />+{reinforcementLevel}
            </span>
          )}
          <RSIPPhaseBadge phase={phase} />
        </div>
      </div>

      <p className="mb-4 break-words text-sm text-slate-700 dark:text-white/60">
        {node.rule}
      </p>

      <RSIPPhaseProgress
        phase={phase}
        consecutiveDays={consecutiveExecutions}
      />

      <div className="mt-3 border-t border-slate-200 pt-3 dark:border-white/10">
        <RSIPConstraintIndicator
          descendantCount={descendantCount}
          failureCost={failureCost}
        />
      </div>

      <div className="mt-4 flex gap-2">
        {onReinforce && phase === 'E2' && (
          <button
            type="button"
            onClick={onReinforce}
            className="cursor-pointer rounded-xl bg-amber-500/20 px-3 py-2.5 text-sm font-medium text-amber-700 transition hover:bg-amber-500/30 dark:text-amber-300 dark:hover:bg-amber-500/40"
          >
            {t('rsip.rsipStrictModeCard.reinforce')}
          </button>
        )}

        <button
          type="button"
          onClick={onMarkExecuted}
          className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 font-medium text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-emerald-500/20 dark:text-emerald-200 dark:shadow-none dark:hover:bg-emerald-500/30 dark:focus-visible:ring-emerald-500/60 dark:focus-visible:ring-offset-slate-950"
        >
          <Check size={18} />
          <span>{t('rsip.rsipStrictModeCard.executed')}</span>
        </button>

        <button
          type="button"
          onClick={onMarkViolated}
          className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 font-medium text-white shadow-sm transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-red-500/20 dark:text-red-200 dark:shadow-none dark:hover:bg-red-500/30 dark:focus-visible:ring-red-500/60 dark:focus-visible:ring-offset-slate-950"
        >
          <X size={18} />
          <span>{t('rsip.rsipStrictModeCard.violated')}</span>
        </button>
      </div>
    </div>
  );
}
