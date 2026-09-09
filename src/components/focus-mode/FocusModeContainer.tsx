import { useMemo, useState } from 'react';
import type {
  ActiveSession,
  Chain,
  ExceptionRule,
  PauseOptions,
  SessionContext,
} from '../../types';
import { useStorage } from '../../storage/useStorage';
import { useAutoResume } from './hooks/useAutoResume';
import { useExceptionRuleFlow } from './hooks/useExceptionRuleFlow';
import { useFocusTimers } from './hooks/useFocusTimers';
import { useFullscreen } from './hooks/useFullscreen';
import { FocusModeView } from './FocusModeView';
import { useI18n } from '../../i18n';

interface FocusModeProps {
  session: ActiveSession;
  chain: Chain;
  onComplete: (description?: string, notes?: string) => void;
  onInterrupt: (reason?: string) => void;
  onPause: (duration?: number) => void;
  onResume: () => void;
  onRuleUsed?: (
    rule: ExceptionRule,
    actionType: 'pause' | 'early_completion',
    pauseOptions?: PauseOptions,
  ) => void;
}

export function FocusMode({
  session,
  chain,
  onComplete,
  onInterrupt,
  onPause,
  onResume,
  onRuleUsed,
}: FocusModeProps) {
  const { tr } = useI18n();
  const storage = useStorage();
  const isDurationless = !!chain.isDurationless || session.duration === 0;

  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [showInterruptDialog, setShowInterruptDialog] = useState(false);

  const {
    autoResumeAt,
    resumeCountdown,
    elapsedPauseTime,
    scheduleAutoResume,
    clearAutoResumeSchedule,
  } = useAutoResume({
    session,
    onResume,
  });

  const {
    timeRemaining,
    forwardElapsedSeconds,
    lastCompletionTime,
    hasReachedMinimum,
    minimumCountdown,
  } = useFocusTimers({
    session,
    chain,
    isDurationless,
    storage,
    onTimeUp: () => setShowCompletionDialog(true),
  });

  const elapsedSeconds = isDurationless
    ? forwardElapsedSeconds
    : session.duration * 60 - timeRemaining;
  const progress = isDurationless
    ? 100
    : ((session.duration * 60 - timeRemaining) / (session.duration * 60)) * 100;

  const sessionContext = useMemo<SessionContext>(() => {
    const sessionId = `${session.chainId}_${session.startedAt.getTime()}`;
    return {
      sessionId,
      chainId: session.chainId,
      chainName: chain.name,
      startedAt: session.startedAt,
      elapsedTime: elapsedSeconds,
      remainingTime: isDurationless ? undefined : timeRemaining,
      isDurationless,
    };
  }, [
    chain.name,
    elapsedSeconds,
    isDurationless,
    session.chainId,
    session.startedAt,
    timeRemaining,
  ]);

  const exceptionRuleFlow = useExceptionRuleFlow({
    sessionContext,
    onPause,
    onRuleUsed,
    scheduleAutoResume,
    clearAutoResumeSchedule,
    onRequestCompletionDialog: () => setShowCompletionDialog(true),
  });

  const { isFullscreen, enterFullscreen, exitFullscreen } = useFullscreen();

  const handleEarlyCompleteClick = () => {
    if (isDurationless && (!chain.minimumDuration || hasReachedMinimum)) {
      setShowCompletionDialog(true);
      return;
    }
    exceptionRuleFlow.openEarlyCompletionSelection();
  };

  const handleDirectComplete = (description?: string, notes?: string) => {
    setShowCompletionDialog(false);
    onComplete(description, notes);
  };

  const handleConfirmInterrupt = () => {
    setShowInterruptDialog(false);
    onInterrupt(tr('用户主动中断', 'User interrupted'));
  };

  const handleResumeNow = () => {
    clearAutoResumeSchedule();
    onResume();
  };

  return (
    <FocusModeView
      session={session}
      chain={chain}
      isDurationless={isDurationless}
      timeRemaining={timeRemaining}
      elapsedSeconds={elapsedSeconds}
      progress={progress}
      lastCompletionTime={lastCompletionTime}
      hasReachedMinimum={hasReachedMinimum}
      minimumCountdown={minimumCountdown}
      isFullscreen={isFullscreen}
      onEnterFullscreen={enterFullscreen}
      onExitFullscreen={exitFullscreen}
      onPauseClick={exceptionRuleFlow.openPauseSelection}
      onEarlyCompleteClick={handleEarlyCompleteClick}
      onInterruptClick={() => setShowInterruptDialog(true)}
      showRuleSelection={exceptionRuleFlow.showRuleSelection}
      pendingActionType={exceptionRuleFlow.pendingActionType}
      sessionContext={sessionContext}
      onRuleSelected={exceptionRuleFlow.handleRuleSelected}
      onCreateNewRule={exceptionRuleFlow.handleCreateNewRule}
      onRuleSelectionCancel={exceptionRuleFlow.handleRuleSelectionCancel}
      showCompletionDialog={showCompletionDialog}
      onDirectComplete={handleDirectComplete}
      onCompletionCancel={() => setShowCompletionDialog(false)}
      showInterruptDialog={showInterruptDialog}
      onCancelInterrupt={() => setShowInterruptDialog(false)}
      onConfirmInterrupt={handleConfirmInterrupt}
      autoResumeAt={autoResumeAt}
      resumeCountdown={resumeCountdown}
      elapsedPauseTime={elapsedPauseTime}
      onResumeNow={handleResumeNow}
      onCancelAutoResume={clearAutoResumeSchedule}
    />
  );
}
