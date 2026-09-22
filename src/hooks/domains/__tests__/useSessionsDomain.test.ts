import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createAppState,
  createLocalStorageMock,
} from '../../../test/factories';
import { useSessionsDomain } from '../useSessionsDomain';
import { createSchedulingHandlers } from '../sessions/scheduling';
import { createStartChainHandler } from '../sessions/start';
import { createCompletionHandlers } from '../sessions/completion';
import { createPauseResumeHandlers } from '../sessions/pauseResume';

vi.mock('../sessions/scheduling', () => ({
  createSchedulingHandlers: vi.fn(() => ({
    handleScheduleChain: vi.fn(),
    handleCancelScheduledSession: vi.fn(),
    handleCompleteBooking: vi.fn(),
  })),
}));

vi.mock('../sessions/start', () => ({
  createStartChainHandler: vi.fn(() => vi.fn()),
}));

vi.mock('../sessions/completion', () => ({
  createCompletionHandlers: vi.fn(() => ({
    handleCompleteSession: vi.fn(),
    handleInterruptSession: vi.fn(),
  })),
}));

vi.mock('../sessions/pauseResume', () => ({
  createPauseResumeHandlers: vi.fn(() => ({
    handlePauseSession: vi.fn(),
    handleResumeSession: vi.fn(),
  })),
}));

vi.mock('../../../i18n', () => ({
  useI18n: vi.fn(() => ({
    tr: (_zh: string, en: string) => en,
    t: (key: string) => key,
  })),
}));

describe('useSessionsDomain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should compose all session handlers from submodules', () => {
    const state = createAppState();
    const setState = vi.fn();
    const storage = createLocalStorageMock();
    const safelySaveChains = vi.fn(async () => undefined);
    const setActiveSessionId = vi.fn();
    const setPendingChainId = vi.fn();
    const setCurrentSessionId = vi.fn();
    const setShowBettingModal = vi.fn();
    const setShowAuxiliaryJudgment = vi.fn();
    const onNavigateToFocus = vi.fn();
    const onNavigateToDashboard = vi.fn();
    const onPetTaskCompleted = vi.fn();

    const result = useSessionsDomain({
      state,
      setState,
      storage,
      safelySaveChains,
      activeSessionId: null,
      setActiveSessionId,
      pendingChainId: null,
      setPendingChainId,
      currentSessionId: null,
      setCurrentSessionId,
      setShowBettingModal,
      setShowAuxiliaryJudgment,
      onNavigateToFocus,
      onNavigateToDashboard,
      onPetTaskCompleted,
    });

    expect(createSchedulingHandlers).toHaveBeenCalledTimes(1);
    expect(createSchedulingHandlers).toHaveBeenCalledWith(
      expect.objectContaining({
        state,
        setState,
        storage,
        safelySaveChains,
        setShowAuxiliaryJudgment,
      }),
    );

    expect(createStartChainHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        state,
        setState,
        storage,
        safelySaveChains,
        setPendingChainId,
        setCurrentSessionId,
        setShowBettingModal,
        onNavigateToFocus,
      }),
    );

    expect(createCompletionHandlers).toHaveBeenCalledWith(
      expect.objectContaining({
        state,
        setState,
        storage,
        safelySaveChains,
        setActiveSessionId,
        onNavigateToDashboard,
        onPetTaskCompleted,
      }),
    );

    expect(createPauseResumeHandlers).toHaveBeenCalledWith(
      expect.objectContaining({
        state,
        getState: expect.any(Function),
        setState,
        storage,
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        handleScheduleChain: expect.any(Function),
        handleStartChain: expect.any(Function),
        handleCompleteSession: expect.any(Function),
        handleInterruptSession: expect.any(Function),
        handlePauseSession: expect.any(Function),
        handleResumeSession: expect.any(Function),
        handleCancelScheduledSession: expect.any(Function),
        handleCompleteBooking: expect.any(Function),
      }),
    );
  });
});
