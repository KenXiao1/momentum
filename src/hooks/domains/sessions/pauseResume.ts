import type { Dispatch, SetStateAction } from 'react';
import type { AppState } from '../../../types';
import type { MomentumStorage } from '../../../storage/MomentumStorage';
import { resolveAppStateReader } from '../appStateAccess';
import { logger } from '../../../utils/logger';
import { normalizeUnknownError } from '../../../utils/errors/normalizeError';
import { toast } from '../../../utils/toast';

type PendingTransition = { paused: boolean; promise: Promise<boolean> };
const inFlight = new WeakMap<MomentumStorage, Map<string, PendingTransition>>();

interface CreatePauseResumeHandlersParams {
  state?: AppState;
  getState?: () => AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  storage: MomentumStorage;
  saveErrorMessage?: string;
}

export function createPauseResumeHandlers({
  state,
  getState,
  setState,
  storage,
  saveErrorMessage = 'Pause or resume was not saved. Please try again.',
}: CreatePauseResumeHandlersParams) {
  const readState = resolveAppStateReader({ state, getState });
  const transition = (paused: boolean): Promise<boolean> => {
    const activeSession = readState().activeSession;
    if (!activeSession) return Promise.resolve(false);
    const key = `${activeSession.chainId}:${activeSession.startedAt.toISOString()}`;
    const operations =
      inFlight.get(storage) ?? new Map<string, PendingTransition>();
    inFlight.set(storage, operations);
    const pending = operations.get(key);
    if (pending) {
      return pending.paused === paused
        ? pending.promise
        : pending.promise.then(() => transition(paused));
    }
    if (activeSession.isPaused === paused) return Promise.resolve(true);
    if (!paused && !activeSession.pausedAt) return Promise.resolve(false);
    const updatedSession = paused
      ? { ...activeSession, isPaused: true, pausedAt: new Date() }
      : {
          ...activeSession,
          isPaused: false,
          pausedAt: undefined,
          totalPausedTime:
            activeSession.totalPausedTime +
            Date.now() -
            activeSession.pausedAt!.getTime(),
        };
    const promise = (async () => {
      try {
        await storage.saveActiveSession(updatedSession);
      } catch (error) {
        logger.error(
          'SESSIONS',
          'Failed to persist session pause state',
          undefined,
          normalizeUnknownError(error),
        );
        toast.error(saveErrorMessage);
        return false;
      }
      // The write may finish after completion or navigation started another session.
      setState((previous) =>
        previous.activeSession === activeSession
          ? { ...previous, activeSession: updatedSession }
          : previous,
      );
      return true;
    })().finally(() => operations.delete(key));
    operations.set(key, { paused, promise });
    return promise;
  };

  const handlePauseSession = () => transition(true);
  const handleResumeSession = () => transition(false);

  return { handlePauseSession, handleResumeSession };
}
