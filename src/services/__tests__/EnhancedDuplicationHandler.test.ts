/**
 * 增强的重复规则处理服务测试
 */

import { EnhancedDuplicationHandler } from '../EnhancedDuplicationHandler';
import { exceptionRuleStorage } from '../ExceptionRuleStorage';
import {
  ExceptionRule,
  ExceptionRuleType,
  ExceptionRuleException,
} from '../../types';

// Mock dependencies
vi.mock('../ExceptionRuleStorage', () => ({
  exceptionRuleStorage: {
    getRules: vi.fn(),
    createRule: vi.fn(),
  },
}));

vi.mock('../../utils/runtimeI18n', () => ({
  getCurrentLanguage: vi.fn(() => 'zh'),
  tr: vi.fn((zh: string) => zh),
}));

describe('EnhancedDuplicationHandler', () => {
  let handler: EnhancedDuplicationHandler;
  let mockRules: ExceptionRule[];

  beforeEach(() => {
    handler = new EnhancedDuplicationHandler();
    mockRules = [
      {
        id: '1',
        name: '上厕所',
        chainId: undefined,
        scope: 'global',
        type: ExceptionRuleType.PAUSE_ONLY,
        createdAt: new Date(),
        usageCount: 5,
        isActive: true,
      },
      {
        id: '2',
        name: '喝水',
        chainId: undefined,
        scope: 'global',
        type: ExceptionRuleType.PAUSE_ONLY,
        createdAt: new Date(),
        usageCount: 3,
        isActive: true,
      },
    ];

    vi.clearAllMocks();
  });

  describe('checkDuplicationRealTime', () => {
    it('should return no conflict for empty name', async () => {
      const result = await handler.checkDuplicationRealTime('');

      expect(result.isChecking).toBe(false);
      expect(result.hasConflict).toBe(false);
      expect(result.suggestions).toHaveLength(0);
    });

    it('should return no conflict for whitespace-only name', async () => {
      const result = await handler.checkDuplicationRealTime('   ');

      expect(result.isChecking).toBe(false);
      expect(result.hasConflict).toBe(false);
    });

    it('should detect exact match conflict', async () => {
      vi.mocked(exceptionRuleStorage.getRules).mockResolvedValue(mockRules);

      const result = await handler.checkDuplicationRealTime('上厕所');

      expect(result.hasConflict).toBe(true);
      expect(result.conflictMessage).toContain('上厕所');
    });

    it('should detect similar match conflict', async () => {
      vi.mocked(exceptionRuleStorage.getRules).mockResolvedValue(mockRules);

      const result = await handler.checkDuplicationRealTime('去厕所');

      expect(result.hasConflict).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should return no conflict for unique name', async () => {
      vi.mocked(exceptionRuleStorage.getRules).mockResolvedValue(mockRules);

      const result = await handler.checkDuplicationRealTime('完全不同的规则');

      expect(result.hasConflict).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(exceptionRuleStorage.getRules).mockRejectedValue(
        new Error('Storage error'),
      );

      const result = await handler.checkDuplicationRealTime('测试');

      expect(result.isChecking).toBe(false);
      expect(result.hasConflict).toBe(false);
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].type).toBe('create_anyway');
    });
  });

  describe('checkDuplication', () => {
    it('observes renames immediately without requiring cache invalidation', async () => {
      vi.mocked(exceptionRuleStorage.getRules).mockResolvedValue(mockRules);
      expect((await handler.checkDuplication('上厕所')).hasConflict).toBe(true);
      vi.mocked(exceptionRuleStorage.getRules).mockResolvedValue([
        { ...mockRules[0], name: 'Stretch' },
        mockRules[1],
      ]);
      expect((await handler.checkDuplication('上厕所')).hasConflict).toBe(
        false,
      );
    });

    it('observes deletion before offering an existing rule for reuse', async () => {
      vi.mocked(exceptionRuleStorage.getRules).mockResolvedValue(mockRules);
      expect(
        (await handler.checkDuplication('上厕所')).existingRules,
      ).toHaveLength(1);
      vi.mocked(exceptionRuleStorage.getRules).mockResolvedValue([
        { ...mockRules[0], isActive: false },
        mockRules[1],
      ]);
      expect((await handler.checkDuplication('上厕所')).existingRules).toEqual(
        [],
      );
    });

    it('should detect exact match', async () => {
      vi.mocked(exceptionRuleStorage.getRules).mockResolvedValue(mockRules);

      const result = await handler.checkDuplication('上厕所');

      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe('exact');
      expect(result.existingRules).toHaveLength(1);
      expect(result.canProceed).toBe(false);
    });

    it('should detect similar match', async () => {
      vi.mocked(exceptionRuleStorage.getRules).mockResolvedValue(mockRules);

      const result = await handler.checkDuplication('去厕所');

      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe('similar');
      expect(result.canProceed).toBe(true);
    });

    it('should return no conflict for unique name', async () => {
      vi.mocked(exceptionRuleStorage.getRules).mockResolvedValue(mockRules);

      const result = await handler.checkDuplication('完全不同的规则名称');

      expect(result.hasConflict).toBe(false);
      expect(result.conflictType).toBe('none');
      expect(result.existingRules).toHaveLength(0);
    });

    it('should exclude specified rule ID', async () => {
      vi.mocked(exceptionRuleStorage.getRules).mockResolvedValue(mockRules);

      const result = await handler.checkDuplication('上厕所', '1');

      expect(result.hasConflict).toBe(false);
    });

    it('should ignore inactive rules', async () => {
      const inactiveRules = mockRules.map((r) => ({ ...r, isActive: false }));
      vi.mocked(exceptionRuleStorage.getRules).mockResolvedValue(inactiveRules);

      const result = await handler.checkDuplication('上厕所');

      expect(result.hasConflict).toBe(false);
    });

    it('should throw exception on storage error', async () => {
      vi.mocked(exceptionRuleStorage.getRules).mockRejectedValue(
        new Error('Storage error'),
      );

      await expect(handler.checkDuplication('测试')).rejects.toThrow(
        ExceptionRuleException,
      );
    });
  });

  describe('handleDuplicateCreation', () => {
    it('should create rule when no conflict', async () => {
      vi.mocked(exceptionRuleStorage.getRules).mockResolvedValue([]);
      vi.mocked(exceptionRuleStorage.createRule).mockResolvedValue({
        id: '3',
        name: '新规则',
        type: ExceptionRuleType.PAUSE_ONLY,
        scope: 'global',
        createdAt: new Date(),
        usageCount: 0,
        isActive: true,
      });

      const result = await handler.handleDuplicateCreation(
        '新规则',
        ExceptionRuleType.PAUSE_ONLY,
      );

      expect(result.action).toBe('created_new');
      expect(result.rule.name).toBe('新规则');
      expect(result.warnings).toHaveLength(0);
    });

    it('should add warning for common pattern', async () => {
      vi.mocked(exceptionRuleStorage.getRules).mockResolvedValue([]);
      vi.mocked(exceptionRuleStorage.createRule).mockResolvedValue({
        id: '3',
        name: '上厕所',
        type: ExceptionRuleType.PAUSE_ONLY,
        scope: 'global',
        createdAt: new Date(),
        usageCount: 0,
        isActive: true,
      });

      const result = await handler.handleDuplicateCreation(
        '上厕所',
        ExceptionRuleType.PAUSE_ONLY,
      );

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should use existing rule when user chooses', async () => {
      vi.mocked(exceptionRuleStorage.getRules).mockResolvedValue(mockRules);

      const result = await handler.handleDuplicateCreation(
        '上厕所',
        ExceptionRuleType.PAUSE_ONLY,
        undefined,
        'use_existing',
      );

      expect(result.action).toBe('used_existing');
      expect(result.rule.id).toBe('1');
    });

    it('should warn when using existing rule with different type', async () => {
      vi.mocked(exceptionRuleStorage.getRules).mockResolvedValue(mockRules);

      const result = await handler.handleDuplicateCreation(
        '上厕所',
        ExceptionRuleType.EARLY_COMPLETION_ONLY,
        undefined,
        'use_existing',
      );

      expect(result.action).toBe('used_existing_different_type');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should throw for exact match with create_anyway', async () => {
      vi.mocked(exceptionRuleStorage.getRules).mockResolvedValue(mockRules);

      await expect(
        handler.handleDuplicateCreation(
          '上厕所',
          ExceptionRuleType.PAUSE_ONLY,
          undefined,
          'create_anyway',
        ),
      ).rejects.toThrow(ExceptionRuleException);
    });

    it('should allow create_anyway for similar match', async () => {
      vi.mocked(exceptionRuleStorage.getRules).mockResolvedValue(mockRules);
      vi.mocked(exceptionRuleStorage.createRule).mockResolvedValue({
        id: '3',
        name: '去厕所',
        type: ExceptionRuleType.PAUSE_ONLY,
        scope: 'global',
        createdAt: new Date(),
        usageCount: 0,
        isActive: true,
      });

      const result = await handler.handleDuplicateCreation(
        '去厕所',
        ExceptionRuleType.PAUSE_ONLY,
        undefined,
        'create_anyway',
      );

      expect(result.action).toBe('created_despite_similarity');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should throw when no user choice for conflict', async () => {
      vi.mocked(exceptionRuleStorage.getRules).mockResolvedValue(mockRules);

      await expect(
        handler.handleDuplicateCreation('上厕所', ExceptionRuleType.PAUSE_ONLY),
      ).rejects.toThrow(ExceptionRuleException);
    });
  });

  describe('generateNameSuggestions', () => {
    it('should generate numeric suffix suggestions', () => {
      const suggestions = handler.generateNameSuggestions('上厕所', ['上厕所']);

      expect(suggestions.some((s) => s.includes('上厕所 2'))).toBe(true);
    });

    it('should generate descriptive suffix suggestions', () => {
      // Fill up numeric suffixes so descriptive ones appear
      const existingNames = [
        '上厕所',
        '上厕所 2',
        '上厕所 3',
        '上厕所 4',
        '上厕所 5',
      ];
      const suggestions = handler.generateNameSuggestions(
        '上厕所',
        existingNames,
      );

      // Should have descriptive suffixes when numeric ones are taken
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should avoid existing names', () => {
      const existingNames = ['上厕所', '上厕所 2', '上厕所 3'];
      const suggestions = handler.generateNameSuggestions(
        '上厕所',
        existingNames,
      );

      for (const suggestion of suggestions) {
        expect(existingNames).not.toContain(suggestion);
      }
    });

    it('should limit suggestions to 3', () => {
      const suggestions = handler.generateNameSuggestions('上厕所', []);

      expect(suggestions.length).toBeLessThanOrEqual(3);
    });
  });
});
