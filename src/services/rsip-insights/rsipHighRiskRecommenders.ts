import type {
  RecommendationContext,
  RSIPInsightsLocale,
  RSIPRecommendation,
} from './rsipInsightsTypes';
import { translate } from '../../i18n/translate';
import { joinList } from './rsipLocalization';

function fallbackAlternative(
  nodeTitle: string,
  locale: RSIPInsightsLocale,
): string {
  const lower = nodeTitle.toLowerCase();

  if (
    lower.includes('sleep') ||
    nodeTitle.includes('睡') ||
    nodeTitle.includes('作息')
  ) {
    return translate(locale, 'rsipInsights.recommendations.fallback.sleep');
  }

  if (
    lower.includes('exercise') ||
    lower.includes('workout') ||
    nodeTitle.includes('运动') ||
    nodeTitle.includes('锻炼')
  ) {
    return translate(locale, 'rsipInsights.recommendations.fallback.exercise');
  }

  if (
    lower.includes('diet') ||
    lower.includes('food') ||
    nodeTitle.includes('饮食') ||
    nodeTitle.includes('进食')
  ) {
    return translate(locale, 'rsipInsights.recommendations.fallback.diet');
  }

  return translate(locale, 'rsipInsights.recommendations.fallback.default');
}

export function buildRuralFirstRecommendation(
  context: RecommendationContext,
): RSIPRecommendation | null {
  const { highRiskNodes, locale, ruralFirstCandidates, trends } = context;
  if (highRiskNodes.length === 0 && trends.collapseFrequency14d < 2) {
    return null;
  }

  const primaryRisks = highRiskNodes.slice(0, 2);
  const candidateTitles = ruralFirstCandidates
    .slice(0, 3)
    .map((item) => item.title);

  return {
    id: 'rural-first-reboot',
    kind: 'rural_first',
    priority: 'high',
    title: translate(locale, 'rsipInsights.recommendations.ruralFirst.title'),
    rationale: translate(
      locale,
      'rsipInsights.recommendations.ruralFirst.rationale',
    ),
    actions: [
      primaryRisks.length > 0
        ? translate(
            locale,
            'rsipInsights.recommendations.ruralFirst.freezeNodes',
            {
              nodes: joinList(
                primaryRisks.map((node) => node.title),
                locale,
              ),
            },
          )
        : translate(
            locale,
            'rsipInsights.recommendations.ruralFirst.freezeUnstablePolicy',
          ),
      candidateTitles.length > 0
        ? translate(
            locale,
            'rsipInsights.recommendations.ruralFirst.prioritizeCandidates',
            { nodes: joinList(candidateTitles, locale) },
          )
        : translate(
            locale,
            'rsipInsights.recommendations.ruralFirst.promoteLowCostPolicies',
          ),
      ...primaryRisks.map(
        (node) => `${node.title}: ${fallbackAlternative(node.title, locale)}`,
      ),
    ],
    relatedNodeIds: primaryRisks.map((node) => node.nodeId),
  };
}

export function buildSplitRecommendation(
  context: RecommendationContext,
): RSIPRecommendation | null {
  const top = context.highRiskNodes[0];
  if (!top) {
    return null;
  }

  return {
    id: 'split-high-risk',
    kind: 'split',
    priority: 'high',
    title: translate(
      context.locale,
      'rsipInsights.recommendations.split.title',
      { title: top.title },
    ),
    rationale: translate(
      context.locale,
      'rsipInsights.recommendations.split.rationale',
    ),
    actions: [
      translate(
        context.locale,
        'rsipInsights.recommendations.split.microPolicies',
      ),
      translate(
        context.locale,
        'rsipInsights.recommendations.split.passiveGuardrail',
      ),
      translate(
        context.locale,
        'rsipInsights.recommendations.split.executionTime',
      ),
    ],
    relatedNodeIds: [top.nodeId],
  };
}
