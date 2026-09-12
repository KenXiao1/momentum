import type { Dispatch, SetStateAction } from 'react';
import type { AppState, CompletionHistory } from '../../../types';
import type { MomentumStorage } from '../../../storage/MomentumStorage';
import { hasStorageCapability } from '../../../storage/ports';
import type { SafelySaveChains } from '../useChainsDomain';
import { resolveAppStateReader } from '../appStateAccess';
import { resetGroupCompletionCount } from '../../../utils/chainTree';
import { forwardTimerManager } from '../../../utils/forwardTimer';
import { logger } from '../../../utils/logger';
import { emitPointsChanged } from '../../../utils/pointsEvents';
import { normalizeUnknownError } from '../../../utils/errors/normalizeError';
import type { TaskLifecycleEvent } from '../../../types';
import { notifyTaskCompleted } from './sessionNotifications';
import {
  computeActualDuration,
  maybeIncrementGroupCycleCompletion,
  updateChainsForFailure,
  updateChainsForSuccess,
} from './completionState';

async function persistCompletionHistoryAndCleanupSupabase(
  storage: MomentumStorage,
  record: CompletionHistory,
  setActiveSessionId: (sessionId: string | null) => void,
  context: 'completion' | 'interrupt',
): Promise<void> {
  try {
    await storage.appendCompletionHistory(record);
  } catch (error) {
    logger.error(
      'SESSIONS',
      `Failed to persist completion history after ${context}`,
      undefined,
      normalizeUnknownError(error),
    );
  } finally {
    setActiveSessionId(null);
    try {
      await storage.saveActiveSession(null);
    } catch (error) {
      logger.error(
        'SESSIONS',
        `Failed to clear active session after ${context}`,
        undefined,
        normalizeUnknownError(error),
      );
    } finally {
      emitPointsChanged();
    }
  }
}

interface CreateCompletionHandlersParams {
  state?: AppState;
  getState?: () => AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  storage: MomentumStorage;
  safelySaveChains: SafelySaveChains;
  activeSessionId: string | null;
  setActiveSessionId: (sessionId: string | null) => void;
  onNavigateToDashboard?: () => void;
  onPetTaskCompleted?: (duration: number, wasSuccessful: boolean) => void;
  onTaskLifecycleEvent?: (event: TaskLifecycleEvent) => void;
  tr: (zh: string, en: string) => string;
}

