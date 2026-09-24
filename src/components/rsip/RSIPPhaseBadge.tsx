import { useI18n } from '../../i18n';
import type { RSIPStabilityPhase } from '../../types';

interface RSIPPhaseBadgeProps {
  phase: RSIPStabilityPhase;
  size?: 'sm' | 'md';
}

const phaseConfig: Record<
  RSIPStabilityPhase,
  {
    className: string;
    icon: string;
  }
> = {
  E0: {
    className:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-gray-500/20 dark:text-gray-200 dark:border-gray-500/30',
    icon: '🧱',
  },
  E1: {
    className:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-200 dark:border-blue-500/30',
    icon: '🌱',
  },
  E2: {
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-500/30',
    icon: '🌲',
  },
};

export function RSIPPhaseBadge({ phase, size = 'md' }: RSIPPhaseBadgeProps) {
  const { t } = useI18n();
  const labels = {
    E0: t('rsip.rsipPhaseBadge.new'),
    E1: t('rsip.rsipPhaseBadge.stable'),
    E2: t('rsip.rsipPhaseBadge.internalized'),
  };
  const config = phaseConfig[phase];
  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-xs gap-1' : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <span
      className={`inline-flex flex-shrink-0 items-center whitespace-nowrap rounded-full border font-medium ${config.className} ${sizeClasses} `}
    >
      <span aria-hidden>{config.icon}</span>
      <span>{labels[phase]}</span>
    </span>
  );
}
