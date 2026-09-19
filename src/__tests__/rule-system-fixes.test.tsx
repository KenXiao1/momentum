import { RuleSearchOptimizer } from '../utils/ruleSearchOptimizer';
import { ExceptionRuleType } from '../types';
import type { ExceptionRule } from '../types';

const createRule = (overrides: Partial<ExceptionRule> = {}): ExceptionRule => ({
  id: 'rule-1',
  name: 'Take a short break',
  chainId: 'chain-1',
  scope: 'chain',
  type: ExceptionRuleType.PAUSE_ONLY,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  usageCount: 1,
  isActive: true,
  ...overrides,
});

describe('Rule System Fixes', () => {
  it('handles non-string names without throwing', () => {
    const optimizer = new RuleSearchOptimizer();
    const problematicRules = [
      createRule({ id: 'rule-1', name: null as unknown as string }),
      createRule({ id: 'rule-2', name: undefined as unknown as string }),
      createRule({ id: 'rule-3', name: 123 as unknown as string }),
    ];

    expect(() => optimizer.updateIndex(problematicRules)).not.toThrow();
    expect(() =>
      optimizer.searchRules(problematicRules, 'break'),
    ).not.toThrow();
    expect(() =>
      optimizer.detectDuplicates('break', problematicRules),
    ).not.toThrow();
    expect(() =>
      optimizer.getSearchSuggestions('br', problematicRules),
    ).not.toThrow();
  });

  it('handles empty or whitespace names', () => {
    const optimizer = new RuleSearchOptimizer();
    const edgeCaseRules = [
      createRule({ id: 'rule-1', name: '' }),
      createRule({ id: 'rule-2', name: '   ' }),
      createRule({ id: 'rule-3', name: 'Actual Name' }),
    ];

    expect(() => optimizer.updateIndex(edgeCaseRules)).not.toThrow();
    expect(() => optimizer.searchRules(edgeCaseRules, 'actual')).not.toThrow();
    expect(() =>
      optimizer.detectDuplicates('actual', edgeCaseRules),
    ).not.toThrow();
  });

  it('detects duplicates with normalized input', () => {
    const optimizer = new RuleSearchOptimizer();
    const rules = [
      createRule({ id: 'rule-1', name: 'Take a break' }),
      createRule({ id: 'rule-2', name: 'Drink water' }),
    ];

    const duplicateCheck = optimizer.detectDuplicates(
      '  take a break  ',
      rules,
    );
    expect(duplicateCheck.hasExactMatch).toBe(true);
    expect(duplicateCheck.exactMatches).toHaveLength(1);

    const nonExistent = optimizer.detectDuplicates('do stretching', rules);
    expect(nonExistent.hasExactMatch).toBe(false);
  });

  it('searches predictably for empty and non-empty queries', () => {
    const optimizer = new RuleSearchOptimizer();
    const rules = [
      createRule({ id: 'rule-1', name: 'Rule A', usageCount: 2 }),
      createRule({ id: 'rule-2', name: 'Rule B', usageCount: 8 }),
    ];

    optimizer.updateIndex(rules);

    const allResults = optimizer.searchRules(rules, '');
    expect(allResults).toHaveLength(2);
    expect(allResults[0]?.rule.id).toBe('rule-2');

    const exactResults = optimizer.searchRules(rules, 'rule a');
    expect(exactResults.length).toBeGreaterThan(0);
    expect(exactResults[0]?.rule.id).toBe('rule-1');
  });

  it('handles malformed rule payloads gracefully', () => {
    const optimizer = new RuleSearchOptimizer();
    const malformedRules = [
      createRule({
        id: 'rule-1',
        name: null as unknown as string,
        usageCount: null as unknown as number,
        description: undefined,
      }),
      {
        id: 'rule-2',
        chainId: 'chain-1',
        scope: 'chain',
        type: ExceptionRuleType.PAUSE_ONLY,
        createdAt: new Date('2025-01-01T00:00:00Z'),
        usageCount: 0,
        isActive: true,
      } as ExceptionRule,
    ];

    expect(() => {
      optimizer.updateIndex(malformedRules);
      optimizer.searchRules(malformedRules, 'test');
      optimizer.detectDuplicates('test', malformedRules);
      optimizer.getSearchSuggestions('test', malformedRules);
      optimizer.generateNameSuggestions('test', ExceptionRuleType.PAUSE_ONLY);
    }).not.toThrow();
  });
});
