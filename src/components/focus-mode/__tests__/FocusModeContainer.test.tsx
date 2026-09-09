import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveSession, Chain } from '../../../types';
import { FocusMode } from '../FocusModeContainer';

const useAutoResumeMock = vi.hoisted(() => vi.fn());
const useExceptionRuleFlowMock = vi.hoisted(() => vi.fn());
const useFocusTimersMock = vi.hoisted(() => vi.fn());
const useFullscreenMock = vi.hoisted(() => vi.fn());
const useStorageMock = vi.hoisted(() => vi.fn());

const flowActions = vi.hoisted(() => ({
  openPauseSelection: vi.fn(),
  openEarlyCompletionSelection: vi.fn(),
  handleRuleSelected: vi.fn(),
  handleCreateNewRule: vi.fn(),
  handleRuleSelectionCancel: vi.fn(),
}));

const autoResumeActions = vi.hoisted(() => ({
  scheduleAutoResume: vi.fn(),
  clearAutoResumeSchedule: vi.fn(),
}));

vi.mock('../../../storage/useStorage', () => ({
  useStorage: useStorageMock,
}));

vi.mock('../hooks/useAutoResume', () => ({
  useAutoResume: useAutoResumeMock,
}));

vi.mock('../hooks/useExceptionRuleFlow', () => ({
  useExceptionRuleFlow: useExceptionRuleFlowMock,
}));

vi.mock('../hooks/useFocusTimers', () => ({
  useFocusTimers: useFocusTimersMock,
}));

vi.mock('../hooks/useFullscreen', () => ({
  useFullscreen: useFullscreenMock,
}));

vi.mock('../../../i18n', () => ({
  useI18n: () => ({
    tr: (_zh: string, en: string) => en,
  }),
}));

vi.mock('../FocusModeView', () => ({
  FocusModeView: (props: {
    showCompletionDialog: boolean;
    showInterruptDialog: boolean;
    onEarlyCompleteClick: () => void;
    onConfirmInterrupt: () => void;
    onInterruptClick: () => void;
    onResumeNow: () => void;
  }) => (
    <div>
      <div data-testid="completion-open">
        {String(props.showCompletionDialog)}
      </div>
      <div data-testid="interrupt-open">
        {String(props.showInterruptDialog)}
      </div>
      <button onClick={props.onEarlyCompleteClick}>early-complete</button>
      <button onClick={props.onInterruptClick}>open-interrupt</button>
      <button onClick={props.onConfirmInterrupt}>confirm-interrupt</button>
      <button onClick={props.onResumeNow}>resume-now</button>
    </div>
  ),
}));

function createSession(overrides: Partial<ActiveSession> = {}): ActiveSession {
  return {
    chainId: 'chain-1',
    startedAt: new Date('2026-02-06T10:00:00.000Z'),
    duration: 30,
    isPaused: false,
    totalPausedTime: 0,
    ...overrides,
  };
}

function createChain(overrides: Partial<Chain> = {}): Chain {
  return {
    id: 'chain-1',
    name: 'Focus',
    type: 'unit',
    sortOrder: 1,
    trigger: 'trigger',
    duration: 30,
    description: 'desc',
    currentStreak: 0,
    auxiliaryStreak: 0,
    totalCompletions: 0,
    totalFailures: 0,
    auxiliaryFailures: 0,
    exceptions: [],
    auxiliaryExceptions: [],
    auxiliarySignal: '',
    auxiliaryDuration: 10,
    auxiliaryCompletionTrigger: '',
    timeLimitExceptions: [],
    createdAt: new Date('2026-02-06T00:00:00.000Z'),
    ...overrides,
  } as Chain;
}

describe('FocusModeContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStorageMock.mockReturnValue({ kind: 'local' });
    useAutoResumeMock.mockReturnValue({
      autoResumeAt: null,
      resumeCountdown: null,
      elapsedPauseTime: 0,
      ...autoResumeActions,
    });
    useExceptionRuleFlowMock.mockReturnValue({
      showRuleSelection: false,
      pendingActionType: null,
      ...flowActions,
    });
    useFocusTimersMock.mockReturnValue({
      timeRemaining: 1200,
      forwardElapsedSeconds: 0,
      lastCompletionTime: null,
      hasReachedMinimum: false,
      minimumCountdown: 0,
    });
    useFullscreenMock.mockReturnValue({
      isFullscreen: false,
      enterFullscreen: vi.fn(),
      exitFullscreen: vi.fn(),
    });
  });

  it('opens completion dialog immediately for durationless chains and handles interrupt/resume actions', () => {
    const onInterrupt = vi.fn();
    const onResume = vi.fn();

    render(
      <FocusMode
        session={createSession({ duration: 0 })}
        chain={createChain({ isDurationless: true })}
        onComplete={vi.fn()}
        onInterrupt={onInterrupt}
        onPause={vi.fn()}
        onResume={onResume}
      />,
    );

    fireEvent.click(screen.getByText('early-complete'));
    expect(screen.getByTestId('completion-open').textContent).toBe('true');
    expect(flowActions.openEarlyCompletionSelection).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('open-interrupt'));
    expect(screen.getByTestId('interrupt-open').textContent).toBe('true');

    fireEvent.click(screen.getByText('confirm-interrupt'));
    expect(onInterrupt).toHaveBeenCalledWith('User interrupted');

    fireEvent.click(screen.getByText('resume-now'));
    expect(autoResumeActions.clearAutoResumeSchedule).toHaveBeenCalledTimes(1);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('uses exception-rule early-complete flow for timed chains', () => {
    render(
      <FocusMode
        session={createSession({ duration: 30 })}
        chain={createChain({ isDurationless: false })}
        onComplete={vi.fn()}
        onInterrupt={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('early-complete'));
    expect(flowActions.openEarlyCompletionSelection).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('completion-open').textContent).toBe('false');
  });
  it.each([false, true])(
    'B01 gates durationless completion on the minimum: reached=%s',
    (reached) => {
      useFocusTimersMock.mockReturnValue({
        timeRemaining: 0,
        forwardElapsedSeconds: reached ? 1800 : 18,
        hasReachedMinimum: reached,
        minimumCountdown: reached ? 0 : 1782,
      });
      render(
        <FocusMode
          session={createSession({ duration: 0 })}
          chain={createChain({ isDurationless: true, minimumDuration: 30 })}
          onComplete={vi.fn()}
          onInterrupt={vi.fn()}
          onPause={vi.fn()}
          onResume={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByText('early-complete'));
      expect(screen.getByTestId('completion-open')).toHaveTextContent(
        String(reached),
      );
      expect(flowActions.openEarlyCompletionSelection).toHaveBeenCalledTimes(
        reached ? 0 : 1,
      );
    },
  );
});