export function createCompletionHandlers({
  state,
  getState,
  setState,
  storage,
  safelySaveChains,
  activeSessionId,
  setActiveSessionId,
  onNavigateToDashboard,
  onPetTaskCompleted,
  onTaskLifecycleEvent,
  tr,
}: CreateCompletionHandlersParams) {
  const readState = resolveAppStateReader({ state, getState });

  function persistChains(
    updatedChains: AppState['chains'],
    context: string,
  ): void {
    safelySaveChains(updatedChains).catch((error) => {
      logger.error(
        'SESSIONS',
        context,
        undefined,
        normalizeUnknownError(error),
      );
    });
  }

  function persistCompletionHistoryAndCleanup(
    record: CompletionHistory,
    context: 'completion' | 'interrupt',
  ): void {
    if (activeSessionId && hasStorageCapability(storage, 'betting')) {
      persistCompletionHistoryAndCleanupSupabase(
        storage,
        record,
        setActiveSessionId,
        context,
      ).catch((error) => {
        logger.error(
          'SESSIONS',
          `Unexpected ${context} cleanup error`,
          undefined,
          normalizeUnknownError(error),
        );
      });
      return;
    }

    setActiveSessionId(null);

    storage.saveActiveSession(null).catch((error) => {
      logger.error(
        'SESSIONS',
        `Failed to clear active session after ${context}`,
        undefined,
        normalizeUnknownError(error),
      );
    });

    storage.appendCompletionHistory(record).catch((error) => {
      logger.error(
        'SESSIONS',
        `Failed to persist completion history after ${context}`,
        undefined,
        normalizeUnknownError(error),
      );
    });
  }

  const handleCompleteSession = (description?: string, notes?: string) => {
    const currentState = readState();
    const activeSession = currentState.activeSession;
    if (!activeSession) return;

    const chain = currentState.chains.find(
      (item) => item.id === activeSession.chainId,
    );
    if (!chain) return;

    const actualDuration = computeActualDuration(activeSession, chain);

    const completedAt = new Date();
    const newStreak = chain.currentStreak + 1;
    notifyTaskCompleted(chain.name, newStreak);

    const completionRecord: CompletionHistory = {
      chainId: chain.id,
      completedAt,
      duration: activeSession.duration,
      wasSuccessful: true,
      actualDuration,
      isForwardTimed: Boolean(chain.isDurationless),
      description,
      notes,
    };

    const updatedHistory = [
      ...currentState.completionHistory,
      completionRecord,
    ];

    let updatedChains = updateChainsForSuccess(
      currentState.chains,
      chain.id,
      completedAt,
    );
    const groupCycleResult = maybeIncrementGroupCycleCompletion(
      updatedChains,
      chain,
      tr,
    );
    updatedChains = groupCycleResult.updatedChains;

    persistChains(updatedChains, '完成任务时保存链条数据失败');
    persistCompletionHistoryAndCleanup(completionRecord, 'completion');

    if (completionRecord.actualDuration) {
      storage
        .updateTaskTimeStats(chain.id, completionRecord.actualDuration)
        .catch((error) => {
          logger.error(
            'SESSIONS',
            'Failed to update task time stats after completion',
            { chainId: chain.id },
            normalizeUnknownError(error),
          );
        });
    }

    if (onPetTaskCompleted && actualDuration) {
      onPetTaskCompleted(actualDuration, true);
    }

    onTaskLifecycleEvent?.({
      type: 'task_completed',
      chainId: chain.id,
      chainKind: chain.type === 'group' ? 'group' : 'unit',
      occurredAt: completedAt,
    });

    if (groupCycleResult.completedGroupId) {
      onTaskLifecycleEvent?.({
        type: 'group_cycle_completed',
        chainId: groupCycleResult.completedGroupId,
        chainKind: 'group',
        occurredAt: completedAt,
      });
    }

    setState((prev) => ({
      ...prev,
      chains: updatedChains,
      activeSession: null,
      completionHistory: updatedHistory,
    }));
    onNavigateToDashboard?.();
  };

  const handleInterruptSession = (reason?: string) => {
    const currentState = readState();
    const activeSession = currentState.activeSession;
    if (!activeSession) return;

    const chain = currentState.chains.find(
      (item) => item.id === activeSession.chainId,
    );
    if (!chain) return;

    if (chain.isDurationless) {
      const sessionId = `${activeSession.chainId}_${activeSession.startedAt.getTime()}`;
      forwardTimerManager.clearTimer(sessionId);
    }

    const completionRecord: CompletionHistory = {
      chainId: chain.id,
      completedAt: new Date(),
      duration: activeSession.duration,
      wasSuccessful: false,
      reasonForFailure: reason || '用户主动中断',
      actualDuration: activeSession.duration,
      isForwardTimed: Boolean(chain.isDurationless),
    };

    const updatedHistory = [
      ...currentState.completionHistory,
      completionRecord,
    ];

    let updatedChains = updateChainsForFailure(currentState.chains, chain.id);
    if (chain.parentId && chain.type !== 'group') {
      logger.debug(
        'SESSIONS',
        `任务 ${chain.name} 失败/中断，重置任务群完成计数`,
      );
      updatedChains = resetGroupCompletionCount(updatedChains, chain.parentId);
    }

    persistChains(updatedChains, '中断任务时保存链条数据失败');
    persistCompletionHistoryAndCleanup(completionRecord, 'interrupt');

    onTaskLifecycleEvent?.({
      type: 'task_interrupted',
      chainId: chain.id,
      chainKind: chain.type === 'group' ? 'group' : 'unit',
      occurredAt: completionRecord.completedAt,
    });

    setState((prev) => ({
      ...prev,
      chains: updatedChains,
      activeSession: null,
      completionHistory: updatedHistory,
    }));
    onNavigateToDashboard?.();
  };

  return { handleCompleteSession, handleInterruptSession };
}
