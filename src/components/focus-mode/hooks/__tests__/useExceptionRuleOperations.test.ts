import { createTranslator } from '../../../../i18n/translate';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ExceptionRuleError,
  ExceptionRuleType,
  EnhancedExceptionRuleException,
  type ExceptionRule,
  type SessionContext,
} from '../../../../types';
import { useExceptionRuleOperations } from '../useExceptionRuleOperations';

const exceptionRuleManagerMock = vi.hoisted(() => ({
  useRule: vi.fn(),
  createRule: vi.fn(),
}));

const userFeedbackHandlerMock = vi.hoisted(() => ({
  showErrorMessage: vi.fn(),
  showProgress: vi.fn(),
  updateProgress: vi.fn(),
  hideProgress: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
  removeMessage: vi.fn(),
}));

vi.mock('../../../../services/ExceptionRuleManager', () => ({
  exceptionRuleManager: exceptionRuleManagerMock,
}));

vi.mock('../../../../services/UserFeedbackHandler', () => ({
  userFeedbackHandler: userFeedbackHandlerMock,
}));

const sessionContext: SessionContext = {
  sessionId: 'session-1',
  chainId: 'chain-1',
  chainName: 'Deep work',
  startedAt: new Date('2026-07-14T01:00:00.000Z'),
  elapsedTime: 600,
  remainingTime: 1200,
  isDurationless: false,
};

function createRule(overrides: Partial<ExceptionRule> = {}): ExceptionRule {
  return {
    id: overrides.id ?? 'rule-1',
    name: overrides.name ?? 'Take a break',
    description: overrides.description,
    type: overrides.type ?? ExceptionRuleType.PAUSE_ONLY,
    chainId: overrides.chainId,
    scope: overrides.scope ?? 'global',
    createdAt: overrides.createdAt ?? new Date('2026-07-14T00:00:00.000Z'),
    lastUsedAt: overrides.lastUsedAt,
    usageCount: overrides.usageCount ?? 0,
    isActive: overrides.isActive ?? true,
    isArchived: overrides.isArchived,
  };
}

function createParams(
  pendingActionType: 'pause' | 'early_completion' | null = 'pause',
) {
  return {
    pendingActionType,
    sessionContext,
    onPause: vi.fn(),
    onRequestCompletionDialog: vi.fn(),
    scheduleAutoResume: vi.fn(),
    clearAutoResumeSchedule: vi.fn(),
    onRuleUsed: vi.fn(),
    finishFlow: vi.fn(),
    t: createTranslator('en'),
  };
}

