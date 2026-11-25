import { describe, expect, it } from 'vitest';
import {
  ExceptionRuleError,
  ExceptionRuleType,
  type ExceptionRule,
} from '../../types';
import {
  assertRuleUsableForAction,
  findExactDuplicates,
  findSimilarRules,
  mergeRuleData,
  ruleTypeForAction,
  suggestRuleNames,
  validateRuleInput,
} from '../rules';

function rule(
  id: string,
  name: string,
  overrides: Partial<ExceptionRule> = {},
) {
  return {
    id,
    name,
    type: ExceptionRuleType.PAUSE_ONLY,
    scope: 'global',
    createdAt: new Date(0),
    usageCount: 0,
    isActive: true,
    ...overrides,
  } as ExceptionRule;
}

function errorType(run: () => void): string | undefined {
  try {
    run();
    return undefined;
  } catch (error) {
    return (error as { type: string }).type;
  }
}

describe('validateRuleInput', () => {
  it.each([
    [{ name: 'Water', type: ExceptionRuleType.PAUSE_ONLY }, true, undefined],
    [
      { name: 'x'.repeat(100), type: ExceptionRuleType.PAUSE_ONLY },
      true,
      undefined,
    ],
    [
      { type: ExceptionRuleType.PAUSE_ONLY },
      true,
      ExceptionRuleError.VALIDATION_ERROR,
    ],
    [{ name: 'Water' }, true, ExceptionRuleError.VALIDATION_ERROR],
    [{}, false, undefined],
    [{ name: '  ' }, false, ExceptionRuleError.VALIDATION_ERROR],
    [{ name: 'x'.repeat(101) }, false, ExceptionRuleError.VALIDATION_ERROR],
    [
      { type: 'nope' as ExceptionRuleType },
      false,
      ExceptionRuleError.INVALID_RULE_TYPE,
    ],
    [{ description: 'x'.repeat(500) }, false, undefined],
    [
      { description: 'x'.repeat(501) },
      false,
      ExceptionRuleError.VALIDATION_ERROR,
    ],
  ])('%j (creating: %s) → %s', (input, creating, expected) => {
    expect(errorType(() => validateRuleInput(input, creating))).toBe(expected);
  });
});

describe('name matching', () => {
  const rules = [
    rule('a', 'Refill water'),
    rule('b', 'refill-WATER', { isActive: false }),
    rule('c', 'Answer door'),
  ];

  it('finds active exact matches ignoring case, spaces and punctuation', () => {
    expect(
      findExactDuplicates(rules, ' REFILL, water ').map((r) => r.id),
    ).toEqual(['a']);
    expect(findExactDuplicates(rules, 'Refill water', 'a')).toEqual([]);
  });

  it('finds similar but not identical active names, most similar first', () => {
    expect(findSimilarRules(rules, 'Refill waters').map((r) => r.id)).toEqual([
      'a',
    ]);
    expect(findSimilarRules(rules, 'Refill water')).toEqual([]);
    expect(findSimilarRules(rules, 'Something else')).toEqual([]);
  });

  it('suggests the first three free numbered names', () => {
    expect(
      suggestRuleNames('Answer door', [...rules, rule('d', 'answer door 3')]),
    ).toEqual(['Answer door 2', 'Answer door 4', 'Answer door 5']);
  });
});

describe('assertRuleUsableForAction', () => {
  const pause = rule('p', 'Pause');
  const early = rule('e', 'Early', {
    type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
  });

  it.each([
    [pause, 'pause', undefined],
    [early, 'early_completion', undefined],
    [undefined, 'pause', ExceptionRuleError.RULE_NOT_FOUND],
    [{ ...pause, isActive: false }, 'pause', ExceptionRuleError.RULE_NOT_FOUND],
    [pause, 'early_completion', ExceptionRuleError.RULE_TYPE_MISMATCH],
    [early, 'pause', ExceptionRuleError.RULE_TYPE_MISMATCH],
  ] as const)('%#: %s for %s', (candidate, action, expected) => {
    expect(
      errorType(() => assertRuleUsableForAction(candidate, 'id', action)),
    ).toBe(expected);
  });

  it('maps each action to the rule type that allows it', () => {
    expect(ruleTypeForAction('pause')).toBe(ExceptionRuleType.PAUSE_ONLY);
    expect(ruleTypeForAction('early_completion')).toBe(
      ExceptionRuleType.EARLY_COMPLETION_ONLY,
    );
  });
});

describe('mergeRuleData', () => {
  const usage = (id: string, ruleId: string) => ({
    id,
    ruleId,
    chainId: 'chain-1',
    sessionId: 'session-1',
    usedAt: new Date('2026-01-02T00:00:00.000Z'),
    actionType: 'pause' as const,
    taskElapsedTime: 60,
    ruleScope: 'global' as const,
  });

  it('adds new rules and records and keeps base rules first', () => {
    const merged = mergeRuleData(
      { rules: [rule('a', 'Phone call')], usageRecords: [usage('u1', 'a')] },
      { rules: [rule('b', 'Doorbell')], usageRecords: [usage('u2', 'b')] },
    );

    expect(merged.rules.map((item) => item.id)).toEqual(['a', 'b']);
    expect(merged.usageRecords.map((item) => item.id)).toEqual(['u1', 'u2']);
    expect(merged.changed).toBe(true);
  });

  it('treats a same-named rule of the same type and scope as the same rule', () => {
    const merged = mergeRuleData(
      { rules: [rule('a', 'Phone call')], usageRecords: [] },
      {
        rules: [
          rule('b', '  phone CALL '),
          rule('c', 'Phone call', {
            type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
          }),
          rule('d', 'Phone call', { scope: 'chain', chainId: 'chain-1' }),
        ],
        usageRecords: [usage('u1', 'b')],
      },
    );

    expect(merged.rules.map((item) => item.id)).toEqual(['a', 'c', 'd']);
    expect(merged.usageRecords).toMatchObject([{ id: 'u1', ruleId: 'a' }]);
  });

  it('reports no change when everything incoming is already present', () => {
    const base = {
      rules: [rule('a', 'Phone call')],
      usageRecords: [usage('u1', 'a')],
    };

    expect(mergeRuleData(base, base).changed).toBe(false);
  });
});
