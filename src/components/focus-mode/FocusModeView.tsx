import type {
  ActiveSession,
  Chain,
  ExceptionRule,
  ExceptionRuleType,
  PauseOptions,
  SessionContext,
} from '../../types';
import { useI18n } from '../../i18n';
import { FocusModeControls } from './FocusModeControls';
import { FocusModeDialogs } from './FocusModeDialogs';
import { FocusSessionHeader } from './FocusSessionHeader';
import { FocusTimerPanel } from './FocusTimerPanel';
import { LongPressInterruptButton } from './LongPressInterruptButton';

interface FocusModeViewProps {
  session: ActiveSession;
  chain: Chain;
  isDurationless: boolean;
  timeRemaining: number;
  elapsedSeconds: number;
  progress: number;
  lastCompletionTime: number | null;
  hasReachedMinimum: boolean;
  minimumCountdown: number;
  isFullscreen: boolean;
  onEnterFullscreen: () => void;
  onExitFullscreen: () => void;
  onPauseClick: () => void;
  onEarlyCompleteClick: () => void;
  onInterruptClick: () => void;
  showRuleSelection: boolean;
  pendingActionType: 'pause' | 'early_completion' | null;
  sessionContext: SessionContext;
  onRuleSelected: (rule: ExceptionRule, pauseOptions?: PauseOptions) => void;
  onCreateNewRule: (name: string, type: ExceptionRuleType) => void;
  onRuleSelectionCancel: () => void;
  showCompletionDialog: boolean;
  onDirectComplete: (
    description?: string,
    notes?: string,
  ) => void | Promise<boolean | void>;
  onCompletionCancel: () => void;
  showInterruptDialog: boolean;
  onCancelInterrupt: () => void;
  onConfirmInterrupt: () => void;
  autoResumeAt: number | null;
  resumeCountdown: number;
  elapsedPauseTime: number;
  onResumeNow: () => void;
  onCancelAutoResume: () => void;
}

export function FocusModeView(props: FocusModeViewProps) {
  const { language, t } = useI18n();
  const { session, chain } = props;

  return (
    <main
      className={`relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--surface-canvas)] px-4 py-20 sm:px-6 ${session.isPaused ? 'focus-paused' : 'focus-running'}`}
    >
      <div className="relative z-10 w-full max-w-5xl animate-fade-in">
        <FocusSessionHeader
          chain={chain}
          language={language}
          isFullscreen={props.isFullscreen}
          onEnterFullscreen={props.onEnterFullscreen}
          onExitFullscreen={props.onExitFullscreen}
          t={t}
        />
        <FocusTimerPanel
          session={session}
          chain={chain}
          isDurationless={props.isDurationless}
          timeRemaining={props.timeRemaining}
          elapsedSeconds={props.elapsedSeconds}
          progress={props.progress}
          lastCompletionTime={props.lastCompletionTime}
          hasReachedMinimum={props.hasReachedMinimum}
          minimumCountdown={props.minimumCountdown}
          language={language}
          t={t}
        />
        <FocusModeControls
          session={session}
          chain={chain}
          isDurationless={props.isDurationless}
          hasReachedMinimum={props.hasReachedMinimum}
          onPauseClick={props.onPauseClick}
          onEarlyCompleteClick={props.onEarlyCompleteClick}
          autoResumeAt={props.autoResumeAt}
          resumeCountdown={props.resumeCountdown}
          elapsedPauseTime={props.elapsedPauseTime}
          onResumeNow={props.onResumeNow}
          onCancelAutoResume={props.onCancelAutoResume}
        />
      </div>
      {!session.isPaused && (
        <LongPressInterruptButton
          label={t('focusMode.focusModeView.holdToInterrupt')}
          onInterrupt={props.onInterruptClick}
        />
      )}
      <FocusModeDialogs
        chainId={chain.id}
        chainName={chain.name}
        isDurationless={props.isDurationless}
        showRuleSelection={props.showRuleSelection}
        pendingActionType={props.pendingActionType}
        sessionContext={props.sessionContext}
        onRuleSelected={props.onRuleSelected}
        onCreateNewRule={props.onCreateNewRule}
        onRuleSelectionCancel={props.onRuleSelectionCancel}
        showCompletionDialog={props.showCompletionDialog}
        onDirectComplete={props.onDirectComplete}
        onCompletionCancel={props.onCompletionCancel}
        showInterruptDialog={props.showInterruptDialog}
        onCancelInterrupt={props.onCancelInterrupt}
        onConfirmInterrupt={props.onConfirmInterrupt}
      />
    </main>
  );
}
