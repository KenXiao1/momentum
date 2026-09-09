import type {
  RSIPLibraryEntry,
  RSIPMeta,
  RSIPNode,
  RSIPStabilityPhase,
} from '../../../types';
import { getDescendantCount } from '../../../utils/rsipTree';
import { buildExecutionRecord } from './helpers';
import { hasExecutedToday, nextExecutionStreak } from './dailyRules';
import { planRSIPViolation } from './violationPlan';
import type {
  MarkExecutionOptions,
  MarkViolationOptions,
  ReadState,
  SaveFns,
} from './types';

interface CreateNodeOperationsParams {
  readState: ReadState;
  saveFns: Pick<
    SaveFns,
    'appendExecutionRecord' | 'removeNodes' | 'upsertNode' | 'saveGroups'
  >;
  archiveToLibrary: (
    node: RSIPNode,
    existingLibrary?: RSIPLibraryEntry[],
  ) => Promise<RSIPLibraryEntry[]>;
  recordCollapse: (
    meta: RSIPMeta,
    reason?: string,
    nodeTitle?: string,
    maxNodeCount?: number,
  ) => Promise<RSIPMeta>;
}

async function ignoreLoggedPostCommitFailure(
  operation: Promise<unknown>,
): Promise<void> {
  try {
    await operation;
  } catch {
    return;
  }
}

