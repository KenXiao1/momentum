import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n';
import { createUnitChain } from '../../../test/factories';
import type { ActiveSession } from '../../../types';
import { FocusModeView } from '../FocusModeView';

vi.mock('../FocusModeControls', () => ({
  FocusModeControls: ({ onPauseClick }: { onPauseClick: () => void }) => (
    <button type="button" onClick={onPauseClick}>
      mock-controls
    </button>
  ),
}));

vi.mock('../InterruptConfirmDialog', () => ({
  InterruptConfirmDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div>mock-interrupt-dialog</div> : null,
}));

vi.mock('../../RuleSelectionDialog', () => ({
  RuleSelectionDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div>mock-rule-selection</div> : null,
}));

vi.mock('../../task-completion-dialog/TaskCompletionDialog', () => ({
  TaskCompletionDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div>mock-completion-dialog</div> : null,
}));

function createSession(overrides: Partial<ActiveSession> = {}): ActiveSession {
  return {
    chainId: overrides.chainId ?? 'chain-1',
    startedAt: overrides.startedAt ?? new Date('2026-02-06T09:00:00.000Z'),
    duration: overrides.duration ?? 30,
    isPaused: overrides.isPaused ?? false,
    totalPausedTime: overrides.totalPausedTime ?? 0,
    ...overrides,
  };
}

function createProps(
  overrides: Partial<ComponentProps<typeof FocusModeView>> = {},
) {
  const chain = createUnitChain({
    id: 'chain-1',
    name: 'Deep Work',
    trigger: 'Start',
    duration: 30,
    currentStreak: 4,
  });

  return {
    session: createSession({ chainId: chain.id }),
    chain,
    isDurationless: false,
    timeRemaining: 900,
    elapsedSeconds: 300,
    progress: 33,
    lastCompletionTime: null,
    hasReachedMinimum: true,
    minimumCountdown: 0,
    isFullscreen: false,
    onEnterFullscreen: vi.fn(),
    onExitFullscreen: vi.fn(),
    onPauseClick: vi.fn(),
    onEarlyCompleteClick: vi.fn(),
    onInterruptClick: vi.fn(),
    showRuleSelection: false,
    pendingActionType: null,
    sessionContext: {} as any,
    onRuleSelected: vi.fn(),
    onCreateNewRule: vi.fn(),
    onRuleSelectionCancel: vi.fn(),
    showCompletionDialog: false,
    onDirectComplete: vi.fn(),
    onCompletionCancel: vi.fn(),
    showInterruptDialog: false,
    onCancelInterrupt: vi.fn(),
    onConfirmInterrupt: vi.fn(),
    autoResumeAt: null,
    resumeCountdown: 0,
    elapsedPauseTime: 0,
    onResumeNow: vi.fn(),
    onCancelAutoResume: vi.fn(),
    ...overrides,
  };
}

function renderView(props: ComponentProps<typeof FocusModeView>) {
  return render(
    <I18nProvider>
      <FocusModeView {...props} />
    </I18nProvider>,
  );
}

describe('FocusModeView', () => {
  beforeEach(() => {
    localStorage.setItem('language', 'en');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should trigger fullscreen and interrupt handlers when session is active', async () => {
    // RTL 16 drains microtasks with setTimeout(0) and only advances Jest's
    // fake timers; let the fake clock follow real time so that timer fires.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const props = createProps();

    renderView(props);

    await user.click(screen.getByRole('button', { name: /Enter fullscreen/i }));

    // 中断按钮需长按 700ms 才触发
    const interruptButton = screen.getByRole('button', {
      name: /Hold to interrupt/i,
    });
    fireEvent.pointerDown(interruptButton);
    vi.advanceTimersByTime(700);

    expect(props.onEnterFullscreen).toHaveBeenCalledTimes(1);
    expect(props.onInterruptClick).toHaveBeenCalledTimes(1);
  });

  it('should render optional dialogs when related flags are enabled', () => {
    const props = createProps({
      showRuleSelection: true,
      pendingActionType: 'pause',
      showCompletionDialog: true,
      showInterruptDialog: true,
    });

    renderView(props);

    expect(screen.getByText('mock-rule-selection')).toBeInTheDocument();
    expect(screen.getByText('mock-completion-dialog')).toBeInTheDocument();
    expect(screen.getByText('mock-interrupt-dialog')).toBeInTheDocument();
  });

  it('renders timed and durationless minimum-duration branches', () => {
    const timedProps = createProps();
    const { rerender } = renderView(timedProps);

    expect(screen.getByText('15:00')).toBeInTheDocument();
    expect(screen.getByText('15 min / 30 min')).toBeInTheDocument();

    const durationlessProps = createProps({
      chain: createUnitChain({
        id: 'chain-1',
        name: 'Deep Work',
        isDurationless: true,
        minimumDuration: 10,
      }),
      isDurationless: true,
      elapsedSeconds: 125,
      minimumCountdown: 475,
      hasReachedMinimum: false,
    });
    rerender(
      <I18nProvider>
        <FocusModeView {...durationlessProps} />
      </I18nProvider>,
    );

    expect(screen.getByText('02:05')).toBeInTheDocument();
    expect(
      screen.getByText(/Need 7m 55s to reach the minimum duration/),
    ).toBeInTheDocument();
  });

  it('hides the long-press interrupt action while paused', () => {
    renderView(
      createProps({
        session: createSession({ isPaused: true }),
      }),
    );

    expect(
      screen.queryByRole('button', { name: /Hold to interrupt/i }),
    ).not.toBeInTheDocument();
  });
});
