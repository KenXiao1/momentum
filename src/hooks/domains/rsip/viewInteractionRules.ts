import type {
  RSIPLibraryEntry,
  RSIPNode,
  RSIPNodeGroup,
  RSIPStabilityPhase,
  RSIPTaskLink,
} from '../../../types';
import { getDescendantCount, getDescendantIds } from '../../../utils/rsipTree';
import { planRSIPViolation } from './violationPlan';
import { hasExecutedToday, nextExecutionStreak } from './dailyRules';

type ViolationGroupAssessment =
  | { status: 'none' }
  | { status: 'tolerated' | 'collapse'; groupTitle: string };

export function getActiveExecutionTaskLinks(
  nodeId: string,
  taskLinks: RSIPTaskLink[],
): RSIPTaskLink[] {
  return taskLinks.filter(
    (link) =>
      link.rsipNodeId === nodeId &&
      link.triggerEvent === 'rsip_mark_executed' &&
      link.isActive,
  );
}

export function assessViolationGroup(
  node: RSIPNode,
  groups: RSIPNodeGroup[],
  nodes: RSIPNode[] = [node],
): ViolationGroupAssessment {
  const group = groups.find((item) => item.id === node.groupId);
  if (!group || (node.reinforcementLevel ?? 0) > 0) {
    return { status: 'none' };
  }

  return {
    status: planRSIPViolation(node.id, nodes, groups).collapsedGroupIds.has(
      group.id,
    )
      ? 'collapse'
      : 'tolerated',
    groupTitle: group.title,
  };
}

export function createNodeFromLibraryEntry(
  entry: RSIPLibraryEntry,
  parentId: string | undefined,
  id: string,
  createdAt: Date,
): RSIPNode {
  return {
    id,
    parentId,
    title: entry.title,
    rule: entry.rule,
    sortOrder: Math.floor(createdAt.getTime() / 1000),
    createdAt,
    useTimer: entry.useTimer,
    timerMinutes: entry.timerMinutes,
    emoji: entry.emoji,
    type: entry.type,
    isPassive: entry.isPassive,
    cumulativeExecutionDays: entry.cumulativeExecutionDays,
  };
}

export function calculateConstraintPower(
  nodes: RSIPNode[],
  nodeId: string,
): { descendantCount: number; failureCost: number } {
  const node = nodes.find((item) => item.id === nodeId);
  if (!node) {
    return { descendantCount: 0, failureCost: 0 };
  }

  const descendantCount = getDescendantCount(nodes, nodeId);
  const phaseWeight: Record<RSIPStabilityPhase, number> = {
    E0: 1,
    E1: 2,
    E2: 3,
  };
  const weight = phaseWeight[node.stabilityPhase ?? 'E0'];
  const reinforcementMultiplier = (node.reinforcementLevel ?? 0) > 0 ? 0.3 : 1;
  const failureCost =
    Math.round((descendantCount + 1) * weight * reinforcementMultiplier * 100) /
    100;

  return { descendantCount, failureCost };
}

export function getViolationDescendants(
  nodes: RSIPNode[],
  nodeId: string,
): RSIPNode[] {
  const descendantIds = new Set(getDescendantIds(nodes, nodeId));
  return nodes.filter((node) => descendantIds.has(node.id));
}

export function markNodeExecutedFallback(
  nodes: RSIPNode[],
  nodeId: string,
  now = new Date(),
): RSIPNode[] {
  return nodes.map((node) => {
    if (node.id !== nodeId || hasExecutedToday(node, now)) {
      return node;
    }

    const consecutiveExecutions = nextExecutionStreak(node, now);
    const stabilityPhase = getNextStabilityPhase(
      node.stabilityPhase ?? 'E0',
      consecutiveExecutions,
    );

    return {
      ...node,
      stabilityPhase,
      phaseStartedAt:
        stabilityPhase === (node.stabilityPhase ?? 'E0')
          ? node.phaseStartedAt
          : now,
      cumulativeExecutionDays: (node.cumulativeExecutionDays ?? 0) + 1,
      consecutiveExecutions,
      consecutiveViolations: 0,
      totalExecutions: (node.totalExecutions ?? 0) + 1,
      lastExecutedAt: now,
    };
  });
}

function getNextStabilityPhase(
  phase: RSIPStabilityPhase,
  consecutiveExecutions: number,
): RSIPStabilityPhase {
  if (phase === 'E0') {
    return consecutiveExecutions >= 7 ? 'E1' : 'E0';
  }
  if (phase === 'E1') {
    return consecutiveExecutions >= 21 ? 'E2' : 'E1';
  }
  return 'E2';
}

export function markNodeViolatedFallback(
  nodes: RSIPNode[],
  nodeId: string,
): RSIPNode[] {
  const idsToDelete = new Set([nodeId, ...getDescendantIds(nodes, nodeId)]);
  return nodes.filter((node) => !idsToDelete.has(node.id));
}