export function createNodeOperations({
  readState,
  saveFns,
  archiveToLibrary,
  recordCollapse,
}: CreateNodeOperationsParams) {
  const reinforceNode = async (
    nodeId: string,
    nodes: RSIPNode[],
    levelDelta = 1,
  ): Promise<RSIPNode[]> => {
    const delta = Math.max(1, Math.floor(levelDelta));
    const updatedNodes = nodes.map((node) => {
      if (node.id !== nodeId) {
        return node;
      }
      if ((node.stabilityPhase ?? 'E0') !== 'E2') {
        return node;
      }

      const reinforcementLevel = (node.reinforcementLevel ?? 0) + delta;
      return {
        ...node,
        reinforcementLevel,
        maxReinforcementLevel: Math.max(
          node.maxReinforcementLevel ?? 0,
          reinforcementLevel,
        ),
      };
    });

    const updatedNode = updatedNodes.find((node) => node.id === nodeId);
    if (updatedNode) {
      await saveFns.upsertNode(updatedNode, updatedNodes);
    }
    return updatedNodes;
  };

  const markExecuted = async (
    nodeId: string,
    nodes: RSIPNode[],
    notes?: string,
    options?: MarkExecutionOptions,
  ): Promise<RSIPNode[]> => {
    const now = new Date();
    const target = nodes.find((node) => node.id === nodeId);
    if (!target || hasExecutedToday(target, now)) return nodes;
    const updatedNodes = nodes.map((node) => {
      if (node.id !== nodeId) {
        return node;
      }

      const consecutiveExecutions = nextExecutionStreak(node, now);
      const totalExecutions = (node.totalExecutions ?? 0) + 1;
      const cumulativeExecutionDays = (node.cumulativeExecutionDays ?? 0) + 1;

      let stabilityPhase: RSIPStabilityPhase = node.stabilityPhase ?? 'E0';
      let phaseStartedAt = node.phaseStartedAt;

      if (stabilityPhase === 'E0' && consecutiveExecutions >= 7) {
        stabilityPhase = 'E1';
        phaseStartedAt = now;
      } else if (stabilityPhase === 'E1' && consecutiveExecutions >= 21) {
        stabilityPhase = 'E2';
        phaseStartedAt = now;
      }

      let reinforcementLevel = node.reinforcementLevel ?? 0;
      let maxReinforcementLevel = node.maxReinforcementLevel ?? 0;
      if (stabilityPhase === 'E2' && options?.reinforce) {
        reinforcementLevel += 1;
        maxReinforcementLevel = Math.max(
          maxReinforcementLevel,
          reinforcementLevel,
        );
      }

      return {
        ...node,
        lastExecutedAt: now,
        consecutiveExecutions,
        consecutiveViolations: 0,
        totalExecutions,
        stabilityPhase,
        phaseStartedAt,
        cumulativeExecutionDays,
        reinforcementLevel,
        maxReinforcementLevel,
      };
    });

    const updatedNode = updatedNodes.find((node) => node.id === nodeId);
    if (updatedNode) {
      await saveFns.upsertNode(updatedNode, updatedNodes);
    }
    await ignoreLoggedPostCommitFailure(
      saveFns.appendExecutionRecord(
        buildExecutionRecord(nodeId, 'executed', notes, options),
      ),
    );
    return updatedNodes;
  };

  const markViolated = async (
    nodeId: string,
    nodes: RSIPNode[],
    notes?: string,
    options?: MarkViolationOptions,
  ): Promise<RSIPNode[]> => {
    const state = readState();
    const now = new Date();
    const targetNode = nodes.find((node) => node.id === nodeId);
    if (!targetNode) {
      return nodes;
    }

    const currentReinforcement = targetNode.reinforcementLevel ?? 0;
    if (currentReinforcement > 0) {
      const updatedNodes = nodes.map((node) => {
        if (node.id !== nodeId) {
          return node;
        }

        return {
          ...node,
          reinforcementLevel: Math.max(0, currentReinforcement - 1),
          lastViolatedAt: now,
          consecutiveViolations: (node.consecutiveViolations ?? 0) + 1,
          totalViolations: (node.totalViolations ?? 0) + 1,
          consecutiveExecutions: 0,
        };
      });

      const updatedNode = updatedNodes.find((node) => node.id === nodeId);
      if (updatedNode) {
        await saveFns.upsertNode(updatedNode, updatedNodes);
      }
      await ignoreLoggedPostCommitFailure(
        saveFns.appendExecutionRecord(
          buildExecutionRecord(nodeId, 'violated', notes, options),
        ),
      );
      return updatedNodes;
    }

    const groups = state?.rsipGroups ?? [];
    const { removedIds, collapsedGroupIds, updatedGroups } = planRSIPViolation(
      nodeId,
      nodes,
      groups,
    );
    const triggeredGroupCollapse = collapsedGroupIds.size > 0;

    const removedNodeIds = [...removedIds];
    const removedNodes = nodes.filter((node) => removedIds.has(node.id));
    const updatedNodes = nodes.filter((node) => !removedIds.has(node.id));

    let updatedLibrary = state?.rsipPolicyLibrary ?? [];
    for (const removedNode of removedNodes) {
      updatedLibrary = await archiveToLibrary(removedNode, updatedLibrary);
    }

    const groupsChanged = updatedGroups.some(
      (group, index) => group !== groups[index],
    );
    if (groupsChanged) await saveFns.saveGroups(updatedGroups);
    try {
      await saveFns.removeNodes(removedNodeIds, updatedNodes);
    } catch (error) {
      if (groupsChanged) await saveFns.saveGroups(groups);
      throw error;
    }
    await ignoreLoggedPostCommitFailure(
      saveFns.appendExecutionRecord(
        buildExecutionRecord(nodeId, 'violated', notes, options),
      ),
    );

    const collapsedRootNode = targetNode.parentId == null;
    const shouldRecordCollapse =
      triggeredGroupCollapse || collapsedRootNode || updatedNodes.length === 0;

    if (shouldRecordCollapse) {
      await ignoreLoggedPostCommitFailure(
        recordCollapse(
          state?.rsipMeta ?? {},
          options?.collapseReason ?? options?.reasonCode ?? notes,
          targetNode.title,
          nodes.length,
        ),
      );
    }

    return updatedNodes;
  };

  const calculateConstraintPower = (
    nodeId: string,
    nodes: RSIPNode[],
  ): { descendantCount: number; failureCost: number } => {
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
    const reinforcementMultiplier =
      (node.reinforcementLevel ?? 0) > 0 ? 0.3 : 1;
    const failureCost =
      Math.round(
        (descendantCount + 1) * weight * reinforcementMultiplier * 100,
      ) / 100;

    return { descendantCount, failureCost };
  };

  const calculatePhaseDistribution = (
    nodes: RSIPNode[],
  ): { E0: number; E1: number; E2: number } => {
    const distribution = { E0: 0, E1: 0, E2: 0 };
    for (const node of nodes) {
      const phase = node.stabilityPhase ?? 'E0';
      distribution[phase]++;
    }
    return distribution;
  };

  return {
    reinforceNode,
    markExecuted,
    markViolated,
    calculateConstraintPower,
    calculatePhaseDistribution,
  };
}
