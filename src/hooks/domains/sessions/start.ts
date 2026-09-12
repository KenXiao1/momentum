import type { Dispatch, SetStateAction } from 'react';
import type {
  ActiveSession,
  AppState,
  TaskLifecycleEvent,
} from '../../../types';
import type { MomentumStorage } from '../../../storage/MomentumStorage';
import { hasStorageCapability } from '../../../storage/ports';
import type { SafelySaveChains } from '../useChainsDomain';
import { resolveAppStateReader } from '../appStateAccess';
import { logger } from '../../../utils/logger';
import { toast } from '../../../utils/toast';
import { normalizeUnknownError } from '../../../utils/errors/normalizeError';
import { notifyTaskCompleted } from './sessionNotifications';
import { isSessionExpired } from '../../../utils/time';
import { createGroupStartFlow } from './groupStartFlow';

type Chain = AppState['chains'][number];
type ScheduledSession = AppState['scheduledSessions'][number];

interface CreateStartChainHandlerParams {
  state?: AppState;
  getState?: () => AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  storage: MomentumStorage;
  safelySaveChains: SafelySaveChains;
  pendingChainId: string | null;
  setPendingChainId: (chainId: string | null) => void;
  currentSessionId: string | null;
  setCurrentSessionId: (sessionId: string | null) => void;
  setShowBettingModal: (isOpen: boolean) => void;
  setShowAuxiliaryJudgment?: (chainId: string | null) => void;
  onNavigateToFocus?: () => void;
  onTaskLifecycleEvent?: (event: TaskLifecycleEvent) => void;
  tr: (zh: string, en: string) => string;
}

function buildActiveSession(params: {
  chainId: string;
  chain: Chain;
  bettingSessionId: string | null;
}): ActiveSession {
  return {
    ...(params.bettingSessionId ? { id: params.bettingSessionId } : {}),
    chainId: params.chainId,
    startedAt: new Date(),
    duration: params.chain.isDurationless ? 0 : params.chain.duration,
    isPaused: false,
    totalPausedTime: 0,
  };
}

export function createStartChainHandler({
  state,
  getState,
  setState,
  storage,
  safelySaveChains,
  pendingChainId,
  setPendingChainId,
  currentSessionId,
  setCurrentSessionId,
  setShowBettingModal,
  setShowAuxiliaryJudgment,
  onNavigateToFocus,
  onTaskLifecycleEvent,
  tr,
}: CreateStartChainHandlerParams) {
  const readState = resolveAppStateReader({ state, getState });

  function findChain(chainId: string): Chain | null {
    return readState().chains.find((chain) => chain.id === chainId) ?? null;
  }

  function findScheduledSession(chainId: string): ScheduledSession | null {
    return (
      readState().scheduledSessions.find(
        (session) => session.chainId === chainId,
      ) ?? null
    );
  }

  function persistScheduledSessionRemoval(chainId: string): void {
    storage.removeScheduledSession(chainId).catch((error) => {
      logger.error(
        'SESSIONS',
        'Failed to persist scheduled sessions',
        { chainId },
        normalizeUnknownError(error),
      );
    });
  }

  function persistActiveSession(chainId: string, session: ActiveSession): void {
    storage.saveActiveSession(session).catch((error) => {
      logger.error(
        'SESSIONS',
        'Failed to persist active session',
        { chainId },
        normalizeUnknownError(error),
      );
      toast.error(
        tr(
          '无法保存任务会话：数据库可能处于只读状态或写入被拒绝（查看控制台）',
          'Failed to persist session: database may be read-only or write is denied (check console).',
        ),
      );
    });
  }

  function persistChains(chainId: string, chains: AppState['chains']): void {
    safelySaveChains(chains).catch((error) => {
      logger.error(
        'SESSIONS',
        '开始任务时保存链条数据失败',
        { chainId },
        normalizeUnknownError(error),
      );
    });
  }

  async function maybeStartBettingSession(chainId: string): Promise<boolean> {
    if (!hasStorageCapability(storage, 'betting')) return false;
    if (pendingChainId) return false;

    try {
      const isGamblingEnabled = await storage.isGamblingModeEnabled();
      if (!isGamblingEnabled.ok || !isGamblingEnabled.value) return false;

      const chain = findChain(chainId);
      if (!chain) return true;

      const sessionId = await storage.createBettingSession(
        chainId,
        chain.duration,
      );
      if (!sessionId.ok) {
        logger.error('SESSIONS', 'Failed to create betting session', {
          chainId,
          code: sessionId.error.code,
          message: sessionId.error.message,
        });
        toast.error(
          tr(
            '无法创建押注会话：数据库可能处于只读状态（查看控制台）',
            'Failed to create betting session: database may be read-only (check console).',
          ),
        );
        return true;
      }

      setPendingChainId(chainId);
      setCurrentSessionId(sessionId.value);
      setShowBettingModal(true);
      return true;
    } catch (error) {
      logger.error(
        'SESSIONS',
        'Failed to check gambling mode',
        undefined,
        normalizeUnknownError(error),
      );
      return false;
    }
  }

  function startSingleChain(chain: Chain): void {
    const currentState = readState();
    const existingScheduledSession = findScheduledSession(chain.id);
    const bettingSessionId =
      pendingChainId === chain.id ? currentSessionId : null;

    const activeSession = buildActiveSession({
      chainId: chain.id,
      chain,
      bettingSessionId,
    });
    const updatedScheduledSessions = currentState.scheduledSessions.filter(
      (session) => session.chainId !== chain.id,
    );

    const updatedChains = existingScheduledSession
      ? currentState.chains.map((item) =>
          item.id === chain.id
            ? { ...item, auxiliaryStreak: item.auxiliaryStreak + 1 }
            : item,
        )
      : currentState.chains;

    if (existingScheduledSession) {
      notifyTaskCompleted(
        chain.name,
        chain.auxiliaryStreak + 1,
        tr('预约已完成', 'Schedule completed'),
      );
    }

    persistActiveSession(chain.id, activeSession);
    if (existingScheduledSession) {
      persistScheduledSessionRemoval(chain.id);
      persistChains(chain.id, updatedChains);
    }

    setState((prev) => ({
      ...prev,
      activeSession,
      scheduledSessions: updatedScheduledSessions,
      chains: updatedChains,
    }));
    onNavigateToFocus?.();
  }

  const startGroupChain = createGroupStartFlow({
    readState,
    setState,
    storage,
    safelySaveChains,
    startChain: (chainId) => handleStartChain(chainId),
    onTaskLifecycleEvent,
    tr,
  });

  async function handleStartChain(chainId: string): Promise<void> {
    const schedule = findScheduledSession(chainId);
    if (schedule && isSessionExpired(schedule.expiresAt)) {
      setShowAuxiliaryJudgment?.(chainId);
      return;
    }
    if (await maybeStartBettingSession(chainId)) return;

    const chain = findChain(chainId);
    if (!chain) return;

    if (chain.type === 'group') {
      await startGroupChain(chain);
      return;
    }

    startSingleChain(chain);
  }

  return handleStartChain;
}
