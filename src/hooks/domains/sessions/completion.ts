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
import { toast } from '../../../utils/toast';
import type { SessionCompletionInput } from '../../../storage/operations';
import {
  computeActualDuration,
  maybeIncrementGroupCycleCompletion,
  updateChainsForFailure,
  updateChainsForSuccess,
} from './completionState';

const inFlight = new WeakMap<MomentumStorage, Map<string, Promise<boolean>>>();

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
  activeSessionId,
  setActiveSessionId,
  onNavigateToDashboard,
  onPetTaskCompleted,
  onTaskLifecycleEvent,
  tr,
}: CreateCompletionHandlersParams) {
  const readState = resolveAppStateReader({ state, getState });

  function commit(
    input: SessionCompletionInput,
    publish: (
      result: Awaited<ReturnType<MomentumStorage['commitSessionCompletion']>>,
    ) => void,
  ): Promise<boolean> {
    const operations =
      inFlight.get(storage) ?? new Map<string, Promise<boolean>>();
    inFlight.set(storage, operations);
    const pending = operations.get(input.operationId);
    if (pending) return pending;
    const promise = storage
      .commitSessionCompletion(input)
      .then(
        (result) => {
          const matchesCompletedSession = (
            session: AppState['activeSession'],
          ) =>
            session?.chainId === input.session.chainId &&
            session.startedAt.getTime() === input.session.startedAt.getTime();
          const finishingCurrentSession = matchesCompletedSession(
            readState().activeSession,
          );
          setState((previous) => ({
            ...previous,
            chains: result.chains,
            activeSession: matchesCompletedSession(previous.activeSession)
              ? null
              : previous.activeSession,
            completionHistory: [
              ...previous.completionHistory.filter(
                (item) =>
                  item.chainId !== result.record.chainId ||
                  item.completedAt.getTime() !==
                    result.record.completedAt.getTime(),
              ),
              result.record,
            ],
          }));
          for (const effect of [
            () => {
              if (finishingCurrentSession) setActiveSessionId(null);
            },
            () => publish(result),
            () => {
              if (finishingCurrentSession) onNavigateToDashboard?.();
            },
          ]) {
            try {
              effect();
            } catch (error) {
              logger.error(
                'SESSIONS',
                'Post-commit notification failed',
                undefined,
                normalizeUnknownError(error),
              );
            }
          }
          return true;
        },
        (error: unknown) => {
          logger.error(
            'SESSIONS',
            'Session commit failed; the task remains available for retry',
            { operationId: input.operationId },
            normalizeUnknownError(error),
          );
          toast.error(
            tr(
              '保存尚未确认，请重试完成操作；任务已保留。',
              'Save is not confirmed. Your task is retained; retry completion.',
            ),
            { durationMs: 12000 },
          );
          return false;
        },
      )
      .finally(() => operations.delete(input.operationId));
    operations.set(input.operationId, promise);
    return promise;
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

    let completionRecord: CompletionHistory = {
      chainId: chain.id,
      completedAt,
      duration: activeSession.duration,
      wasSuccessful: true,
      actualDuration,
      isForwardTimed: Boolean(chain.isDurationless),
      description,
      notes,
    };

    let updatedChains = updateChainsForSuccess(
      currentState.chains,
      chain.id,
      completedAt,
    );
    const groupCycleResult = maybeIncrementGroupCycleCompletion(
      updatedChains,
      chain,
      tr,
      false,
    );
    updatedChains = groupCycleResult.updatedChains;

    return commit(
      {
        operationId: `session:${chain.id}:${activeSession.startedAt.toISOString()}`,
        session: activeSession,
        sessionId: activeSessionId,
        expectedChains: currentState.chains,
        chains: updatedChains,
        record: completionRecord,
      },
      (persisted) => {
        updatedChains = persisted.chains;
        completionRecord = persisted.record;
        if (chain.isDurationless)
          forwardTimerManager.clearTimer(
            `${chain.id}_${activeSession.startedAt.getTime()}`,
          );
        if (hasStorageCapability(storage, 'betting')) emitPointsChanged();
        notifyTaskCompleted(chain.name, newStreak);
        if (groupCycleResult.completedGroupId) {
          const group = updatedChains.find(
            (item) => item.id === groupCycleResult.completedGroupId,
          );
          if (group)
            notifyTaskCompleted(
              group.name,
              group.currentStreak,
              tr('任务群完成一轮', 'Group completed a cycle'),
            );
        }

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

        if (onPetTaskCompleted && completionRecord.actualDuration) {
          onPetTaskCompleted(completionRecord.actualDuration, true);
        }

        onTaskLifecycleEvent?.({
          type: 'task_completed',
          chainId: chain.id,
          chainKind: chain.type === 'group' ? 'group' : 'unit',
          occurredAt: completionRecord.completedAt,
        });

        if (groupCycleResult.completedGroupId) {
          onTaskLifecycleEvent?.({
            type: 'group_cycle_completed',
            chainId: groupCycleResult.completedGroupId,
            chainKind: 'group',
            occurredAt: completionRecord.completedAt,
          });
        }
      },
    );
  };

  const handleInterruptSession = (reason?: string) => {
    const currentState = readState();
    const activeSession = currentState.activeSession;
    if (!activeSession) return;

    const chain = currentState.chains.find(
      (item) => item.id === activeSession.chainId,
    );
    if (!chain) return;

    let completionRecord: CompletionHistory = {
      chainId: chain.id,
      completedAt: new Date(),
      duration: activeSession.duration,
      wasSuccessful: false,
      reasonForFailure: reason || '用户主动中断',
      actualDuration: activeSession.duration,
      isForwardTimed: Boolean(chain.isDurationless),
    };

    let updatedChains = updateChainsForFailure(currentState.chains, chain.id);
    if (chain.parentId && chain.type !== 'group') {
      logger.debug(
        'SESSIONS',
        `任务 ${chain.name} 失败/中断，重置任务群完成计数`,
      );
      updatedChains = resetGroupCompletionCount(updatedChains, chain.parentId);
    }

    return commit(
      {
        operationId: `session:${chain.id}:${activeSession.startedAt.toISOString()}`,
        session: activeSession,
        sessionId: activeSessionId,
        expectedChains: currentState.chains,
        chains: updatedChains,
        record: completionRecord,
      },
      (persisted) => {
        updatedChains = persisted.chains;
        completionRecord = persisted.record;
        if (chain.isDurationless)
          forwardTimerManager.clearTimer(
            `${chain.id}_${activeSession.startedAt.getTime()}`,
          );
        if (hasStorageCapability(storage, 'betting')) emitPointsChanged();

        onTaskLifecycleEvent?.({
          type: 'task_interrupted',
          chainId: chain.id,
          chainKind: chain.type === 'group' ? 'group' : 'unit',
          occurredAt: completionRecord.completedAt,
        });
      },
    );
  };

  return { handleCompleteSession, handleInterruptSession };
}
