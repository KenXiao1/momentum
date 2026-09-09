import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RSIPNode, RSIPTaskLink } from '../../../types';
import { logger } from '../../../utils/logger';
import type { RSIPViewProps } from '../../RSIPView.types';
import {
  assessViolationGroup,
  calculateConstraintPower as calculateConstraintPowerRule,
  createNodeFromLibraryEntry,
  getActiveExecutionTaskLinks,
  getViolationDescendants,
  markNodeExecutedFallback,
  markNodeViolatedFallback,
} from '../../../hooks/domains/rsip/viewInteractionRules';
import type {
  RSIPViewActionSlice,
  RSIPViewStateSlice,
  UseRSIPViewInteractionActionsParams,
} from './useRSIPViewModel.types';

function confirmLinkedTaskAction(params: {
  automation: RSIPTaskLink['automation'];
  language: string;
  targetChainName: string;
}) {
  if (params.automation === 'auto') {
    return true;
  }

  return window.confirm(
    params.language.startsWith('zh')
      ? `国策已执行，是否联动任务「${params.targetChainName}」？`
      : `Policy executed. Trigger linked task "${params.targetChainName}"?`,
  );
}

async function executeLinkedTaskEffect(params: {
  link: RSIPTaskLink;
  onStartChain?: RSIPViewProps['onStartChain'];
  onScheduleChain?: RSIPViewProps['onScheduleChain'];
}) {
  if (params.link.effect === 'prompt_start_chain' && params.onStartChain) {
    await params.onStartChain(params.link.chainId);
    return;
  }

  if (
    params.link.effect === 'prompt_schedule_chain' &&
    params.onScheduleChain
  ) {
    params.onScheduleChain(params.link.chainId);
  }
}

async function runLinkedTaskActions(params: {
  linkedActions: RSIPTaskLink[];
  chains: RSIPViewStateSlice['chains'];
  language: string;
  onStartChain?: RSIPViewProps['onStartChain'];
  onScheduleChain?: RSIPViewProps['onScheduleChain'];
}) {
  for (const link of params.linkedActions) {
    const targetChain = params.chains.find(
      (chain) => chain.id === link.chainId,
    );
    if (!targetChain) {
      logger.warn('RSIP', 'RSIP->task link skipped: missing target chain', {
        linkId: link.id,
        chainId: link.chainId,
      });
      continue;
    }

    if (
      !confirmLinkedTaskAction({
        automation: link.automation,
        language: params.language,
        targetChainName: targetChain.name,
      })
    ) {
      continue;
    }

    await executeLinkedTaskEffect({
      link,
      onStartChain: params.onStartChain,
      onScheduleChain: params.onScheduleChain,
    });
  }
}

export function useRSIPViewInteractionActions({
  state,
  props,
}: UseRSIPViewInteractionActionsParams): Pick<
  RSIPViewActionSlice,
  | 'handleMarkExecuted'
  | 'handleTaskLinkUpsert'
  | 'handleRestoreFromLibrary'
  | 'calculateConstraintPower'
  | 'openViolationDialog'
  | 'violationDialogNode'
  | 'violationDescendants'
  | 'violationGroupMessage'
  | 'handleConfirmViolation'
  | 'closeViolationDialog'
  | 'onSaveNodes'
  | 'onReinforceNode'
