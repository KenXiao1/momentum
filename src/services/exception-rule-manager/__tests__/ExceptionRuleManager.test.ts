import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryRuleStore } from '../../../test/fakes/memoryRuleStore';
import {
  ExceptionRuleError,
  ExceptionRuleType,
  type ExceptionRule,
  type SessionContext,
} from '../../../types';
import { localPreferences } from '../../../utils/localPreferences';
import { ExceptionRuleManager } from '../ExceptionRuleManager';

const NOW = new Date('2026-03-01T09:00:00.000Z');
const PAUSE = ExceptionRuleType.PAUSE_ONLY;
const EARLY = ExceptionRuleType.EARLY_COMPLETION_ONLY;

const session: SessionContext = {
  sessionId: 'session-1',
  chainId: 'chain-1',
  chainName: 'Deep work',
  startedAt: NOW,
  elapsedTime: 600,
  remainingTime: 1200,
  isDurationless: false,
};

function storedRule(overrides: Partial<ExceptionRule> = {}): ExceptionRule {
  return {
    id: 'rule-1',
    name: 'Refill water',
    type: PAUSE,
    scope: 'global',
    createdAt: NOW,
    usageCount: 0,
    isActive: true,
    ...overrides,
  };
}

function setup(rules: ExceptionRule[] = []) {
  const store = createMemoryRuleStore({ rules });
  let next = 0;
  const manager = new ExceptionRuleManager(
    store,
    () => `id-${++next}`,
    () => NOW,
  );
  return { store, manager };
}

function rejectionType(promise: Promise<unknown>) {
  return promise.then(
    () => 'resolved',
    (error: { type?: string }) => error.type,
  );
}

