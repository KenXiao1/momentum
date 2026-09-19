import { RuleSearchOptimizer } from '../ruleSearchOptimizer';
import { ExceptionRule, ExceptionRuleType } from '../../types';

describe('RuleSearchOptimizer', () => {
  let optimizer: RuleSearchOptimizer;
  let mockRules: ExceptionRule[];

  beforeEach(() => {
    optimizer = new RuleSearchOptimizer();
    mockRules = [
      {
        id: '1',
        name: '上厕所',
        chainId: 'chain1',
        scope: 'chain',
        type: ExceptionRuleType.PAUSE_ONLY,
        createdAt: new Date(),
        usageCount: 5,
        isActive: true,
      },
      {
        id: '2',
        name: '喝水',
        chainId: 'chain1',
        scope: 'chain',
        type: ExceptionRuleType.PAUSE_ONLY,
        createdAt: new Date(),
        usageCount: 3,
        isActive: true,
      },
      {
        id: '3',
        name: '接电话',
        chainId: 'chain1',
        scope: 'chain',
        type: ExceptionRuleType.PAUSE_ONLY,
        createdAt: new Date(),
        usageCount: 8,
        isActive: true,
      },
    ];
  });

  describe('updateIndex', () => {
    it('should create search index for rules', () => {
      optimizer.updateIndex(mockRules);
      const stats = optimizer.getSearchStats();
      expect(stats.cacheSize).toBe(0); // Cache should be cleared
    });

    it('should clear cache when updating index', () => {
      // First search to populate cache
      optimizer.searchRules(mockRules, '上厕所');
      let stats = optimizer.getSearchStats();
      expect(stats.cacheSize).toBeGreaterThan(0);

      // Update index should clear cache
      optimizer.updateIndex(mockRules);
      stats = optimizer.getSearchStats();
      expect(stats.cacheSize).toBe(0);
    });
  });

  describe('searchRules', () => {
    beforeEach(() => {
      optimizer.updateIndex(mockRules);
    });

    it('should return all rules when query is empty', () => {
      const results = optimizer.searchRules(mockRules, '');
      expect(results).toHaveLength(3);
      // Should be sorted by usage count
      expect(results[0].rule.name).toBe('接电话'); // highest usage count
    });

    it('should find exact matches', () => {
      const results = optimizer.searchRules(mockRules, '上厕所');
      expect(results).toHaveLength(1);
      expect(results[0].rule.name).toBe('上厕所');
      expect(results[0].matchType).toBe('exact');
      expect(results[0].score).toBeGreaterThan(1000);
    });

    it('should find prefix matches', () => {
      const results = optimizer.searchRules(mockRules, '上');
      expect(results.length).toBeGreaterThan(0);
      const exactMatch = results.find((r) => r.rule.name === '上厕所');
      expect(exactMatch?.matchType).toBe('prefix');
    });

    it('should find contains matches', () => {
      const results = optimizer.searchRules(mockRules, '电话');
      expect(results.length).toBeGreaterThan(0);
      const match = results.find((r) => r.rule.name === '接电话');
      expect(match?.matchType).toBe('contains');
    });

    it('should cache search results', () => {
      optimizer.searchRules(mockRules, '上厕所');
      optimizer.searchRules(mockRules, '喝水');

      const stats = optimizer.getSearchStats();
      expect(stats.cacheSize).toBe(2);
    });

    it('should record search history', () => {
      optimizer.searchRules(mockRules, '上厕所');
      optimizer.searchRules(mockRules, '喝水');

      const stats = optimizer.getSearchStats();
      expect(stats.historySize).toBe(2);
    });
  });

  describe('getSearchSuggestions', () => {
    beforeEach(() => {
      optimizer.updateIndex(mockRules);
      // Add some search history
      optimizer.searchRules(mockRules, '上厕所');
      optimizer.searchRules(mockRules, '喝水');
    });

    it('should return history suggestions when query is empty', () => {
      const suggestions = optimizer.getSearchSuggestions('', mockRules);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.type === 'recent')).toBe(true);
    });

    it('should return similar suggestions for partial queries', () => {
      const suggestions = optimizer.getSearchSuggestions('上', mockRules);
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('detectDuplicates', () => {
    it('should detect exact matches', () => {
      const result = optimizer.detectDuplicates('上厕所', mockRules);
      expect(result.hasExactMatch).toBe(true);
      expect(result.exactMatches).toHaveLength(1);
      expect(result.exactMatches[0].name).toBe('上厕所');
    });

    it('should detect similar rules', () => {
      const result = optimizer.detectDuplicates('上厕', mockRules);
      expect(result.hasExactMatch).toBe(false);
      expect(result.similarRules.length).toBeGreaterThan(0);
    });

    it('should handle case insensitive matching', () => {
      const result = optimizer.detectDuplicates('上厕所', mockRules);
      expect(result.hasExactMatch).toBe(true);
    });
  });

  describe('generateNameSuggestions', () => {
    it('should generate suggestions for pause rules', () => {
      const suggestions = optimizer.generateNameSuggestions(
        '上',
        ExceptionRuleType.PAUSE_ONLY,
      );
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.includes('上'))).toBe(true);
    });

    it('should generate suggestions for completion rules', () => {
      const suggestions = optimizer.generateNameSuggestions(
        '任务',
        ExceptionRuleType.EARLY_COMPLETION,
      );
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.includes('任务'))).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should clear search cache', () => {
      optimizer.searchRules(mockRules, '上厕所');
      let stats = optimizer.getSearchStats();
      expect(stats.cacheSize).toBeGreaterThan(0);

      optimizer.clearCache();
      stats = optimizer.getSearchStats();
      expect(stats.cacheSize).toBe(0);
    });
  });

  describe('performance', () => {
    it('should handle large rule sets efficiently', () => {
      const largeRuleSet: ExceptionRule[] = [];
      for (let i = 0; i < 1000; i++) {
        largeRuleSet.push({
          id: `rule_${i}`,
          name: `规则${i}`,
          chainId: 'chain1',
          scope: 'chain',
          type: ExceptionRuleType.PAUSE_ONLY,
          createdAt: new Date(),
          usageCount: Math.floor(Math.random() * 10),
          isActive: true,
        });
      }

      const startTime = performance.now();
      optimizer.updateIndex(largeRuleSet);
      optimizer.searchRules(largeRuleSet, '规则');
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });
  });
});
