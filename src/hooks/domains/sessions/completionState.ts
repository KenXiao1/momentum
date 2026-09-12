import type { AppState } from '../../../types';
import {
  incrementGroupCompletionCount,
  isGroupFullyCompleted,
} from '../../../utils/chainTree';
import { forwardTimerManager } from '../../../utils/forwardTimer';
import { logger } from '../../../utils/logger';
import { buildChainTree } from '../../../utils/chainTree';
import { notifyTaskCompleted } from './sessionNotifications';

type Chain = AppState['chains'][number];
type ActiveSession = NonNullable<AppState['activeSession']>;

export function computeActualDuration(
  activeSession: ActiveSession,
  chain: Chain,
): number {
  if (!chain.isDurationless) return activeSession.duration;

  const sessionId = `${activeSession.chainId}_${activeSession.startedAt.getTime()}`;
  const elapsedSeconds = forwardTimerManager.stopTimer(sessionId);
  return Math.ceil(elapsedSeconds / 60);
}

export function updateChainsForSuccess(
  chains: AppState['chains'],
  chainId: string,
  completedAt: Date,
): AppState['chains'] {
  return chains.map((chain) =>
    chain.id === chainId
      ? {
          ...chain,
          currentStreak: chain.currentStreak + 1,
          totalCompletions: chain.totalCompletions + 1,
          lastCompletedAt: completedAt,
        }
      : chain,
  );
}

export function updateChainsForFailure(
  chains: AppState['chains'],
  chainId: string,
): AppState['chains'] {
  return chains.map((chain) =>
    chain.id === chainId
      ? {
          ...chain,
          currentStreak: 0,
          totalFailures: chain.totalFailures + 1,
        }
      : chain,
  );
}

interface GroupCycleIncrementResult {
  updatedChains: AppState['chains'];
  completedGroupId?: string;
}

export function maybeIncrementGroupCycleCompletion(
  chains: AppState['chains'],
  completedChain: Chain,
  tr: (zh: string, en: string) => string,
): GroupCycleIncrementResult {
  if (!completedChain.parentId || completedChain.type === 'group') {
    return { updatedChains: chains };
  }

  const chainTree = buildChainTree(chains);
  const groupNode = chainTree.find(
    (node) => node.id === completedChain.parentId,
  );
  if (
    !groupNode ||
    groupNode.type !== 'group' ||
    !isGroupFullyCompleted(groupNode)
  ) {
    return { updatedChains: chains };
  }

  logger.debug(
    'SESSIONS',
    `任务群 ${groupNode.name} 已完成所有任务，增加完成计数`,
  );
  const updatedChains = incrementGroupCompletionCount(
    chains,
    completedChain.parentId,
  );
  const parentChain = updatedChains.find(
    (chain) => chain.id === completedChain.parentId,
  );

  if (parentChain) {
    notifyTaskCompleted(
      parentChain.name,
      parentChain.currentStreak,
      tr('任务群完成一轮', 'Group completed a cycle'),
    );
  }

  return {
    updatedChains,
    completedGroupId: completedChain.parentId,
  };
}
