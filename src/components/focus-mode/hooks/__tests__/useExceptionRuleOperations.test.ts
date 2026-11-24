import { createTranslator } from '../../../../i18n/translate';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ExceptionRuleError,
  ExceptionRuleException,
  ExceptionRuleType,
  type ExceptionRule,
  type SessionContext,
} from '../../../../types';
import { toast } from '../../../../utils/toast';
import { useExceptionRuleOperations } from '../useExceptionRuleOperations';

const exceptionRuleManagerMock = vi.hoisted(() => ({
  useRule: vi.fn(),
  createRule: vi.fn(),
}));

vi.mock(
  '../../../../services/exception-rule-manager/ExceptionRuleManager',
  () => ({
    exceptionRuleManager: exceptionRuleManagerMock,
  }),
);

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
    vi.spyOn(toast, 'error');
    vi.spyOn(toast, 'success');
    vi.spyOn(toast, 'warning');
  });

  it('does nothing when a rule arrives after the action flow has closed', async () => {
    const params = createParams(null);
    const { result } = renderHook(() => useExceptionRuleOperations(params));

    await act(async () => {
      await result.current.handleRuleSelected(createRule());
    });

    expect(exceptionRuleManagerMock.useRule).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(params.onPause).not.toHaveBeenCalled();
    expect(params.finishFlow).not.toHaveBeenCalled();
  });

  it('rejects a rule without an id before any persistence work', async () => {
    const params = createParams();
    const { result } = renderHook(() => useExceptionRuleOperations(params));

    await act(async () => {
      await result.current.handleRuleSelected(createRule({ id: '' }));
    });

    expect(toast.error).toHaveBeenCalledWith(
      'The rule does not exist or has been deleted. Please choose another rule or create a new one.',
      { title: 'Rule not found' },
    );
    expect(exceptionRuleManagerMock.useRule).not.toHaveBeenCalled();
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
    expect(toast.success).toHaveBeenCalledWith(
      'Applied rule "Take a break" to pause the task',
      { title: 'Success' },
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
    expect(toast.success).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.handleRuleSelected(rule, pauseOptions);
    });
    expect(params.finishFlow).toHaveBeenCalledTimes(1);
    expect(params.onRuleUsed).toHaveBeenCalledTimes(1);
    expect(params.scheduleAutoResume).toHaveBeenCalledWith(2);
    expect(toast.success).toHaveBeenCalledTimes(1);
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

    expect(toast.error).toHaveBeenCalledWith(
      'Failed to save data. Please check your connection or try again.',
      { title: 'Save failed' },
    );
    expect(params.onRuleUsed).not.toHaveBeenCalled();
    expect(params.onPause).not.toHaveBeenCalled();
    expect(params.finishFlow).not.toHaveBeenCalled();
  });

  it('describes a rule error by its type and keeps the flow open', async () => {
    const error = new ExceptionRuleException(
      ExceptionRuleError.RULE_TYPE_MISMATCH,
      'wrong type',
    );
    exceptionRuleManagerMock.useRule.mockRejectedValue(error);
    const params = createParams('pause');
    const rule = createRule();
    const { result } = renderHook(() => useExceptionRuleOperations(params));

    await act(async () => {
      await result.current.handleRuleSelected(rule);
    });

    expect(toast.error).toHaveBeenCalledWith(
      'This rule type does not match the current action. Please choose a compatible rule type.',
      { title: 'Rule type mismatch' },
    );
    expect(toast.success).not.toHaveBeenCalled();
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

    expect(toast.error).toHaveBeenCalledWith(
      'Validation failed: Rule name cannot be empty',
      { title: 'Validation failed' },
    );
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
    expect(toast.warning).toHaveBeenCalledWith('Similar rule exists', {
      title: 'Notes',
    });
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
    const error = new ExceptionRuleException(
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

    expect(toast.error).toHaveBeenCalledWith(
      'This rule name already exists. Please choose a different name or use the existing rule.',
      { title: 'Duplicate rule name' },
    );
    expect(exceptionRuleManagerMock.useRule).not.toHaveBeenCalled();
    expect(params.finishFlow).not.toHaveBeenCalled();
  });
});
