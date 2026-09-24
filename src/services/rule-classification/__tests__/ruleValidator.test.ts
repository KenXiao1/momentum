import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EnhancedExceptionRuleException,
  ExceptionRuleError,
  ExceptionRuleType,
  type ExceptionRule,
} from '../../../types';
import { validateRuleForAction } from '../ruleValidator';
import {
  validateRuleTypeForAction,
  type RuleActionType,
} from '../RuleTypeValidator';

const storage = vi.hoisted(() => ({
  getRuleById: vi.fn<(ruleId: string) => Promise<ExceptionRule | null>>(),
}));

vi.mock('../../ExceptionRuleStorage', () => ({
  exceptionRuleStorage: storage,
}));

function makeRule(overrides: Partial<ExceptionRule> = {}): ExceptionRule {
  return {
    id: 'rule-1',
    name: 'Bathroom break',
    type: ExceptionRuleType.PAUSE_ONLY,
    scope: 'global',
    createdAt: new Date('2026-09-20T12:00:00.000Z'),
    usageCount: 0,
    isActive: true,
    ...overrides,
  };
}

function legacyRule(): ExceptionRule {
  // The repair boundary accepts persisted records from before type was required.
  const { type: _type, ...persisted } = makeRule();
  return persisted as ExceptionRule;
}

describe('validateRuleForAction recovery contract', () => {
  const fixRuleTypeIssues =
    vi.fn<Parameters<typeof validateRuleForAction>[0]['fixRuleTypeIssues']>();
  const validate = (actionType: RuleActionType = 'pause') =>
    validateRuleForAction({
      ruleId: 'rule-1',
      actionType,
      validateRuleTypeForAction,
      fixRuleTypeIssues,
    });

  beforeEach(() => {
    vi.resetAllMocks();
    storage.getRuleById.mockResolvedValue(makeRule());
    fixRuleTypeIssues.mockResolvedValue({
      fixed: false,
      issues: [],
      actions: [],
    });
  });

  it('accepts an active matching rule without rewriting it', async () => {
    await expect(validate()).resolves.toBeUndefined();
    expect(storage.getRuleById).toHaveBeenCalledExactlyOnceWith('rule-1');
    expect(fixRuleTypeIssues).not.toHaveBeenCalled();
  });

  it('distinguishes a missing rule and provides replacement actions', async () => {
    storage.getRuleById.mockResolvedValue(null);

    await expect(validate()).rejects.toMatchObject({
      type: ExceptionRuleError.RULE_NOT_FOUND,
      message: '规则 ID rule-1 不存在',
      userMessage: '找不到指定的规则，可能已被删除',
      context: { ruleId: 'rule-1', actionType: 'pause' },
      suggestedActions: ['创建新规则', '选择其他规则'],
      recoverable: true,
    });
    expect(fixRuleTypeIssues).not.toHaveBeenCalled();
  });

  it('rejects a deactivated rule with an option to restore it', async () => {
    const rule = makeRule({ isActive: false });
    storage.getRuleById.mockResolvedValue(rule);

    await expect(validate()).rejects.toMatchObject({
      type: ExceptionRuleError.RULE_NOT_FOUND,
      message: '规则 "Bathroom break" 已被删除',
      userMessage: '规则已被删除或停用',
      context: { rule, actionType: 'pause' },
      suggestedActions: ['选择其他规则', '恢复规则'],
    });
    expect(fixRuleTypeIssues).not.toHaveBeenCalled();
  });

  it.each([
    {
      ruleType: ExceptionRuleType.PAUSE_ONLY,
      actionType: 'early_completion' as const,
      expectedType: '提前完成',
      actualType: '暂停',
      message: '规则 "Bathroom break" 是暂停类型，不能用于提前完成操作',
    },
    {
      ruleType: ExceptionRuleType.EARLY_COMPLETION_ONLY,
      actionType: 'pause' as const,
      expectedType: '暂停',
      actualType: '提前完成',
      message: '规则 "Bathroom break" 是提前完成类型，不能用于暂停计时操作',
    },
  ])(
    'rejects $ruleType for $actionType with the correct alternatives',
    async ({ ruleType, actionType, expectedType, actualType, message }) => {
      const rule = makeRule({ type: ruleType });
      storage.getRuleById.mockResolvedValue(rule);

      await expect(validate(actionType)).rejects.toMatchObject({
        type: ExceptionRuleError.RULE_TYPE_MISMATCH,
        message,
        userMessage: '规则类型与操作不匹配',
        context: { rule, actionType, expectedType, actualType },
        suggestedActions: [
          `创建${expectedType}类型的规则`,
          `选择${expectedType}类型的规则`,
        ],
      });
    },
  );

  it('re-reads a repaired legacy rule and uses its persisted type', async () => {
    const rule = legacyRule();
    storage.getRuleById
      .mockResolvedValueOnce(rule)
      .mockResolvedValueOnce(
        makeRule({ type: ExceptionRuleType.EARLY_COMPLETION_ONLY }),
      );
    fixRuleTypeIssues.mockResolvedValue({
      fixed: true,
      issues: ['missing type'],
      actions: ['restored early completion type'],
    });

    await expect(validate('early_completion')).resolves.toBeUndefined();
    expect(fixRuleTypeIssues).toHaveBeenCalledExactlyOnceWith('rule-1');
    expect(storage.getRuleById).toHaveBeenCalledTimes(2);
    expect(rule.type).toBe(ExceptionRuleType.EARLY_COMPLETION_ONLY);
  });

  it.each(['repair-failed', 'disappeared', 'still-missing-type'] as const)(
    'keeps the rule unusable when legacy repair is %s',
    async (result) => {
      const rule = legacyRule();
      storage.getRuleById.mockResolvedValueOnce(rule);
      fixRuleTypeIssues.mockResolvedValue({
        fixed: result !== 'repair-failed',
        issues: [],
        actions: [],
      });
      storage.getRuleById.mockResolvedValueOnce(
        result === 'disappeared' ? null : legacyRule(),
      );

      await expect(validate()).rejects.toMatchObject({
        type: ExceptionRuleError.INVALID_RULE_TYPE,
        message: '规则 "Bathroom break" 缺少类型定义',
        userMessage: '规则类型缺失，无法使用',
        context: { rule, actionType: 'pause' },
        suggestedActions: ['修复规则类型', '选择其他规则'],
      });
      expect(fixRuleTypeIssues).toHaveBeenCalledExactlyOnceWith('rule-1');
      expect(storage.getRuleById).toHaveBeenCalledTimes(
        result === 'repair-failed' ? 1 : 2,
      );
    },
  );

  it.each([
    {
      error: new Error('database unavailable'),
      message: 'database unavailable',
    },
    { error: 'network disconnected', message: '未知错误' },
  ])(
    'turns unexpected storage errors into a recoverable error ($message)',
    async ({ error, message }) => {
      storage.getRuleById.mockRejectedValue(error);

      await expect(validate()).rejects.toMatchObject({
        type: ExceptionRuleError.VALIDATION_ERROR,
        message,
        userMessage: '规则验证过程中发生错误',
        context: { ruleId: 'rule-1', actionType: 'pause', error },
        suggestedActions: ['重试操作', '选择其他规则'],
        recoverable: true,
      });
    },
  );

  it('preserves a classified storage error and its recovery guidance', async () => {
    const error = EnhancedExceptionRuleException.createCritical(
      ExceptionRuleError.DATA_INTEGRITY_ERROR,
      'Corrupt rules require recovery',
    );
    storage.getRuleById.mockRejectedValue(error);
    await expect(validate()).rejects.toBe(error);
  });
});
