import { useI18n } from '../../i18n';
import { AlertTriangle, GitBranch } from 'lucide-react';

interface RSIPConstraintIndicatorProps {
  descendantCount: number;
  failureCost: number;
}

export function RSIPConstraintIndicator({
  descendantCount,
  failureCost,
}: RSIPConstraintIndicatorProps) {
  const { t } = useI18n();
  let costColorClass = 'text-slate-600 dark:text-white/60';
  if (failureCost > 5) {
    costColorClass = 'text-rose-700 dark:text-red-300';
  } else if (failureCost > 2) {
    costColorClass = 'text-amber-700 dark:text-amber-300';
  }

  return (
    <div className="flex items-center gap-4 text-xs">
      <div className="flex items-center gap-1.5 text-slate-600 dark:text-white/60">
        <GitBranch size={14} />
        <span>
          {t('rsip.rsipConstraintIndicator.descendants', {
            count: descendantCount,
          })}
        </span>
      </div>

      <div className={`flex items-center gap-1.5 ${costColorClass}`}>
        <AlertTriangle size={14} />
        <span>
          {t('rsip.rsipConstraintIndicator.failureCost', { cost: failureCost })}
        </span>
      </div>
    </div>
  );
}