describe('ExceptionRuleManager', () => {
  beforeEach(() => {
    localPreferences.setLanguage('en');
  });

  describe('createRule', () => {
    it('saves a trimmed global rule without warnings', async () => {
      const { store, manager } = setup();

      const result = await manager.createRule('  Refill water ', PAUSE, '  ');

      expect(result).toEqual({
        rule: {
          id: 'id-1',
          name: 'Refill water',
          type: PAUSE,
          description: undefined,
          scope: 'global',
          createdAt: NOW,
          usageCount: 0,
          isActive: true,
        },
        warnings: [],
      });
      expect(store.rules).toEqual([result.rule]);
    });

    it('rejects a name matching an active rule ignoring case and punctuation', async () => {
      const { store, manager } = setup([storedRule()]);

      expect(
        await rejectionType(manager.createRule('refill, WATER!', PAUSE)),
      ).toBe(ExceptionRuleError.DUPLICATE_RULE_NAME);
      expect(store.rules).toHaveLength(1);
    });

    it('allows reusing the name of a deleted rule', async () => {
      const { store, manager } = setup([storedRule({ isActive: false })]);

      await manager.createRule('Refill water', PAUSE);

      expect(store.rules).toHaveLength(2);
    });

    it('returns the existing rule when reuse is requested, preferring the same type', async () => {
      const early = storedRule({ id: 'early', type: EARLY });
      const pause = storedRule({ id: 'pause', scope: 'chain', chainId: 'c' });
      const { store, manager } = setup([early, pause]);

      const same = await manager.createRule('Refill water', PAUSE, undefined, {
        reuseExisting: true,
      });
      expect(same).toEqual({ rule: pause, warnings: [] });

      const { manager: other } = setup([early]);
      const mismatched = await other.createRule(
        'Refill water',
        PAUSE,
        undefined,
        { reuseExisting: true },
      );
      expect(mismatched.rule).toEqual(early);
      expect(mismatched.warnings).toHaveLength(1);
      expect(store.rules).toHaveLength(2);
    });

    it('creates a similar name and warns about the existing one', async () => {
      const { store, manager } = setup([storedRule()]);

      const result = await manager.createRule('Refill waters', PAUSE);

      expect(result.rule.name).toBe('Refill waters');
      expect(result.warnings).toEqual([
        expect.stringContaining('Refill water'),
      ]);
      expect(store.rules).toHaveLength(2);
    });

    it.each([
      ['an empty name', '   ', PAUSE, ExceptionRuleError.VALIDATION_ERROR],
      [
        'a 101-char name',
        'x'.repeat(101),
        PAUSE,
        ExceptionRuleError.VALIDATION_ERROR,
      ],
      [
        'an unknown type',
        'Ok',
        'bogus' as ExceptionRuleType,
        ExceptionRuleError.INVALID_RULE_TYPE,
      ],
    ])('rejects %s without saving', async (_label, name, type, errorType) => {
      const { store, manager } = setup();

      expect(await rejectionType(manager.createRule(name, type))).toBe(
        errorType,
      );
      expect(store.rules).toEqual([]);
    });

    it('rejects a description over 500 characters', async () => {
      const { manager } = setup();

      expect(
        await rejectionType(manager.createRule('Ok', PAUSE, 'x'.repeat(501))),
      ).toBe(ExceptionRuleError.VALIDATION_ERROR);
    });

    it('reports a failed write as a storage error', async () => {
      const { store, manager } = setup();
      await manager.initialize();
      store.failNextWrite();

      expect(await rejectionType(manager.createRule('Ok', PAUSE))).toBe(
        ExceptionRuleError.STORAGE_ERROR,
      );
      expect(store.rules).toEqual([]);
    });
  });

  describe('createChainRule', () => {
    it('saves a rule scoped to the chain', async () => {
      const { store, manager } = setup();

      const { rule } = await manager.createChainRule(
        'chain-1',
        'Stretch',
        EARLY,
      );

      expect(rule).toMatchObject({
        scope: 'chain',
        chainId: 'chain-1',
        type: EARLY,
      });
      expect(store.rules).toEqual([rule]);
    });

    it('rejects a duplicate only within the same chain', async () => {
      const { store, manager } = setup([
        storedRule({ scope: 'chain', chainId: 'chain-1', name: 'Stretch' }),
        storedRule({ id: 'g', name: 'Water' }),
      ]);

      expect(
        await rejectionType(
          manager.createChainRule('chain-1', 'stretch', PAUSE),
        ),
      ).toBe(ExceptionRuleError.DUPLICATE_RULE_NAME);
      await manager.createChainRule('chain-2', 'Stretch', PAUSE);
      await manager.createChainRule('chain-1', 'Water', PAUSE);
      expect(store.rules).toHaveLength(4);
    });

    it('requires a chain id', async () => {
      const { manager } = setup();

      expect(
        await rejectionType(manager.createChainRule(' ', 'Stretch', PAUSE)),
      ).toBe(ExceptionRuleError.VALIDATION_ERROR);
    });
  });

  describe('updateRule', () => {
    it('saves the changed fields and keeps the rest', async () => {
      const { store, manager } = setup([storedRule({ usageCount: 3 })]);

      const result = await manager.updateRule('rule-1', {
        name: ' Refill bottle ',
        type: EARLY,
        description: 'Kitchen',
      });

      expect(result).toEqual({
        rule: storedRule({
          name: 'Refill bottle',
          type: EARLY,
          description: 'Kitchen',
          usageCount: 3,
        }),
        warnings: [],
      });
      expect(store.rules).toEqual([result.rule]);
    });

    it('allows keeping its own name and rejects another rule’s name', async () => {
      const { store, manager } = setup([
        storedRule(),
        storedRule({ id: 'rule-2', name: 'Answer door' }),
      ]);

      await manager.updateRule('rule-1', { name: 'Refill water' });
      expect(
        await rejectionType(
          manager.updateRule('rule-1', { name: 'answer DOOR' }),
        ),
      ).toBe(ExceptionRuleError.DUPLICATE_RULE_NAME);
      expect(store.rules[0].name).toBe('Refill water');
    });

    it('warns about a similar name while saving', async () => {
      const { manager } = setup([
        storedRule(),
        storedRule({ id: 'rule-2', name: 'Answer door' }),
      ]);

      const result = await manager.updateRule('rule-1', {
        name: 'Answer doors',
      });

      expect(result.warnings).toEqual([expect.stringContaining('Answer door')]);
    });

    it('rejects an unknown id', async () => {
      const { manager } = setup();

      expect(
        await rejectionType(manager.updateRule('nope', { name: 'X' })),
      ).toBe(ExceptionRuleError.RULE_NOT_FOUND);
    });
  });

  describe('deleteRule', () => {
    it('deactivates the rule and keeps it stored', async () => {
      const { store, manager } = setup([storedRule()]);

      await manager.deleteRule('rule-1');

      expect(store.rules).toEqual([storedRule({ isActive: false })]);
    });

    it('rejects an unknown id', async () => {
      const { manager } = setup();

      expect(await rejectionType(manager.deleteRule('nope'))).toBe(
        ExceptionRuleError.RULE_NOT_FOUND,
      );
    });
  });

  describe('useRule', () => {
    it('records the use and bumps the rule counters', async () => {
      const { store, manager } = setup([storedRule({ usageCount: 2 })]);

      const result = await manager.useRule('rule-1', session, 'pause', {
        duration: 300,
        autoResume: true,
      });

      const record = {
        id: 'id-1',
        ruleId: 'rule-1',
        chainId: 'chain-1',
        sessionId: 'session-1',
        usedAt: NOW,
        actionType: 'pause',
        taskElapsedTime: 600,
        taskRemainingTime: 1200,
        pauseDuration: 300,
        autoResume: true,
        ruleScope: 'global',
      };
      expect(result.record).toEqual(record);
      expect(store.usageRecords).toEqual([record]);
      expect(store.rules).toEqual([
        storedRule({ usageCount: 3, lastUsedAt: NOW }),
      ]);
    });

    it.each([
      ['a missing rule', [], 'pause', ExceptionRuleError.RULE_NOT_FOUND],
      [
        'a deleted rule',
        [storedRule({ isActive: false })],
        'pause',
        ExceptionRuleError.RULE_NOT_FOUND,
      ],
      [
        'a pause rule for early completion',
        [storedRule()],
        'early_completion',
        ExceptionRuleError.RULE_TYPE_MISMATCH,
      ],
      [
        'an early rule for pausing',
        [storedRule({ type: EARLY })],
        'pause',
        ExceptionRuleError.RULE_TYPE_MISMATCH,
      ],
    ] as const)(
      'refuses %s and records nothing',
      async (_label, rules, action, errorType) => {
        const { store, manager } = setup([...rules]);

        expect(
          await rejectionType(manager.useRule('rule-1', session, action)),
        ).toBe(errorType);
        expect(store.usageRecords).toEqual([]);
      },
    );
  });

  describe('import and export', () => {
    it('exports active rules, with usage only when asked', async () => {
      const { manager } = setup([
        storedRule(),
        storedRule({ id: 'gone', name: 'Gone', isActive: false }),
      ]);
      await manager.useRule('rule-1', session, 'pause');

      const withoutUsage = await manager.exportRules();
      expect(withoutUsage).toEqual({
        rules: [expect.objectContaining({ id: 'rule-1' })],
        usageRecords: undefined,
        exportedAt: NOW,
        summary: { totalRules: 1, totalUsageRecords: 0 },
      });
      const withUsage = await manager.exportRules(true);
      expect(withUsage.summary).toEqual({
        totalRules: 1,
        totalUsageRecords: 1,
      });
    });

    it('imports new rules and reports duplicates per option', async () => {
      const incoming = [
        { name: 'Refill water', type: EARLY, description: 'new' },
        { name: 'Answer door', type: PAUSE },
        { name: ' ', type: PAUSE },
      ];

      const strict = setup([storedRule()]);
      const strictResult = await strict.manager.importRules(incoming);
      expect(strictResult.imported.map((rule) => rule.name)).toEqual([
        'Answer door',
      ]);
      expect(strictResult.errors.map((error) => error.name)).toEqual([
        'Refill water',
        ' ',
      ]);

      const skipping = setup([storedRule()]);
      const skipResult = await skipping.manager.importRules(incoming, {
        skipDuplicates: true,
      });
      expect(skipResult.skipped).toEqual([
        { name: 'Refill water', reason: 'Rule name already exists' },
      ]);

      const updating = setup([storedRule()]);
      await updating.manager.importRules(incoming, { updateExisting: true });
      expect(updating.store.rules).toEqual([
        storedRule({ type: EARLY, description: 'new' }),
        expect.objectContaining({ name: 'Answer door', scope: 'global' }),
      ]);
    });

    it('treats a name repeated within one import as a duplicate', async () => {
      const { store, manager } = setup();

      const result = await manager.importRules(
        [
          { name: 'Water', type: PAUSE },
          { name: 'water', type: PAUSE },
        ],
        { skipDuplicates: true },
      );

      expect(result.skipped).toHaveLength(1);
      expect(store.rules).toHaveLength(1);
    });
  });

  describe('initialize', () => {
    it('repairs stored data once before the first operation', async () => {
      const { store, manager } = setup([
        storedRule({ type: 'bogus' as ExceptionRuleType }),
      ]);

      expect(await manager.getAllRules()).toEqual([storedRule()]);
      expect(store.rules).toEqual([storedRule()]);
    });

    it('retries repair after a failure', async () => {
      const { store, manager } = setup([storedRule({ usageCount: -1 })]);
      store.failNextWrite();

      expect(await rejectionType(manager.getAllRules())).toBe(
        ExceptionRuleError.STORAGE_ERROR,
      );
      expect(await manager.getAllRules()).toEqual([storedRule()]);
    });
  });

  it('runs concurrent writes one after another so none is lost', async () => {
    const { store, manager } = setup();

    await Promise.all([
      manager.createRule('One', PAUSE),
      manager.createRule('Two', PAUSE),
      manager.createChainRule('chain-1', 'Three', PAUSE),
    ]);

    expect(store.rules.map((rule) => rule.name)).toEqual([
      'One',
      'Two',
      'Three',
    ]);
  });

  it('suggests numbered names that are free', async () => {
    const { manager } = setup([
      storedRule({ name: 'Water' }),
      storedRule({ id: 'b', name: 'Water 2' }),
    ]);

    expect(await manager.suggestRuleNames('Water')).toEqual([
      'Water 3',
      'Water 4',
      'Water 5',
    ]);
  });

  describe('setStore', () => {
    it('lets a queued operation finish on the store it started with', async () => {
      const { store: first, manager } = setup([storedRule()]);
      const second = createMemoryRuleStore({
        rules: [storedRule({ id: 'cloud-1', name: 'Cloud rule' })],
      });

      const created = manager.createRule('Stretch', PAUSE);
      manager.setStore(second);
      await created;

      expect(first.rules.map((rule) => rule.name)).toEqual([
        'Refill water',
        'Stretch',
      ]);
      expect(second.rules.map((rule) => rule.name)).toEqual(['Cloud rule']);
      await expect(manager.getAllRules()).resolves.toMatchObject([
        { name: 'Cloud rule' },
      ]);
    });
  });
});
