import { useI18n } from '../../i18n';
import type { RSIPInsightsResult } from '../../services/rsip-insights/rsipInsightsTypes';

interface RSIPInsightsPanelProps {
  insights: RSIPInsightsResult;
}

function priorityClass(priority: 'high' | 'medium' | 'low'): string {
  if (priority === 'high') {
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  }
  if (priority === 'medium') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

export function RSIPInsightsPanel({ insights }: RSIPInsightsPanelProps) {
  const { t } = useI18n();

  const toPercent = (value: number | null): string => {
    if (value == null) return t('rsip.rsipinsightsPanel.nA');
    return `${Math.round(value * 100)}%`;
  };

  const trendLabel = (
    value: 'up' | 'down' | 'flat' | 'insufficient_data',
  ): string => {
    if (value === 'up') return t('rsip.rsipinsightsPanel.up');
    if (value === 'down') return t('rsip.rsipinsightsPanel.down');
    if (value === 'flat') return t('rsip.rsipinsightsPanel.flat');
    return t('rsip.rsipinsightsPanel.insufficientData');
  };

  const priorityLabel = (value: 'high' | 'medium' | 'low'): string => {
    if (value === 'high') return t('rsip.rsipinsightsPanel.high');
    if (value === 'medium') return t('rsip.rsipinsightsPanel.medium');
    return t('rsip.rsipinsightsPanel.low');
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bento-card">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
            {t('rsip.rsipinsightsPanel.activePolicies')}
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-slate-100">
            {insights.summary.activeNodeCount}
          </p>
        </div>
        <div className="bento-card">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
            {t('rsip.rsipinsightsPanel.14dSuccessRate')}
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-slate-100">
            {toPercent(insights.summary.successRate14d)}
          </p>
        </div>
        <div className="bento-card">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
            {t('rsip.rsipinsightsPanel.passiveCoverage')}
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-slate-100">
            {toPercent(insights.summary.passiveNodeRatio)}
          </p>
        </div>
        <div className="bento-card">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
            {t('rsip.rsipinsightsPanel.reinforcementCoverage')}
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-slate-100">
            {toPercent(insights.summary.reinforcementCoverage)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="bento-card">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t('rsip.rsipinsightsPanel.maxNodeTrend')}
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-slate-100">
            {trendLabel(insights.trends.maxNodeTrend)}
          </p>
        </div>
        <div className="bento-card">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t('rsip.rsipinsightsPanel.runDurationTrend')}
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-slate-100">
            {trendLabel(insights.trends.runDurationTrend)}
          </p>
        </div>
        <div className="bento-card">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t('rsip.rsipinsightsPanel.collapsesIn14Days')}
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-slate-100">
            {insights.trends.collapseFrequency14d}
          </p>
        </div>
      </div>

      <div className="bento-card space-y-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
          {t('rsip.rsipinsightsPanel.ruralFirstCandidateQueue')}
        </h3>
        {insights.ruralFirstCandidates.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-slate-300">
            {t('rsip.rsipinsightsPanel.noLowCostCandidatesDetectedYet')}
          </p>
        ) : (
          <div className="space-y-2">
            {insights.ruralFirstCandidates.slice(0, 5).map((node) => (
              <div
                key={node.nodeId}
                className="rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/40"
              >
                <p className="font-medium text-gray-900 dark:text-slate-100">
                  {node.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {t('rsip.rsipinsightsPanel.failureCost')} {node.failureCost} |{' '}
                  {t('rsip.rsipinsightsPanel.violationRate')}{' '}
                  {toPercent(node.violationRate)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
          {t('rsip.rsipinsightsPanel.recommendationAssistant')}
        </h3>
        {insights.recommendations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600 dark:border-slate-700 dark:text-slate-300">
            {t(
              'rsip.rsipinsightsPanel.noRecommendationYetContinueExecutionToCollectMoreSignal',
            )}
          </div>
        ) : (
          insights.recommendations.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-gray-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/60"
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${priorityClass(item.priority)}`}
                >
                  {priorityLabel(item.priority)}
                </span>
                <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100">
                  {item.title}
                </h4>
              </div>
              <p className="mb-3 text-sm text-gray-600 dark:text-slate-300">
                {item.rationale}
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-slate-200">
                {item.actions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