describe('useExceptionRuleOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exceptionRuleManagerMock.useRule.mockResolvedValue({ success: true });
    userFeedbackHandlerMock.showErrorMessage.mockReturnValue('error-message-1');
  });

  it('does nothing when a rule arrives after the action flow has closed', async () => {
    const params = createParams(null);
    const { result } = renderHook(() => useExceptionRuleOperations(params));

    await act(async () => {
      await result.current.handleRuleSelected(createRule());
    });

    expect(exceptionRuleManagerMock.useRule).not.toHaveBeenCalled();
    expect(userFeedbackHandlerMock.showProgress).not.toHaveBeenCalled();
    expect(params.onPause).not.toHaveBeenCalled();
    expect(params.finishFlow).not.toHaveBeenCalled();
  });

  it('rejects a rule without an id before any progress or persistence work', async () => {
    const params = createParams();
    const { result } = renderHook(() => useExceptionRuleOperations(params));

    await act(async () => {
      await result.current.handleRuleSelected(createRule({ id: '' }));
    });

    const displayedError = userFeedbackHandlerMock.showErrorMessage.mock
      .calls[0]?.[0] as EnhancedExceptionRuleException;
    expect(displayedError).toBeInstanceOf(EnhancedExceptionRuleException);
    expect(displayedError.type).toBe(ExceptionRuleError.RULE_NOT_FOUND);
    expect(displayedError.message).toBe('Invalid rule');
    expect(exceptionRuleManagerMock.useRule).not.toHaveBeenCalled();
    expect(userFeedbackHandlerMock.showProgress).not.toHaveBeenCalled();
  });

  it('applies a timed pause and converts auto-resume seconds to whole minutes', async () => {
    const params = createParams('pause');
    const rule = createRule();
    const pauseOptions = { duration: 125, autoResume: true };
    const { result } = renderHook(() => useExceptionRuleOperations(params));

    await act(async () => {
      await result.current.handleRuleSelected(rule, pauseOptions);
    });

    expect(exceptionRuleManagerMock.useRule).toHaveBeenCalledWith(
      rule.id,
      sessionContext,
      'pause',
      pauseOptions,
    );
    expect(params.onRuleUsed).toHaveBeenCalledWith(rule, 'pause', pauseOptions);
    expect(params.onPause).toHaveBeenCalledWith(125);
    expect(params.scheduleAutoResume).toHaveBeenCalledWith(2);
    expect(params.clearAutoResumeSchedule).not.toHaveBeenCalled();
    expect(params.onRequestCompletionDialog).not.toHaveBeenCalled();
    expect(params.finishFlow).toHaveBeenCalledTimes(1);
    expect(userFeedbackHandlerMock.hideProgress).toHaveBeenCalledTimes(1);
    expect(userFeedbackHandlerMock.showSuccess).toHaveBeenCalledWith(
      'Success',
      'Applied rule "Take a break" to pause the task',
    );
  });

  it('clears pause state and opens confirmation only after early completion succeeds', async () => {
    const params = createParams('early_completion');
    const rule = createRule({
      name: 'Stop with intent',
      type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
    });
    const { result } = renderHook(() => useExceptionRuleOperations(params));

    await act(async () => {
      await result.current.handleRuleSelected(rule);
    });

    expect(exceptionRuleManagerMock.useRule).toHaveBeenCalledWith(
      rule.id,
      sessionContext,
      'early_completion',
      undefined,
    );
    expect(params.clearAutoResumeSchedule).toHaveBeenCalledTimes(1);
    expect(params.finishFlow).toHaveBeenCalledTimes(1);
    expect(params.onRequestCompletionDialog).toHaveBeenCalledTimes(1);
    expect(params.onPause).not.toHaveBeenCalled();
    expect(params.scheduleAutoResume).not.toHaveBeenCalled();
  });

  it('retains the rule dialog without a success message or auto-resume when pause persistence fails', async () => {
    const params = createParams('pause');
    params.onPause.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const rule = createRule();
    const pauseOptions = { duration: 120, autoResume: true };
    const { result } = renderHook(() => useExceptionRuleOperations(params));
    await act(async () => {
      await result.current.handleRuleSelected(rule, pauseOptions);
    });
    expect(params.finishFlow).not.toHaveBeenCalled();
    expect(params.onRuleUsed).not.toHaveBeenCalled();
    expect(params.scheduleAutoResume).not.toHaveBeenCalled();
    expect(userFeedbackHandlerMock.showSuccess).not.toHaveBeenCalled();
    expect(userFeedbackHandlerMock.hideProgress).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.handleRuleSelected(rule, pauseOptions);
    });
    expect(params.finishFlow).toHaveBeenCalledTimes(1);
    expect(params.onRuleUsed).toHaveBeenCalledTimes(1);
    expect(params.scheduleAutoResume).toHaveBeenCalledWith(2);
    expect(userFeedbackHandlerMock.showSuccess).toHaveBeenCalledTimes(1);
  });

  it('keeps the flow open and surfaces a storage error when rule use rejects', async () => {
    exceptionRuleManagerMock.useRule.mockRejectedValue(
      new Error('storage unavailable'),
    );
    const params = createParams('pause');
    const { result } = renderHook(() => useExceptionRuleOperations(params));

    await act(async () => {
      await result.current.handleRuleSelected(createRule());
    });

    const displayedError = userFeedbackHandlerMock.showErrorMessage.mock
      .calls[0]?.[0] as EnhancedExceptionRuleException;
    expect(displayedError).toBeInstanceOf(EnhancedExceptionRuleException);
    expect(displayedError.type).toBe(ExceptionRuleError.STORAGE_ERROR);
    expect(displayedError.message).toBe('storage unavailable');
    expect(params.onRuleUsed).not.toHaveBeenCalled();
    expect(params.onPause).not.toHaveBeenCalled();
    expect(params.finishFlow).not.toHaveBeenCalled();
    expect(userFeedbackHandlerMock.hideProgress).toHaveBeenCalledTimes(1);
  });

  it('surfaces an enhanced error unchanged and keeps the flow open', async () => {
    const error = new EnhancedExceptionRuleException(
      ExceptionRuleError.NETWORK_ERROR,
      'offline',
    );
    exceptionRuleManagerMock.useRule.mockRejectedValue(error);
    const params = createParams('pause');
    const rule = createRule();
    const { result } = renderHook(() => useExceptionRuleOperations(params));

    await act(async () => {
      await result.current.handleRuleSelected(rule);
    });

    expect(userFeedbackHandlerMock.showErrorMessage).toHaveBeenCalledWith(
      error,
      { rule, actionType: 'pause' },
    );
    expect(userFeedbackHandlerMock.showSuccess).not.toHaveBeenCalled();
    expect(params.finishFlow).not.toHaveBeenCalled();
  });

  it('validates blank rule names without calling creation dependencies', async () => {
    const params = createParams('pause');
    const { result } = renderHook(() => useExceptionRuleOperations(params));

    await act(async () => {
      await result.current.handleCreateNewRule(
        '   ',
        ExceptionRuleType.PAUSE_ONLY,
      );
    });

    const displayedError = userFeedbackHandlerMock.showErrorMessage.mock
      .calls[0]?.[0] as EnhancedExceptionRuleException;
    expect(displayedError.type).toBe(ExceptionRuleError.VALIDATION_ERROR);
    expect(displayedError.message).toBe('Rule name cannot be empty');
    expect(exceptionRuleManagerMock.createRule).not.toHaveBeenCalled();
    expect(exceptionRuleManagerMock.useRule).not.toHaveBeenCalled();
  });

  it('normalizes an invalid type, requests exact reuse, and applies the created rule', async () => {
    const params = createParams('early_completion');
    const createdRule = createRule({
      id: 'created-rule',
      name: 'Finish now',
      type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
    });
    exceptionRuleManagerMock.createRule.mockResolvedValue({
      rule: createdRule,
      warnings: ['Similar rule exists'],
    });
    const { result } = renderHook(() => useExceptionRuleOperations(params));

    await act(async () => {
      await result.current.handleCreateNewRule(
        'Finish now',
        'invalid_runtime_type' as ExceptionRuleType,
      );
    });

    expect(exceptionRuleManagerMock.createRule).toHaveBeenCalledWith(
      'Finish now',
      ExceptionRuleType.EARLY_COMPLETION_ONLY,
      undefined,
      { reuseExisting: true },
    );
    expect(userFeedbackHandlerMock.showWarning).toHaveBeenCalledWith(
      'Notes',
      'Similar rule exists',
    );
    expect(exceptionRuleManagerMock.useRule).toHaveBeenCalledWith(
      createdRule.id,
      sessionContext,
      'early_completion',
      undefined,
    );
    expect(params.clearAutoResumeSchedule).toHaveBeenCalledTimes(1);
    expect(params.finishFlow).toHaveBeenCalledTimes(1);
    expect(params.onRequestCompletionDialog).toHaveBeenCalledTimes(1);
  });

  it('surfaces a creation error without applying any rule', async () => {
    const error = new EnhancedExceptionRuleException(
      ExceptionRuleError.DUPLICATE_RULE_NAME,
      'duplicate',
    );
    exceptionRuleManagerMock.createRule.mockRejectedValue(error);
    const params = createParams('pause');
    const { result } = renderHook(() => useExceptionRuleOperations(params));

    await act(async () => {
      await result.current.handleCreateNewRule(
        'Take a break',
        ExceptionRuleType.PAUSE_ONLY,
      );
    });

    expect(userFeedbackHandlerMock.showErrorMessage).toHaveBeenCalledWith(
      error,
      { name: 'Take a break', type: ExceptionRuleType.PAUSE_ONLY },
    );
    expect(userFeedbackHandlerMock.hideProgress).toHaveBeenCalledTimes(1);
    expect(exceptionRuleManagerMock.useRule).not.toHaveBeenCalled();
    expect(params.finishFlow).not.toHaveBeenCalled();
  });
});
