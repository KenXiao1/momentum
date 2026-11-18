import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ExceptionRuleType,
  type ExceptionRule,
  type RuleUsageRecord,
} from '../../types';
import { LOCAL_STORAGE_KEYS } from '../../utils/local-preferences/keys';
import { localRuleStore } from '../localRuleStore';

const rule: ExceptionRule = {
  id: 'rule-1',
  name: 'Refill water',
  type: ExceptionRuleType.PAUSE_ONLY,
  scope: 'chain',
  chainId: 'chain-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  lastUsedAt: new Date('2026-01-02T00:00:00.000Z'),
  usageCount: 1,
  isActive: true,
};

const record: RuleUsageRecord = {
  id: 'record-1',
  ruleId: 'rule-1',
  chainId: 'chain-1',
  sessionId: 'session-1',
  usedAt: new Date('2026-01-02T00:00:00.000Z'),
  actionType: 'pause',
  taskElapsedTime: 60,
  ruleScope: 'chain',
};

describe('localRuleStore', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('starts empty and round-trips rules and usage with dates', async () => {
    expect(await localRuleStore.getRules()).toEqual([]);
    expect(await localRuleStore.getUsageRecords()).toEqual([]);

    await localRuleStore.saveRules([rule]);
    await localRuleStore.saveUsageRecords([record]);

    expect(await localRuleStore.getRules()).toEqual([rule]);
    expect(await localRuleStore.getUsageRecords()).toEqual([record]);
  });

  it.each([
    [
      'infers chain scope from a chain id',
      { chainId: 'c' },
      { scope: 'chain', chainId: 'c' },
    ],
    [
      'defaults to global without one',
      { chainId: '  ' },
      { scope: 'global', chainId: undefined },
    ],
    [
      'drops the chain id of a global rule',
      { scope: 'global', chainId: 'c' },
      { scope: 'global', chainId: undefined },
    ],
  ])('%s for legacy data', async (_label, stored, expected) => {
    const { scope: _scope, chainId: _chainId, ...base } = rule;
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.EXCEPTION_RULES,
      JSON.stringify([{ ...base, ...stored }]),
    );

    expect((await localRuleStore.getRules())[0]).toMatchObject(expected);
  });

  it('throws on unreadable data instead of reporting no rules', async () => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.EXCEPTION_RULES, '{not json');

    await expect(localRuleStore.getRules()).rejects.toThrow(SyntaxError);
  });

  it('lets a rejected browser write surface', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    await expect(localRuleStore.saveRules([rule])).rejects.toThrow(
      'Quota exceeded',
    );
  });
});
