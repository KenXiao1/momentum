import type {
  RecommendationContext,
  RSIPRecommendation,
} from './rsipInsightsTypes';
import { translate } from '../../i18n/translate';
import { joinList } from './rsipLocalization';
import {
  buildRuralFirstRecommendation,
  buildSplitRecommendation,
} from './rsipHighRiskRecommenders';

function buildGroupingRecommendation(
  context: RecommendationContext,
): RSIPRecommendation | null {
  const ungroupedNodes = context.input.nodes.filter(
    (node) => !node.groupId,
  ).length;
  if (ungroupedNodes < 4 || context.input.groups.length > 0) {
    return null;
  }

  return {
    id: 'enable-groups',
    kind: 'grouping',
    priority: 'medium',
    title: translate(
      context.locale,
      'rsipInsights.recommendations.grouping.title',
    ),
    rationale: translate(
      context.locale,
      'rsipInsights.recommendations.grouping.rationale',
    ),
    actions: [
      translate(
        context.locale,
        'rsipInsights.recommendations.grouping.createGroups',
      ),
      translate(
        context.locale,
        'rsipInsights.recommendations.grouping.faultTolerance',
      ),
      translate(
        context.locale,
        'rsipInsights.recommendations.grouping.relatedNodes',
      ),
    ],
  };
}

function buildReinforcementRecommendation(
  context: RecommendationContext,
): RSIPRecommendation | null {
  const e2WithoutReinforcement = context.input.nodes.filter(
    (node) =>
      node.stabilityPhase === 'E2' && (node.reinforcementLevel ?? 0) === 0,
  );
  if (
    e2WithoutReinforcement.length === 0 ||
    (context.summary.successRate14d != null &&
      context.summary.successRate14d < 0.6)
  ) {
    return null;
  }

  return {
    id: 'reinforce-e2',
    kind: 'reinforcement',
    priority: 'medium',
    title: translate(
      context.locale,
      'rsipInsights.recommendations.reinforcement.title',
    ),
    rationale: translate(
      context.locale,
      'rsipInsights.recommendations.reinforcement.rationale',
    ),
    actions: [
      translate(
        context.locale,
        'rsipInsights.recommendations.reinforcement.prioritizeNodes',
        {
          nodes: joinList(
            e2WithoutReinforcement.slice(0, 3).map((node) => node.title),
            context.locale,
          ),
        },
      ),
      translate(
        context.locale,
        'rsipInsights.recommendations.reinforcement.weeklyLevel',
      ),
    ],
    relatedNodeIds: e2WithoutReinforcement.map((node) => node.id),
  };
}

function buildPassiveRecommendation(
  context: RecommendationContext,
): RSIPRecommendation | null {
  if (
    context.summary.passiveNodeRatio >= 0.2 ||
    context.summary.violationCount14d === 0
  ) {
    return null;
  }

  return {
    id: 'add-passive-guards',
    kind: 'passive',
    priority: 'medium',
    title: translate(
      context.locale,
      'rsipInsights.recommendations.passive.title',
    ),
    rationale: translate(
      context.locale,
      'rsipInsights.recommendations.passive.rationale',
    ),
    actions: [
      translate(
        context.locale,
        'rsipInsights.recommendations.passive.unstableBranches',
      ),
      translate(
        context.locale,
        'rsipInsights.recommendations.passive.preferAutomation',
      ),
      translate(
        context.locale,
        'rsipInsights.recommendations.passive.markNodes',
      ),
    ],
  };
}

function buildAutomationRecommendation(
  context: RecommendationContext,
): RSIPRecommendation | null {
  if (context.summary.linkCount !== 0) {
    return null;
  }

  return {
    id: 'configure-links',
    kind: 'automation',
    priority: 'low',
    title: translate(
      context.locale,
      'rsipInsights.recommendations.automation.title',
    ),
    rationale: translate(
      context.locale,
      'rsipInsights.recommendations.automation.rationale',
    ),
    actions: [
      translate(
        context.locale,
        'rsipInsights.recommendations.automation.startWithTaskCompleted',
      ),
      translate(
        context.locale,
        'rsipInsights.recommendations.automation.addPromptStartChain',
      ),
      translate(
        context.locale,
        'rsipInsights.recommendations.automation.keepConfirmMode',
      ),
    ],
  };
}

function buildRebuildRecommendation(
  context: RecommendationContext,
): RSIPRecommendation | null {
  if (
    context.trends.maxNodeTrend !== 'down' &&
    context.trends.runDurationTrend !== 'down'
  ) {
    return null;
  }

  return {
    id: 'rebuild-from-library',
    kind: 'rebuild',
    priority: 'medium',
    title: translate(
      context.locale,
      'rsipInsights.recommendations.rebuild.title',
    ),
    rationale: translate(
      context.locale,
      'rsipInsights.recommendations.rebuild.rationale',
    ),
    actions: [
      translate(
        context.locale,
        'rsipInsights.recommendations.rebuild.restoreLibraryEntries',
      ),
      translate(
        context.locale,
        'rsipInsights.recommendations.rebuild.limitNewHighRiskPolicies',
      ),
    ],
  };
}

export function buildRecommendations(
  context: RecommendationContext,
): RSIPRecommendation[] {
  return [
    buildRuralFirstRecommendation(context),
    buildSplitRecommendation(context),
    buildGroupingRecommendation(context),
    buildReinforcementRecommendation(context),
    buildPassiveRecommendation(context),
    buildAutomationRecommendation(context),
    buildRebuildRecommendation(context),
  ].filter((recommendation): recommendation is RSIPRecommendation =>
    Boolean(recommendation),
  );
}
