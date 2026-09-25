import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useExceptionRuleOperations } from '../../../components/focus-mode/hooks/useExceptionRuleOperations';
import { createTranslator } from '../../../i18n/translate';
import {
  EnhancedExceptionRuleException,
  ExceptionRuleError,
  ExceptionRuleType,
  type ExceptionRule,
  type SessionContext,
} from '../../../types';
import { localPreferences } from '../../../utils/localPreferences';
import { dataIntegrityChecker } from '../../DataIntegrityChecker';
import { errorRecoveryManager } from '../../ErrorRecoveryManager';
import { exceptionRuleManager } from '../../ExceptionRuleManager';
import { exceptionRuleStorage } from '../../ExceptionRuleStorage';

const feedback = vi.hoisted(() => ({
  showErrorMessage: vi.fn().mockReturnValue('original-error'),
  showProgress: vi.fn(),
  hideProgress: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
  removeMessage: vi.fn(),
}));

vi.mock('../../UserFeedbackHandler', () => ({
  userFeedbackHandler: feedback,
}));

vi.mock('../../../utils/runtimeI18n', async () => {
  const { createTranslator } = await import('../../../i18n/translate');
  return { t: createTranslator('en') };
});

const rule: ExceptionRule = {
  id: 'existing-rule',
  name: 'Take a break',
  type: ExceptionRuleType.PAUSE_ONLY,
  scope: 'global',
  createdAt: new Date('2026-09-20T12:00:00Z'),
  usageCount: 4,
  isActive: true,
};
const sessionContext: SessionContext = {
  sessionId: 'session-1',
  chainId: 'chain-1',
  chainName: 'Deep work',
  startedAt: new Date('2026-09-20T13:00:00Z'),
  elapsedTime: 600,
  remainingTime: 1200,
  isDurationless: false,
};

function storageError() {
  return new EnhancedExceptionRuleException(
    ExceptionRuleError.STORAGE_ERROR,
    'The requested operation failed',
  );
}

describe('storage recovery with real integrity checks and persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localPreferences.setExceptionRules(JSON.stringify([rule]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('persists a repair without claiming the failed operation completed', async () => {
    const result = await errorRecoveryManager.attemptRecovery(
      storageError(),
      { rule, actionType: 'pause' },
      'use_rule',
    );

    expect(await exceptionRuleStorage.getRuleById(rule.id)).toEqual({
      ...rule,
      usageCount: 0,
    });
    expect(await exceptionRuleStorage.getUsageRecords()).toEqual([]);
    expect(
      (await dataIntegrityChecker.checkRuleDataIntegrity()).issues,
    ).toEqual([]);
    expect(result.success).toBe(false);
    expect(result.requiresUserAction).toBe(true);
    expect(result.message).toContain('Auto-fixed 1 data issue(s)');
    expect(result.message).toContain('Please retry the operation');
    expect(result.recoveredData).toBeUndefined();
    const retry = result.actions?.find(({ id }) => id === 'retry_operation');
    expect(retry).toBeDefined();
    await expect(retry!.handler()).resolves.toMatchObject({
      success: false,
      requiresUserAction: true,
    });
  });

  it('keeps a failed focus operation visible after repairing unrelated data', async () => {
    const originalError = storageError();
    const useRule = vi
      .spyOn(exceptionRuleManager, 'useRule')
      .mockRejectedValue(originalError);
    const params = {
      pendingActionType: 'pause' as const,
      sessionContext,
      onPause: vi.fn(),
      onRequestCompletionDialog: vi.fn(),
      scheduleAutoResume: vi.fn(),
      clearAutoResumeSchedule: vi.fn(),
      finishFlow: vi.fn(),
      t: createTranslator('en'),
    };
    const { result } = renderHook(() => useExceptionRuleOperations(params));

    await act(async () => result.current.handleRuleSelected(rule));

    expect(await exceptionRuleStorage.getRuleById(rule.id)).toMatchObject({
      usageCount: 0,
    });
    expect(useRule).toHaveBeenCalledTimes(1);
    expect(feedback.showErrorMessage).toHaveBeenCalledWith(originalError, {
      rule,
      actionType: 'pause',
    });
    expect(feedback.removeMessage).not.toHaveBeenCalled();
    expect(feedback.showSuccess).not.toHaveBeenCalled();
    expect(params.onPause).not.toHaveBeenCalled();
    expect(params.finishFlow).not.toHaveBeenCalled();
  });

  it('retains persisted data and requests user action when the repair fails', async () => {
    vi.spyOn(localPreferences, 'setExceptionRules').mockImplementationOnce(
      () => {
        throw new Error('Storage is still unavailable');
      },
    );
    const result = await errorRecoveryManager.attemptRecovery(
      storageError(),
      { rule },
      'use_rule',
    );

    expect(await exceptionRuleStorage.getRuleById(rule.id)).toEqual(rule);
    expect(result).toMatchObject({
      success: false,
      requiresUserAction: true,
      message: 'Storage error requires manual handling',
    });
    expect(result.actions?.map(({ id }) => id)).toContain('retry_operation');
  });
});
