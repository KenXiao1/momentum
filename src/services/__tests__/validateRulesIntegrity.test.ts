import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ExceptionRuleError,
  ExceptionRuleException,
  ExceptionRuleType,
  type ExceptionRule,
} from '../../types';

const exceptionRuleStorageMock = vi.hoisted(() => ({
  getRules: vi.fn(),
}));

vi.mock('../ExceptionRuleStorage', () => ({
  exceptionRuleStorage: exceptionRuleStorageMock,
}));

import { validateRulesIntegrity } from '../validateRulesIntegrity';

function createRule(overrides: Partial<ExceptionRule> = {}): ExceptionRule {
  return {
    id: 'rule-1',
    name: 'Focus rule',
    type: ExceptionRuleType.PAUSE_ONLY,
    scope: 'global',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    usageCount: 0,
    isActive: true,
    ...overrides,
  };
}

describe('validateRulesIntegrity', () => {
  beforeEach(() => {
    exceptionRuleStorageMock.getRules.mockReset();
  });

  it('runs the real integrity validator over supplied rules', async () => {
    const validRule = createRule();
    const invalidRule = createRule({
      id: '',
      name: ' ',
      type: '' as ExceptionRuleType,
      createdAt: undefined as unknown as Date,
      usageCount: -1,
    });

    const report = await validateRulesIntegrity([validRule, invalidRule]);

    expect(report).toMatchObject({
      totalRules: 2,
      validRules: 1,
      summary: '验证了 2 个规则，1 个有效，5 个问题',
    });
    expect(report.invalidRules).toHaveLength(5);
    expect(report.invalidRules.map(({ issue }) => issue)).toEqual([
      '缺少规则ID',
      '规则名称为空',
      '缺少规则类型',
      '缺少创建时间',
      '使用计数无效',
    ]);
    expect(exceptionRuleStorageMock.getRules).not.toHaveBeenCalled();
  });

  it('loads rules through the storage boundary when none are supplied', async () => {
    const storedRules = [
      createRule(),
      createRule({
        id: 'completion-rule',
        type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
      }),
    ];
    exceptionRuleStorageMock.getRules.mockResolvedValue(storedRules);

    const report = await validateRulesIntegrity();

    expect(report).toEqual({
      totalRules: 2,
      validRules: 2,
      invalidRules: [],
      summary: '验证了 2 个规则，2 个有效，0 个问题',
    });
    expect(exceptionRuleStorageMock.getRules).toHaveBeenCalledTimes(1);
  });

  it('wraps integrity-storage failures as validation errors', async () => {
    exceptionRuleStorageMock.getRules.mockRejectedValue(
      new Error('rules table unavailable'),
    );

    const promise = validateRulesIntegrity();

    await expect(promise).rejects.toBeInstanceOf(ExceptionRuleException);
    await expect(promise).rejects.toMatchObject({
      type: ExceptionRuleError.VALIDATION_ERROR,
      message: '批量验证失败: rules table unavailable',
    });
  });
});
