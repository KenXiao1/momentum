import type { Dispatch, SetStateAction } from 'react';
import type { AppState, TaskLifecycleEvent } from '../../../types';
import type { MomentumStorage } from '../../../storage/MomentumStorage';
import type { SafelySaveChains } from '../useChainsDomain';
import {
  getNextUnitInGroup,
  incrementGroupCompletionCount,
} from '../../../utils/chainTree';
import { logger } from '../../../utils/logger';
import { buildChainTree } from '../../../utils/chainTree';
import {
  isGroupExpired,
  resetGroupProgress,
  startGroupTimer,
} from '../../../utils/timeLimit';
import { normalizeUnknownError } from '../../../utils/errors/normalizeError';
import { notifyTaskCompleted, notifyTaskFailed } from './sessionNotifications';

type Chain = AppState['chains'][number];

function findFirstUnitInGroup(chains: AppState['chains'], groupId: string) {
  const groupNode = buildChainTree(chains).find((node) => node.id === groupId);
  return groupNode ? getNextUnitInGroup(groupNode) : null;
}

interface CreateGroupStartFlowParams {
  readState: () => AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  storage: MomentumStorage;
  safelySaveChains: SafelySaveChains;
  startChain: (chainId: string) => Promise<void>;
  onTaskLifecycleEvent?: (event: TaskLifecycleEvent) => void;
  tr: (zh: string, en: string) => string;
}

export function createGroupStartFlow({
  readState,
  setState,
  storage,
  safelySaveChains,
  startChain,
  onTaskLifecycleEvent,
  tr,
}: CreateGroupStartFlowParams) {
  function replaceGroup(groupId: string, update: (chain: Chain) => Chain) {
    const updatedChains = readState().chains.map((chain) =>
      chain.id === groupId ? update(chain) : chain,
    );
    setState((prev) => ({
      ...prev,
      chains: updatedChains,
    }));
  }

  function resetExpiredGroup(group: Chain): void {
    replaceGroup(group.id, resetGroupProgress);
    notifyTaskFailed(group.name, tr('任务群已超时', 'Group has expired'));
  }

  function scheduleNextCycle(params: {
    groupId: string;
    groupName: string;
    nextCycleNumber: number;
  }): void {
    setTimeout(() => {
      storage
        .getActiveChains()
        .then((freshChains) => {
          const firstUnit = findFirstUnitInGroup(freshChains, params.groupId);
          if (!firstUnit) return;

          logger.debug(
            'SESSIONS',
            `任务群 ${params.groupName} 开始新一轮（第${params.nextCycleNumber}轮），从 ${firstUnit.name} 开始`,
          );
          return startChain(firstUnit.id);
        })
        .catch((error) => {
          logger.error(
            'SESSIONS',
            'Failed to start next cycle first unit',
            { chainId: params.groupId },
            normalizeUnknownError(error),
          );
        });
    }, 100);
  }

  async function completeGroupCycle(group: Chain): Promise<void> {
    logger.debug(
      'SESSIONS',
      `任务群 ${group.name} 所有子任务已完成，开始新一轮循环`,
    );
    const updatedChains = incrementGroupCompletionCount(
      readState().chains,
      group.id,
    );
    const updatedGroup = updatedChains.find((chain) => chain.id === group.id);

    if (updatedGroup) {
      notifyTaskCompleted(
        updatedGroup.name,
        updatedGroup.totalCompletions,
        tr(
          `第${updatedGroup.totalCompletions}轮已完成，正在开始第${updatedGroup.totalCompletions + 1}轮`,
          `Cycle ${updatedGroup.totalCompletions} completed. Starting cycle ${updatedGroup.totalCompletions + 1}.`,
        ),
      );
    }

    try {
      await safelySaveChains(updatedChains);
      setState((prev) => ({
        ...prev,
        chains: updatedChains,
      }));
      onTaskLifecycleEvent?.({
        type: 'group_cycle_completed',
        chainId: group.id,
        chainKind: 'group',
        occurredAt: new Date(),
      });
      scheduleNextCycle({
        groupId: group.id,
        groupName: group.name,
        nextCycleNumber: (updatedGroup?.totalCompletions ?? 0) + 1,
      });
    } catch (error) {
      logger.error(
        'SESSIONS',
        '保存任务群完成计数失败',
        undefined,
        normalizeUnknownError(error),
      );
    }
  }

  return async function startGroupChain(group: Chain): Promise<void> {
    if (isGroupExpired(group)) {
      resetExpiredGroup(group);
      return;
    }
    if (group.timeLimitHours && !group.groupStartedAt) {
      replaceGroup(group.id, startGroupTimer);
    }

    const state = readState();
    const groupNode = buildChainTree(state.chains).find(
      (node) => node.id === group.id,
    );
    if (!groupNode) {
      logger.error('SESSIONS', '无法找到任务群节点', { chainId: group.id });
      return;
    }

    const nextUnit = getNextUnitInGroup(groupNode);
    if (nextUnit) {
      logger.debug(
        'SESSIONS',
        `任务群 ${group.name} 开始下一个任务 ${nextUnit.name}`,
      );
      await startChain(nextUnit.id);
      return;
    }
    await completeGroupCycle(group);
  };
}
