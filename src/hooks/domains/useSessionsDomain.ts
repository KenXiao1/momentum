/**
 * @module useSessionsDomain
 * @description 任务会话生命周期管理的领域 Hook
 *
 * 职责：
 * - 预约任务（ScheduledSession）
 * - 开始/完成/中断/暂停/恢复任务会话
 * - 处理任务群（Group）的循环执行逻辑
 * - 集成赌博模式（Betting）和宠物系统（Pet）
 * - 记录完成历史和时间统计
 *
 * @see docs/guides/ARCHITECTURE.md - 架构总览
 * @see docs/features/DOMAIN_BETTING.md - 赌博系统集成
 */
import type { Dispatch, SetStateAction } from 'react';
import type { AppState } from '../../types';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import type { SafelySaveChains } from './useChainsDomain';
import {
  taskLifecycleEventBus,
  type TaskLifecycleEventPublisher,
} from '../../services/task-lifecycle/TaskLifecycleEventBus';
import { useI18n } from '../../i18n';
import { resolveAppStateReader } from './appStateAccess';
import { createCompletionHandlers } from './sessions/completion';
import { createPauseResumeHandlers } from './sessions/pauseResume';
import { createSchedulingHandlers } from './sessions/scheduling';
import { createStartChainHandler } from './sessions/start';

interface UseSessionsDomainParams {
  state?: AppState;
  getState?: () => AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  storage: MomentumStorage;
  safelySaveChains: SafelySaveChains;

  activeSessionId: string | null;
  setActiveSessionId: (sessionId: string | null) => void;

  pendingChainId: string | null;
  setPendingChainId: (chainId: string | null) => void;
  currentSessionId: string | null;
  setCurrentSessionId: (sessionId: string | null) => void;
  setShowBettingModal: (isOpen: boolean) => void;

  setShowAuxiliaryJudgment: (chainId: string | null) => void;
  onNavigateToFocus: () => void;
  onNavigateToDashboard: () => void;

  // Pet system callback (optional)
  onPetTaskCompleted?: (duration: number, wasSuccessful: boolean) => void;
  taskLifecycleEvents?: TaskLifecycleEventPublisher;
}

export function useSessionsDomain({
  state,
  getState,
  setState,
  storage,
  safelySaveChains,
  activeSessionId,
  setActiveSessionId,
  pendingChainId,
  setPendingChainId,
  currentSessionId,
  setCurrentSessionId,
  setShowBettingModal,
  setShowAuxiliaryJudgment,
  onNavigateToFocus,
  onNavigateToDashboard,
  onPetTaskCompleted,
  taskLifecycleEvents = taskLifecycleEventBus,
}: UseSessionsDomainParams) {
  const { tr } = useI18n();
  const readState = resolveAppStateReader({ state, getState });

  const {
    handleScheduleChain,
    handleCancelScheduledSession,
    handleCompleteBooking,
  } = createSchedulingHandlers({
    state,
    getState: readState,
    setState,
    storage,
    safelySaveChains,
    setShowAuxiliaryJudgment,
    tr,
  });

  const handleStartChain = createStartChainHandler({
    state,
    getState: readState,
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
    taskLifecycleEvents,
    tr,
  });

  const { handleCompleteSession, handleInterruptSession } =
    createCompletionHandlers({
      state,
      getState: readState,
      setState,
      storage,
      safelySaveChains,
      activeSessionId,
      setActiveSessionId,
      onNavigateToDashboard,
      onPetTaskCompleted,
      taskLifecycleEvents,
      tr,
    });

  const { handlePauseSession, handleResumeSession } = createPauseResumeHandlers(
    { state, getState: readState, setState, storage },
  );

  return {
    handleScheduleChain,
    handleStartChain,
    handleCompleteSession,
    handleInterruptSession,
    handlePauseSession,
    handleResumeSession,
    handleCancelScheduledSession,
    handleCompleteBooking,
  };
}
