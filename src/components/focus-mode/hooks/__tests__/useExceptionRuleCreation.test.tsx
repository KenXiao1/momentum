import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../../i18n/translate';
import {
  ExceptionRuleType,
  type ExceptionRule,
  type RuleUsageRecord,
  type SessionContext,
} from '../../../../types';
import { localPreferences } from '../../../../utils/localPreferences';
import { useExceptionRuleOperations } from '../useExceptionRuleOperations';

const feedback = vi.hoisted(() => ({
  showErrorMessage: vi.fn(),
  showProgress: vi.fn(),
  updateProgress: vi.fn(),
  hideProgress: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
  removeMessage: vi.fn(),
}));

vi.mock('../../../../services/UserFeedbackHandler', () => ({
  userFeedbackHandler: feedback,
}));

vi.mock('../../../../services/ErrorRecoveryManager', () => ({
  errorRecoveryManager: {
    attemptRecovery: vi.fn(async () => ({
      success: false,
      message: 'No automatic recovery',
    })),
  },
}));

vi.mock('../../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
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

function seedRule(type = ExceptionRuleType.PAUSE_ONLY): ExceptionRule {
  const rule: ExceptionRule = {
    id: 'existing-rule',
    name: 'Stretch shoulders',
    type,
    scope: 'global',
    createdAt: new Date('2026-07-14T00:00:00.000Z'),
    usageCount: 0,
    isActive: true,
    isArchived: false,
  };
  localPreferences.setExceptionRules(JSON.stringify([rule]));
  return rule;
}

function storedRules(): ExceptionRule[] {
  return JSON.parse(localPreferences.getExceptionRules() ?? '[]');
}

function storedUsage(): RuleUsageRecord[] {
  return JSON.parse(localPreferences.getExceptionRulesUsage() ?? '[]');
}

function renderCreation(
  pendingActionType: 'pause' | 'early_completion' = 'pause',
) {
  const params = {
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
  const { result } = renderHook(() => useExceptionRuleOperations(params));
  return {
    params,
    create: async (name: string, type = ExceptionRuleType.PAUSE_ONLY) => {
      await act(async () => {
        await result.current.handleCreateNewRule(name, type);
      });
    },
  };
}

// The manager, creator, duplicate handling, validation and repositories stay real.
// These observations must remain valid when their internal checks are removed.
describe('focus-mode rule creation with local persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localPreferences.setLanguage('en');
    feedback.showErrorMessage.mockReturnValue('error-message');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['Stretch shoulders', '  STRETCH SHOULDERS  '])(
    'reuses the existing rule for the equivalent name %j',
    async (name) => {
      const existing = seedRule();
      const { create, params } = renderCreation();

      await create(name);

      expect(storedRules()).toEqual([
        expect.objectContaining({ id: existing.id, name: existing.name }),
      ]);
      expect(storedUsage()).toEqual([
        expect.objectContaining({
          ruleId: existing.id,
          sessionId: sessionContext.sessionId,
          actionType: 'pause',
        }),
      ]);
      expect(params.onPause).toHaveBeenCalledOnce();
      expect(params.finishFlow).toHaveBeenCalledOnce();
      expect(feedback.showWarning).not.toHaveBeenCalled();
      expect(feedback.showErrorMessage).not.toHaveBeenCalled();
    },
  );

  it('creates a similar name unchanged and warns about the existing rule', async () => {
    const existing = seedRule();
    const { create, params } = renderCreation();

    await create('Stretch shoulder');

    const rules = storedRules();
    expect(rules).toHaveLength(2);
    expect(rules[0]).toMatchObject({ id: existing.id, name: existing.name });
    expect(rules[1]).toMatchObject({
      name: 'Stretch shoulder',
      type: ExceptionRuleType.PAUSE_ONLY,
    });
    expect(rules[1].id).not.toBe(existing.id);
    expect(storedUsage()).toEqual([
      expect.objectContaining({ ruleId: rules[1].id, actionType: 'pause' }),
    ]);
    expect(feedback.showWarning).toHaveBeenCalledWith(
      'Notes',
      expect.stringContaining(existing.name),
    );
    expect(params.onPause).toHaveBeenCalledOnce();
    expect(params.finishFlow).toHaveBeenCalledOnce();
  });

  it('persists and applies a new rule with no naming conflict', async () => {
    const { create, params } = renderCreation();

    await create('  Check the oven  ');

    const rules = storedRules();
    expect(rules).toEqual([
      expect.objectContaining({
        name: 'Check the oven',
        type: ExceptionRuleType.PAUSE_ONLY,
        scope: 'global',
        isActive: true,
        usageCount: 1,
      }),
    ]);
    expect(storedUsage()).toEqual([
      expect.objectContaining({
        ruleId: rules[0].id,
        sessionId: sessionContext.sessionId,
        actionType: 'pause',
      }),
    ]);
    expect(params.onRuleUsed).toHaveBeenCalledWith(
      expect.objectContaining({ id: rules[0].id }),
      'pause',
      undefined,
    );
    expect(params.onPause).toHaveBeenCalledOnce();
    expect(params.finishFlow).toHaveBeenCalledOnce();
    expect(feedback.showWarning).not.toHaveBeenCalled();
    expect(feedback.showErrorMessage).not.toHaveBeenCalled();
  });

  it.each(['   ', 'x'.repeat(101)])(
    'rejects invalid rule name %j without persisting or applying it',
    async (name) => {
      const { create, params } = renderCreation();

      await create(name);

      expect(storedRules()).toEqual([]);
      expect(storedUsage()).toEqual([]);
      expect(feedback.showErrorMessage.mock.calls[0]?.[0]).toBeInstanceOf(
        Error,
      );
      expect(params.onPause).not.toHaveBeenCalled();
      expect(params.finishFlow).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['pause', ExceptionRuleType.PAUSE_ONLY],
    ['early_completion', ExceptionRuleType.EARLY_COMPLETION_ONLY],
  ] as const)(
    'normalizes an unknown rule type for %s before persisting it',
    async (action, expectedType) => {
      const { create, params } = renderCreation(action);

      await create('Check the oven', 'legacy-type' as ExceptionRuleType);

      expect(storedRules()).toEqual([
        expect.objectContaining({ name: 'Check the oven', type: expectedType }),
      ]);
      expect(storedUsage()).toEqual([
        expect.objectContaining({ actionType: action }),
      ]);
      expect(params.finishFlow).toHaveBeenCalledOnce();
      expect(feedback.showErrorMessage).not.toHaveBeenCalled();
    },
  );

  it('does not pause when the exact existing rule only permits early completion', async () => {
    const existing = seedRule(ExceptionRuleType.EARLY_COMPLETION_ONLY);
    const { create, params } = renderCreation();

    await create(existing.name);

    expect(storedRules()).toEqual([
      expect.objectContaining({ id: existing.id, type: existing.type }),
    ]);
    expect(storedUsage()).toEqual([]);
    expect(feedback.showWarning).toHaveBeenCalled();
    expect(feedback.showErrorMessage).toHaveBeenCalled();
    expect(params.onPause).not.toHaveBeenCalled();
    expect(params.onRuleUsed).not.toHaveBeenCalled();
    expect(params.finishFlow).not.toHaveBeenCalled();
  });

  it('retains unreadable rule data and keeps the flow open', async () => {
    localPreferences.setExceptionRules('{invalid-json');
    const { create, params } = renderCreation();

    await create('Check the oven');

    expect(localPreferences.getExceptionRules()).toBe('{invalid-json');
    expect(storedUsage()).toEqual([]);
    expect(feedback.showErrorMessage).toHaveBeenCalled();
    expect(params.onPause).not.toHaveBeenCalled();
    expect(params.finishFlow).not.toHaveBeenCalled();
  });

  it('keeps the flow open when the persistence boundary rejects a write', async () => {
    vi.spyOn(localPreferences, 'setExceptionRules').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    const { create, params } = renderCreation();

    await create('Check the oven');

    expect(storedRules()).toEqual([]);
    expect(storedUsage()).toEqual([]);
    expect(feedback.showErrorMessage).toHaveBeenCalled();
    expect(params.onPause).not.toHaveBeenCalled();
    expect(params.onRuleUsed).not.toHaveBeenCalled();
    expect(params.finishFlow).not.toHaveBeenCalled();
  });
});
