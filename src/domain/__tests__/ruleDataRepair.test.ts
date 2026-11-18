import { describe, expect, it } from 'vitest';
import {
  ExceptionRuleType,
  type ExceptionRule,
  type RuleUsageRecord,
} from '../../types';
import { repairRuleData } from '../rules';

const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');
const USED_AT = new Date('2026-01-02T00:00:00.000Z');

function rule(overrides: Record<string, unknown> = {}): ExceptionRule {
  return {
    id: 'rule-1',
    name: 'Take a break',
    type: ExceptionRuleType.PAUSE_ONLY,
    scope: 'global',
    createdAt: CREATED_AT,
    usageCount: 0,
    isActive: true,
    ...overrides,
  } as ExceptionRule;
}

function record(overrides: Record<string, unknown> = {}): RuleUsageRecord {
  return {
    id: 'record-1',
    ruleId: 'rule-1',
    chainId: 'chain-1',
    sessionId: 'session-1',
    usedAt: USED_AT,
    actionType: 'pause',
    taskElapsedTime: 60,
    ...overrides,
  } as RuleUsageRecord;
}

function idGenerator() {
  let next = 0;
  return () => `new-${++next}`;
}

describe('repairRuleData', () => {
  it('returns valid data unchanged with no repairs', () => {
    const rules = [rule(), rule({ id: 'rule-2', name: 'Stop early' })];
    const records = [record()];

    expect(repairRuleData(rules, records, idGenerator())).toEqual({
      rules,
      usageRecords: records,
      repairCount: 0,
    });
  });

  it.each([
    ['a missing type', { type: undefined }, { type: 'pause_only' }],
    ['an unknown type', { type: 'bogus' }, { type: 'pause_only' }],
    ['a negative usage count', { usageCount: -3 }, { usageCount: 0 }],
    ['a non-numeric usage count', { usageCount: '4' }, { usageCount: 0 }],
    ['a missing id', { id: undefined }, { id: 'new-1' }],
    ['an empty id', { id: '' }, { id: 'new-1' }],
  ])('defaults %s', (_label, broken, expected) => {
    const result = repairRuleData([rule(broken)], [], idGenerator());

    expect(result.rules[0]).toMatchObject(expected);
    expect(result.repairCount).toBe(1);
  });

  it('replaces an invalid creation date', () => {
    const result = repairRuleData(
      [rule({ createdAt: new Date('not a date') })],
      [],
      idGenerator(),
    );

    expect(Number.isNaN(result.rules[0].createdAt.getTime())).toBe(false);
    expect(result.repairCount).toBe(1);
  });

  it('re-keys an id containing spaces and moves its usage records along', () => {
    const result = repairRuleData(
      [rule({ id: 'bad id' })],
      [record({ ruleId: 'bad id' })],
      idGenerator(),
    );

    expect(result.rules[0].id).toBe('new-1');
    expect(result.usageRecords).toEqual([record({ ruleId: 'new-1' })]);
    expect(result.repairCount).toBe(2);
  });

  it('gives a later duplicate id a new id and leaves usage with the first rule', () => {
    const result = repairRuleData(
      [rule(), rule({ name: 'Other' })],
      [record()],
      idGenerator(),
    );

    expect(result.rules.map((r) => r.id)).toEqual(['rule-1', 'new-1']);
    expect(result.usageRecords).toEqual([record()]);
    expect(result.repairCount).toBe(1);
  });

  it('numbers later active rules that share a name, ignoring case and inactive rules', () => {
    const result = repairRuleData(
      [
        rule({ id: 'a', name: 'Break' }),
        rule({ id: 'b', name: ' break ', isActive: false }),
        rule({ id: 'c', name: 'BREAK' }),
        rule({ id: 'd', name: 'break' }),
      ],
      [],
      idGenerator(),
    );

    expect(result.rules.map((r) => r.name)).toEqual([
      'Break',
      ' break ',
      'BREAK (2)',
      'break (3)',
    ]);
    expect(result.repairCount).toBe(2);
  });

  it('allows the same name across scopes and chains', () => {
    const rules = [
      rule({ id: 'g', name: 'Water' }),
      rule({ id: 'c1', name: 'Water', scope: 'chain', chainId: 'chain-1' }),
      rule({ id: 'c2', name: 'Water', scope: 'chain', chainId: 'chain-2' }),
    ];

    expect(repairRuleData(rules, [], idGenerator())).toEqual({
      rules,
      usageRecords: [],
      repairCount: 0,
    });
  });

  it('leaves a rule without a name untouched', () => {
    const nameless = rule({ name: undefined });

    expect(repairRuleData([nameless], [], idGenerator())).toEqual({
      rules: [nameless],
      usageRecords: [],
      repairCount: 0,
    });
  });

  it('drops usage records whose rule no longer exists', () => {
    const result = repairRuleData(
      [rule()],
      [record(), record({ id: 'record-2', ruleId: 'gone' })],
      idGenerator(),
    );

    expect(result.usageRecords).toEqual([record()]);
    expect(result.repairCount).toBe(1);
  });

  it('replaces an invalid usage time', () => {
    const result = repairRuleData(
      [rule()],
      [record({ usedAt: new Date('not a date') })],
      idGenerator(),
    );

    expect(Number.isNaN(result.usageRecords[0].usedAt.getTime())).toBe(false);
    expect(result.repairCount).toBe(1);
  });
});
