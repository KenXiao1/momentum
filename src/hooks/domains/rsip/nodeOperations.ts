import type { RSIPLibraryEntry, RSIPMeta, RSIPNode } from '../../../types';
import {
  absorbViolation,
  applyExecution,
  applyReinforcement,
  calculateConstraintPower,
  calculatePhaseDistribution,
  planRSIPViolation,
} from '../../../domain/rsip';
import { buildExecutionRecord } from './helpers';
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
  const replaceNode = async (
    nodes: RSIPNode[],
    updated: RSIPNode,
  ): Promise<RSIPNode[]> => {
    const updatedNodes = nodes.map((node) =>
      node.id === updated.id ? updated : node,
    );
    await saveFns.upsertNode(updated, updatedNodes);
    return updatedNodes;
  };

  const reinforceNode = async (
    nodeId: string,
    nodes: RSIPNode[],
    levelDelta = 1,
  ): Promise<RSIPNode[]> => {
    const target = nodes.find((node) => node.id === nodeId);
    if (!target) return nodes;
    const updated = applyReinforcement(target, levelDelta);
    if (updated === target) return nodes;
    return replaceNode(nodes, updated);
  };

  const markExecuted = async (
    nodeId: string,
    nodes: RSIPNode[],
    notes?: string,
    options?: MarkExecutionOptions,
  ): Promise<RSIPNode[]> => {
    const target = nodes.find((node) => node.id === nodeId);
    const updated = target && applyExecution(target, new Date(), options);
    if (!updated) return nodes;
    const updatedNodes = await replaceNode(nodes, updated);
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

    const absorbed = absorbViolation(targetNode, now);
    if (absorbed) {
      const updatedNodes = await replaceNode(nodes, absorbed);
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

  return {
    reinforceNode,
    markExecuted,
    markViolated,
    calculateConstraintPower: (nodeId: string, nodes: RSIPNode[]) =>
      calculateConstraintPower(nodes, nodeId),
    calculatePhaseDistribution,
  };
}
