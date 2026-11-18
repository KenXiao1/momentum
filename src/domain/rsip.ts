import type {
  RSIPMeta,
  RSIPNode,
  RSIPNodeGroup,
  RSIPStabilityPhase,
} from '../types';
import { getDescendantCount, getDescendantIds } from '../utils/rsipTree';

/** Consecutive daily executions needed to leave each phase. */
const PHASE_PROMOTION: Record<RSIPStabilityPhase, number> = {
  E0: 7,
  E1: 21,
  E2: Infinity,
};
const NEXT_PHASE: Record<RSIPStabilityPhase, RSIPStabilityPhase> = {
  E0: 'E1',
  E1: 'E2',
  E2: 'E2',
};
const PHASE_WEIGHT: Record<RSIPStabilityPhase, number> = {
  E0: 1,
  E1: 2,
  E2: 3,
};
/** A reinforced node costs this fraction of its normal failure cost. */
const REINFORCED_COST_FACTOR = 0.3;

function phaseOf(node: RSIPNode): RSIPStabilityPhase {
  return node.stabilityPhase ?? 'E0';
}

function hasExecutedToday(node: RSIPNode, now: Date): boolean {
  return node.lastExecutedAt?.toDateString() === now.toDateString();
}

/** The streak after executing at `now`: continues from yesterday, else restarts. */
function nextExecutionStreak(node: RSIPNode, now: Date): number {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    node.lastExecutedAt &&
    node.lastExecutedAt.toDateString() !== yesterday.toDateString()
  )
    return 1;
  return (node.consecutiveExecutions ?? 0) + 1;
}

/** Strict mode allows one new node per day; free mode allows any number. */
export function canCreateRSIPNodes(
  meta: RSIPMeta,
  nodes: RSIPNode[],
  count: number,
  now = new Date(),
): boolean {
  if (count === 0 || meta.allowMultiplePerDay) return true;
  const today = now.toDateString();
  return (
    count === 1 &&
    meta.lastAddedAt?.toDateString() !== today &&
    !nodes.some((node) => node.createdAt.toDateString() === today)
  );
}

/**
 * Records one daily execution: extends the streak, promotes E0→E1 at 7 and
 * E1→E2 at 21 consecutive days, and in E2 optionally adds a reinforcement.
 * Returns null when the node was already executed today.
 */
export function applyExecution(
  node: RSIPNode,
  now: Date,
  options: { reinforce?: boolean } = {},
): RSIPNode | null {
  if (hasExecutedToday(node, now)) return null;
  const consecutiveExecutions = nextExecutionStreak(node, now);
  const current = phaseOf(node);
  const promoted = consecutiveExecutions >= PHASE_PROMOTION[current];
  const stabilityPhase = promoted ? NEXT_PHASE[current] : current;
  const reinforced = stabilityPhase === 'E2' && options.reinforce === true;
  const reinforcementLevel =
    (node.reinforcementLevel ?? 0) + (reinforced ? 1 : 0);

  return {
    ...node,
    lastExecutedAt: now,
    consecutiveExecutions,
    consecutiveViolations: 0,
    totalExecutions: (node.totalExecutions ?? 0) + 1,
    cumulativeExecutionDays: (node.cumulativeExecutionDays ?? 0) + 1,
    stabilityPhase,
    phaseStartedAt: promoted ? now : node.phaseStartedAt,
    reinforcementLevel,
    maxReinforcementLevel: Math.max(
      node.maxReinforcementLevel ?? 0,
      reinforcementLevel,
    ),
  };
}

/** Adds reinforcement levels to an E2 node; other phases are unchanged. */
export function applyReinforcement(node: RSIPNode, levelDelta = 1): RSIPNode {
  if (phaseOf(node) !== 'E2') return node;
  const reinforcementLevel =
    (node.reinforcementLevel ?? 0) + Math.max(1, Math.floor(levelDelta));
  return {
    ...node,
    reinforcementLevel,
    maxReinforcementLevel: Math.max(
      node.maxReinforcementLevel ?? 0,
      reinforcementLevel,
    ),
  };
}

/**
 * A violation on a reinforced node consumes one level and keeps the node.
 * Returns null when the node has no reinforcement and must collapse.
 */
export function absorbViolation(node: RSIPNode, now: Date): RSIPNode | null {
  const level = node.reinforcementLevel ?? 0;
  if (level <= 0) return null;
  return {
    ...node,
    reinforcementLevel: level - 1,
    lastViolatedAt: now,
    consecutiveViolations: (node.consecutiveViolations ?? 0) + 1,
    totalViolations: (node.totalViolations ?? 0) + 1,
    consecutiveExecutions: 0,
  };
}

function addSubtree(
  removedIds: Set<string>,
  nodes: RSIPNode[],
  nodeId: string,
): void {
  removedIds.add(nodeId);
  for (const id of getDescendantIds(nodes, nodeId)) removedIds.add(id);
}

/**
 * Nodes removed by an unabsorbed violation: the node and its subtree, plus
 * every member subtree of a group whose fault tolerance the losses exceed,
 * repeated until no further group collapses.
 */
export function planRSIPViolation(
  nodeId: string,
  nodes: RSIPNode[],
  groups: RSIPNodeGroup[],
) {
  const removedIds = new Set([nodeId, ...getDescendantIds(nodes, nodeId)]);
  const collapsedGroupIds = new Set<string>();
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const group of groups) {
      if (collapsedGroupIds.has(group.id)) continue;
      const members = nodes.filter((node) => node.groupId === group.id);
      const losses = members.filter((node) => removedIds.has(node.id)).length;
      if (
        losses === 0 ||
        (group.faultToleranceUsed ?? 0) + losses <= group.faultTolerance
      )
        continue;
      collapsedGroupIds.add(group.id);
      for (const member of members) addSubtree(removedIds, nodes, member.id);
      expanded = true;
    }
  }
  const updatedGroups = groups.map((group) => {
    const losses = nodes.filter(
      (node) => node.groupId === group.id && removedIds.has(node.id),
    ).length;
    return losses
      ? {
          ...group,
          faultToleranceUsed: (group.faultToleranceUsed ?? 0) + losses,
        }
      : group;
  });
  return { removedIds, collapsedGroupIds, updatedGroups };
}

/** What losing this node would cost: subtree size weighted by phase. */
export function calculateConstraintPower(
  nodes: RSIPNode[],
  nodeId: string,
): { descendantCount: number; failureCost: number } {
  const node = nodes.find((item) => item.id === nodeId);
  if (!node) return { descendantCount: 0, failureCost: 0 };
  const descendantCount = getDescendantCount(nodes, nodeId);
  const factor =
    (node.reinforcementLevel ?? 0) > 0 ? REINFORCED_COST_FACTOR : 1;
  const failureCost =
    Math.round(
      (descendantCount + 1) * PHASE_WEIGHT[phaseOf(node)] * factor * 100,
    ) / 100;
  return { descendantCount, failureCost };
}

export function calculatePhaseDistribution(nodes: RSIPNode[]): {
  E0: number;
  E1: number;
  E2: number;
} {
  const distribution = { E0: 0, E1: 0, E2: 0 };
  for (const node of nodes) distribution[phaseOf(node)] += 1;
  return distribution;
}
