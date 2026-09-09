import {
  rsipTaskIntegrationService,
  type RSIPTaskEventPayload,
} from '../../../services/rsip-integration/RSIPTaskIntegrationService';
import type { RSIPNode, RSIPTaskLink } from '../../../types';
import { logger } from '../../../utils/logger';
import type { ReadState, SaveFns } from './types';

interface CreateTaskLinkOperationsParams {
  readState: ReadState;
  saveFns: Pick<SaveFns, 'saveTaskLinks'>;
  confirmTaskLink?: (link: RSIPTaskLink, node: RSIPNode) => Promise<boolean>;
  markExecuted: (
    nodeId: string,
    nodes: RSIPNode[],
    notes?: string,
    options?: {
      reinforce?: boolean;
      reasonCode?: string;
      repairHint?: string;
      sourceChainId?: string;
      sourceEvent?: string;
    },
  ) => Promise<RSIPNode[]>;
  markViolated: (
    nodeId: string,
    nodes: RSIPNode[],
    notes?: string,
    options?: {
      reasonCode?: string;
      repairHint?: string;
      sourceChainId?: string;
      sourceEvent?: string;
      collapseReason?: string;
    },
  ) => Promise<RSIPNode[]>;
}

export function createTaskLinkOperations({
  readState,
  saveFns,
  markExecuted,
  markViolated,
  confirmTaskLink,
}: CreateTaskLinkOperationsParams) {
  const upsertTaskLinks = async (links: RSIPTaskLink[]) => {
    const state = readState();
    const merged = rsipTaskIntegrationService.upsertLinks(
      state?.rsipTaskLinks ?? [],
      links,
    );
    await saveFns.saveTaskLinks(merged);
    return merged;
  };

  const handleTaskEventIntegration = async (
    payload: RSIPTaskEventPayload,
  ): Promise<RSIPNode[]> => {
    const state = readState();
    if (!state) {
      return [];
    }

    const matches = rsipTaskIntegrationService.matchTaskEventLinks(
      state.rsipTaskLinks ?? [],
      payload,
    );

    let latestNodes = state.rsipNodes;
    for (const match of matches) {
      if (match.deduped) {
        continue;
      }

      const targetNode = latestNodes.find(
        (node) => node.id === match.link.rsipNodeId,
      );
      if (!targetNode) {
        logger.warn('RSIP', 'RSIP integration skipped: target node missing', {
          event: payload.event,
          rsipNodeId: match.link.rsipNodeId,
          chainId: payload.chainId,
        });
        continue;
      }

      if (
        match.link.automation !== 'auto' &&
        !(await confirmTaskLink?.(match.link, targetNode))
      )
        continue;
      latestNodes = readState()?.rsipNodes ?? latestNodes;
      if (!latestNodes.some((node) => node.id === targetNode.id)) continue;

      if (match.link.effect === 'mark_rsip_executed') {
        latestNodes = await markExecuted(
          match.link.rsipNodeId,
          latestNodes,
          undefined,
          {
            sourceChainId: payload.chainId,
            sourceEvent: payload.event,
            reasonCode: 'integration_task_completed',
          },
        );
      } else if (match.link.effect === 'mark_rsip_violated') {
        latestNodes = await markViolated(
          match.link.rsipNodeId,
          latestNodes,
          undefined,
          {
            sourceChainId: payload.chainId,
            sourceEvent: payload.event,
            reasonCode: 'integration_task_interrupted',
          },
        );
      }
    }

    return latestNodes;
  };

  const getRsipTaskActions = (rsipNodeId: string): RSIPTaskLink[] => {
    const state = readState();
    return rsipTaskIntegrationService.getRsipToTaskLinks(
      state?.rsipTaskLinks ?? [],
      rsipNodeId,
    );
  };

  return {
    upsertTaskLinks,
    handleTaskEventIntegration,
    getRsipTaskActions,
  };
}