> {
  const { language, nodes, groups, taskLinks, chains } = state;
  const {
    policyLibrary = [],
    onSaveNodes,
    onSaveTaskLinks,
    onMarkExecuted,
    onMarkViolated,
    onReinforceNode,
    onRestoreFromLibrary,
    onUpsertTaskLinks,
    onGetTaskActions,
    onStartChain,
    onScheduleChain,
  } = props;

  const [violationDialogNode, setViolationDialogNode] =
    useState<RSIPNode | null>(null);
  const [violationGroupMessage, setViolationGroupMessage] = useState<string>();
  const executionPendingIdsRef = useRef(new Set<string>());
  const executionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestNodesRef = useRef(nodes);
  const violationSaveInFlightRef = useRef(false);
  const violationAttemptIdRef = useRef(0);

  useEffect(() => {
    latestNodesRef.current = nodes;
  }, [nodes]);

  const handleMarkExecuted = useCallback(
    (nodeId: string, reinforce = false) => {
      if (executionPendingIdsRef.current.has(nodeId)) {
        return Promise.resolve(latestNodesRef.current);
      }
      executionPendingIdsRef.current.add(nodeId);

      const execution = executionQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const currentNodes = latestNodesRef.current;
          let updatedNodes: RSIPNode[];
          if (onMarkExecuted) {
            updatedNodes = await onMarkExecuted(
              nodeId,
              currentNodes,
              undefined,
              { reinforce },
            );
          } else {
            updatedNodes = markNodeExecutedFallback(currentNodes, nodeId);
            await onSaveNodes(updatedNodes);
          }

          latestNodesRef.current = updatedNodes;
          const linkedActions =
            onGetTaskActions?.(nodeId) ??
            getActiveExecutionTaskLinks(nodeId, taskLinks);
          await runLinkedTaskActions({
            linkedActions,
            chains,
            language,
            onStartChain,
            onScheduleChain,
          });

          return updatedNodes;
        })
        .finally(() => {
          executionPendingIdsRef.current.delete(nodeId);
        });
      executionQueueRef.current = execution.then(
        () => undefined,
        () => undefined,
      );
      return execution;
    },
    [
      chains,
      language,
      onGetTaskActions,
      onMarkExecuted,
      onSaveNodes,
      onScheduleChain,
      onStartChain,
      taskLinks,
    ],
  );

  const openViolationDialog = useCallback(
    (node: RSIPNode) => {
      violationAttemptIdRef.current += 1;
      setViolationDialogNode(node);
      const assessment = assessViolationGroup(node, groups, nodes);
      if (assessment.status === 'none') {
        setViolationGroupMessage(undefined);
        return;
      }
      if (assessment.status === 'tolerated') {
        setViolationGroupMessage(
          language.startsWith('zh')
            ? `国策组「${assessment.groupTitle}」仍有容错余量，本次违反不会导致整组崩溃。`
            : `Group "${assessment.groupTitle}" still has tolerance remaining. This violation will not collapse the whole group.`,
        );
      } else {
        setViolationGroupMessage(
          language.startsWith('zh')
            ? `国策组「${assessment.groupTitle}」容错已耗尽，本次违反会触发整组崩溃。`
            : `Group "${assessment.groupTitle}" has exhausted tolerance. This violation will collapse the group.`,
        );
      }
    },
    [groups, language, nodes],
  );

  const closeViolationDialog = useCallback(() => {
    violationAttemptIdRef.current += 1;
    setViolationDialogNode(null);
    setViolationGroupMessage(undefined);
  }, []);

  const handleConfirmViolation = useCallback(
    async (payload: { reasonCode?: string; repairHint?: string }) => {
      if (!violationDialogNode) {
        return;
      }
      if (violationSaveInFlightRef.current) {
        return;
      }

      const attemptId = violationAttemptIdRef.current;
      violationSaveInFlightRef.current = true;
      try {
        if (onMarkViolated) {
          await onMarkViolated(violationDialogNode.id, nodes, undefined, {
            reasonCode: payload.reasonCode,
            repairHint: payload.repairHint,
            collapseReason: payload.reasonCode,
          });
        } else {
          await onSaveNodes(
            markNodeViolatedFallback(nodes, violationDialogNode.id),
          );
        }

        if (attemptId === violationAttemptIdRef.current) {
          closeViolationDialog();
        }
      } finally {
        violationSaveInFlightRef.current = false;
      }
    },
    [
      closeViolationDialog,
      nodes,
      onMarkViolated,
      onSaveNodes,
      violationDialogNode,
    ],
  );

  const handleRestoreFromLibrary = useCallback(
    async (entryId: string, parentId?: string) => {
      if (onRestoreFromLibrary) {
        await onRestoreFromLibrary(entryId, parentId);
        return;
      }

      const entry = policyLibrary.find((item) => item.id === entryId);
      if (!entry) {
        return;
      }

      await onSaveNodes([
        ...nodes,
        createNodeFromLibraryEntry(
          entry,
          parentId,
          crypto.randomUUID(),
          new Date(),
        ),
      ]);
    },
    [nodes, onRestoreFromLibrary, onSaveNodes, policyLibrary],
  );

  const handleTaskLinkUpsert = useCallback(
    async (nextLinks: RSIPTaskLink[]) => {
      if (onUpsertTaskLinks) {
        await onUpsertTaskLinks(nextLinks);
        return;
      }
      await onSaveTaskLinks?.(nextLinks);
    },
    [onSaveTaskLinks, onUpsertTaskLinks],
  );

  const calculateConstraintPower = useCallback(
    (nodeId: string) => calculateConstraintPowerRule(nodes, nodeId),
    [nodes],
  );

  const violationDescendants = useMemo(() => {
    if (!violationDialogNode) {
      return [];
    }

    return getViolationDescendants(nodes, violationDialogNode.id);
  }, [nodes, violationDialogNode]);

  return {
    handleMarkExecuted,
    handleTaskLinkUpsert,
    handleRestoreFromLibrary,
    calculateConstraintPower,
    openViolationDialog,
    violationDialogNode,
    violationDescendants,
    violationGroupMessage,
    handleConfirmViolation,
    closeViolationDialog,
    onSaveNodes,
    onReinforceNode,
  };
}
