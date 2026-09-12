import type { Dispatch, SetStateAction } from 'react';
import type { AppState, ScheduledSession } from '../../../types';
import type { MomentumStorage } from '../../../storage/MomentumStorage';
import type { SafelySaveChains } from '../useChainsDomain';
import { resolveAppStateReader } from '../appStateAccess';
import { logger } from '../../../utils/logger';
import { toast } from '../../../utils/toast';
import { normalizeUnknownError } from '../../../utils/errors/normalizeError';
import { isSessionExpired } from '../../../utils/time';
import { notifyTaskCompleted } from './sessionNotifications';

interface CreateSchedulingHandlersParams {
  state?: AppState;
  getState?: () => AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  storage: MomentumStorage;
  safelySaveChains: SafelySaveChains;
  setShowAuxiliaryJudgment: (chainId: string | null) => void;
  tr: (zh: string, en: string) => string;
}

export function createSchedulingHandlers({
  state,
  getState,
  setState,
  storage,
  safelySaveChains,
  setShowAuxiliaryJudgment,
  tr,
}: CreateSchedulingHandlersParams) {
  const readState = resolveAppStateReader({ state, getState });
  const pendingSchedules = new Set<string>();
  const handleScheduleChain = (chainId: string) => {
    const currentState = readState();
    const existingSchedule = currentState.scheduledSessions.find(
      (s) => s.chainId === chainId,
    );
    if (existingSchedule || pendingSchedules.has(chainId)) return;

    const chain = currentState.chains.find((c) => c.id === chainId);
    if (!chain) return;

    const scheduledSession: ScheduledSession = {
      chainId,
      scheduledAt: new Date(),
      expiresAt: new Date(Date.now() + chain.auxiliaryDuration * 60 * 1000),
      auxiliarySignal: chain.auxiliarySignal,
    };

    const updateStateAndSave = async () => {
      try {
        const latestState = readState();
        const updatedSessions = [
          ...latestState.scheduledSessions,
          scheduledSession,
        ];

        await storage.setScheduledSession(scheduledSession);

        setState((prev) => ({
          ...prev,
          scheduledSessions: updatedSessions,
        }));
      } catch (error) {
        logger.error(
          'SESSIONS',
          'Failed to schedule chain',
          { chainId },
          normalizeUnknownError(error),
        );
        toast.error(
          tr('预约失败，请重试', 'Failed to schedule. Please try again.'),
        );
      } finally {
        pendingSchedules.delete(chainId);
      }
    };

    pendingSchedules.add(chainId);
    return updateStateAndSave();
  };

  const handleCancelScheduledSession = (chainId: string) => {
    setShowAuxiliaryJudgment(chainId);
  };

  const handleCompleteBooking = async (chainId: string) => {
    const currentState = readState();
    const chain = currentState.chains.find((c) => c.id === chainId);
    const schedule = currentState.scheduledSessions.find(
      (session) => session.chainId === chainId,
    );
    if (!chain || !schedule || pendingSchedules.has(chainId)) return;
    if (isSessionExpired(schedule.expiresAt)) {
      setShowAuxiliaryJudgment(chainId);
      return;
    }

    const updatedScheduledSessions = currentState.scheduledSessions.filter(
      (session) => session.chainId !== chainId,
    );
    const updatedChains = currentState.chains.map((c) =>
      c.id === chainId ? { ...c, auxiliaryStreak: c.auxiliaryStreak + 1 } : c,
    );

    pendingSchedules.add(chainId);
    try {
      await safelySaveChains(updatedChains);
      await storage.removeScheduledSession(chainId);
      setState((prev) => ({
        ...prev,
        scheduledSessions: updatedScheduledSessions,
        chains: updatedChains,
      }));

      notifyTaskCompleted(
        chain.name,
        chain.auxiliaryStreak + 1,
        tr('预约已完成', 'Schedule completed'),
      );
    } catch (error) {
      logger.error(
        'SESSIONS',
        'Failed to complete booking',
        { chainId },
        normalizeUnknownError(error),
      );
      toast.error(
        tr(
          '完成预约失败，请重试',
          'Failed to complete booking. Please try again.',
        ),
      );
    } finally {
      pendingSchedules.delete(chainId);
    }
  };

  return {
    handleScheduleChain,
    handleCancelScheduledSession,
    handleCompleteBooking,
  };
}
