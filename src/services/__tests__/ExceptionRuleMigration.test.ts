/**
 * 例外规则迁移服务测试
 */

import { ExceptionRuleMigrationService } from '../ExceptionRuleMigration';
import { ExceptionRuleType } from '../../types';
import { exceptionRuleManager } from '../ExceptionRuleManager';
import type { MomentumStorage } from '../../storage/MomentumStorage';
import type { Mocked } from 'vitest';

type LegacyStorage = Pick<MomentumStorage, 'kind' | 'getChains'>;

const mockStorage: Mocked<LegacyStorage> = {
  kind: 'local',
  getChains: vi.fn(),
};

describe('ExceptionRuleMigrationService', () => {
  let migrationService: ExceptionRuleMigrationService;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('language', 'zh');

    migrationService = new ExceptionRuleMigrationService();
    migrationService.setStorage(mockStorage as unknown as MomentumStorage);
    mockStorage.getChains.mockResolvedValue([]);
  });

  afterEach(() => {
    migrationService.setStorage(null);
    vi.restoreAllMocks();
  });

  describe('迁移需求检查', () => {
    test('没有迁移信息且没有旧数据时应该返回false', async () => {
      mockStorage.getChains.mockResolvedValueOnce([] as any);

      const needsMigration = await migrationService.needsMigration();
      expect(needsMigration).toBe(false);
    });

    test('已经迁移过的数据应该返回false', async () => {
      // Set migration info
      localStorage.setItem(
        'momentum_exception_rules_migration',
        JSON.stringify({
          version: '1.0.0',
          migratedAt: new Date().toISOString(),
          totalRules: 5,
          skippedRules: 0,
          errors: 0,
        }),
      );

      const needsMigration = await migrationService.needsMigration();
      expect(needsMigration).toBe(false);
    });

    test('有旧数据且未迁移时应该返回true', async () => {
      const mockChains = [
        {
          id: 'chain1',
          name: '测试任务1',
          exceptions: ['上厕所', '喝水'],
        },
        {
          id: 'chain2',
          name: '测试任务2',
          exceptions: ['休息'],
        },
      ];
      mockStorage.getChains.mockResolvedValueOnce(mockChains as any);

      const needsMigration = await migrationService.needsMigration();
      expect(needsMigration).toBe(true);
    });
  });

  describe('迁移建议', () => {
    test('应该正确分析迁移数据', async () => {
      const mockChains = [
        {
          id: 'chain1',
          name: '任务1',
          exceptions: ['上厕所', '喝水', '上厕所'], // 包含重复
        },
        {
          id: 'chain2',
          name: '任务2',
          exceptions: ['上厕所', '休息'], // 上厕所重复
        },
      ];
      mockStorage.getChains.mockResolvedValueOnce(mockChains as any);

      const suggestions = await migrationService.getMigrationSuggestions();

      expect(suggestions.totalRules).toBe(5); // 总共5个规则（包含重复）
      expect(suggestions.uniqueRules).toHaveLength(3); // 3个唯一规则
      expect(suggestions.duplicateRules).toHaveLength(1); // 1个重复规则（上厕所）
      expect(suggestions.duplicateRules[0].rule).toBe('上厕所');
      expect(suggestions.duplicateRules[0].count).toBe(3);
      expect(suggestions.recommendations.length).toBeGreaterThan(0);
    });

    test('应该识别常见模式', async () => {
      const mockChains = [
        {
          id: 'chain1',
          name: '任务1',
          exceptions: ['上厕所', '喝水', '接电话', '查看消息'],
        },
      ];
      mockStorage.getChains.mockResolvedValueOnce(mockChains as any);

      const suggestions = await migrationService.getMigrationSuggestions();

      expect(
        suggestions.recommendations.some((r) => r.includes('常见模式')),
      ).toBe(true);
    });

    test('规则数量过多时应该给出建议', async () => {
      const mockChains = [
        {
          id: 'chain1',
          name: '任务1',
          exceptions: Array.from({ length: 25 }, (_, i) => `规则${i}`),
        },
      ];
      mockStorage.getChains.mockResolvedValueOnce(mockChains as any);

      const suggestions = await migrationService.getMigrationSuggestions();

      expect(
        suggestions.recommendations.some((r) => r.includes('规则数量较多')),
      ).toBe(true);
    });
  });

  describe('迁移执行', () => {
    test('应该成功迁移规则', async () => {
      const mockChains = [
        {
          id: 'chain1',
          name: '任务1',
          exceptions: ['上厕所', '喝水'],
        },
        {
          id: 'chain2',
          name: '任务2',
          exceptions: ['休息'],
        },
      ];
      mockStorage.getChains.mockResolvedValueOnce(mockChains as any);

      // Mock rule creation
      vi.spyOn(exceptionRuleManager, 'createRule')
        .mockResolvedValueOnce({
          rule: {
            scope: 'global',
            createdAt: new Date(),
            usageCount: 0,
            isActive: true,
            type: ExceptionRuleType.PAUSE_ONLY,
            id: 'rule1',
            name: '上厕所',
          },
          warnings: [],
        })
        .mockResolvedValueOnce({
          rule: {
            scope: 'global',
            createdAt: new Date(),
            usageCount: 0,
            isActive: true,
            type: ExceptionRuleType.PAUSE_ONLY,
            id: 'rule2',
            name: '喝水',
          },
          warnings: [],
        })
        .mockResolvedValueOnce({
          rule: {
            scope: 'global',
            createdAt: new Date(),
            usageCount: 0,
            isActive: true,
            type: ExceptionRuleType.PAUSE_ONLY,
            id: 'rule3',
            name: '休息',
          },
          warnings: [],
        });

      const progressCallback = vi.fn();
      const result = await migrationService.migrate(progressCallback);

      expect(result.totalChains).toBe(2);
      expect(result.migratedRules).toBe(3);
      expect(result.skippedRules).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.createdRules).toHaveLength(3);
      expect(progressCallback).toHaveBeenCalled();
    });

    test('应该处理迁移错误', async () => {
      const mockChains = [
        {
          id: 'chain1',
          name: '任务1',
          exceptions: ['有效规则', '无效规则'],
        },
      ];
      mockStorage.getChains.mockResolvedValueOnce(mockChains as any);

      // Mock rule creation with one success and one failure
      vi.spyOn(exceptionRuleManager, 'createRule')
        .mockResolvedValueOnce({
          rule: {
            scope: 'global',
            createdAt: new Date(),
            usageCount: 0,
            isActive: true,
            type: ExceptionRuleType.PAUSE_ONLY,
            id: 'rule1',
            name: '有效规则',
          },
          warnings: [],
        })
        .mockRejectedValueOnce(new Error('创建失败'));

      const result = await migrationService.migrate();

      expect(result.migratedRules).toBe(1);
      expect(result.skippedRules).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].chainName).toBe('无效规则');
    });

    test('应该报告迁移进度', async () => {
      const mockChains = [
        {
          id: 'chain1',
          name: '任务1',
          exceptions: ['规则1', '规则2'],
        },
      ];
      mockStorage.getChains.mockResolvedValueOnce(mockChains as any);

      vi.spyOn(exceptionRuleManager, 'createRule').mockResolvedValue({
        rule: {
          scope: 'global',
          createdAt: new Date(),
          usageCount: 0,
          isActive: true,
          type: ExceptionRuleType.PAUSE_ONLY,
          id: 'rule1',
          name: '规则1',
        },
        warnings: [],
      });

      const progressCallback = vi.fn();
      await migrationService.migrate(progressCallback);

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'analyzing',
          message: '分析现有数据...',
        }),
      );

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'migrating',
        }),
      );

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'complete',
        }),
      );
    });
  });

  describe('迁移验证', () => {
    test('应该验证迁移结果', async () => {
      // Set migration info
      localStorage.setItem(
        'momentum_exception_rules_migration',
        JSON.stringify({
          version: '1.0.0',
          migratedAt: new Date().toISOString(),
          totalRules: 2,
          skippedRules: 0,
          errors: 0,
        }),
      );

      // Mock rule manager
      vi.spyOn(exceptionRuleManager, 'getAllRules').mockResolvedValue([
        {
          scope: 'global',
          createdAt: new Date(),
          usageCount: 0,
          isActive: true,
          type: ExceptionRuleType.PAUSE_ONLY,
          id: 'rule1',
          name: '规则1',
          description: '从旧系统迁移的规则',
        },
        {
          scope: 'global',
          createdAt: new Date(),
          usageCount: 0,
          isActive: true,
          type: ExceptionRuleType.PAUSE_ONLY,
          id: 'rule2',
          name: '规则2',
          description: '从旧系统迁移的规则',
        },
      ]);

      const validation = await migrationService.validateMigration();

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.statistics.totalRules).toBe(2);
      expect(validation.statistics.migratedRules).toBe(2);
    });

    test('应该检测数据不一致', async () => {
      // Set migration info with different count
      localStorage.setItem(
        'momentum_exception_rules_migration',
        JSON.stringify({
          version: '1.0.0',
          migratedAt: new Date().toISOString(),
          totalRules: 3, // 期望3个，但实际只有2个
          skippedRules: 0,
          errors: 0,
        }),
      );

      vi.spyOn(exceptionRuleManager, 'getAllRules').mockResolvedValue([
        {
          scope: 'global',
          createdAt: new Date(),
          usageCount: 0,
          isActive: true,
          type: ExceptionRuleType.PAUSE_ONLY,
          id: 'rule1',
          name: '规则1',
          description: '从旧系统迁移的规则',
        },
        {
          scope: 'global',
          createdAt: new Date(),
          usageCount: 0,
          isActive: true,
          type: ExceptionRuleType.PAUSE_ONLY,
          id: 'rule2',
          name: '规则2',
          description: '从旧系统迁移的规则',
        },
      ]);

      const validation = await migrationService.validateMigration();

      expect(validation.isValid).toBe(false);
      expect(
        validation.issues.some((issue) => issue.includes('数量不匹配')),
      ).toBe(true);
    });
  });

  describe('迁移回滚', () => {
    test('应该能够回滚迁移', async () => {
      // Set migration info
      localStorage.setItem(
        'momentum_exception_rules_migration',
        JSON.stringify({
          version: '1.0.0',
          migratedAt: new Date().toISOString(),
          totalRules: 2,
          skippedRules: 0,
          errors: 0,
        }),
      );

      // Mock migrated rules
      vi.spyOn(exceptionRuleManager, 'getAllRules').mockResolvedValue([
        {
          scope: 'global',
          createdAt: new Date(),
          usageCount: 0,
          isActive: true,
          type: ExceptionRuleType.PAUSE_ONLY,
          id: 'rule1',
          name: '规则1',
          description: '从旧系统迁移的规则',
        },
        {
          scope: 'global',
          createdAt: new Date(),
          usageCount: 0,
          isActive: true,
          type: ExceptionRuleType.PAUSE_ONLY,
          id: 'rule2',
          name: '规则2',
          description: '从旧系统迁移的规则',
        },
      ]);

      vi.spyOn(exceptionRuleManager, 'deleteRule').mockResolvedValue(undefined);

      const result = await migrationService.rollback();

      expect(result.success).toBe(true);
      expect(result.deletedRules).toBe(2);
      expect(exceptionRuleManager.deleteRule).toHaveBeenCalledTimes(2);
      expect(
        localStorage.getItem('momentum_exception_rules_migration'),
      ).toBeNull();
    });

    test('没有迁移记录时应该返回失败', async () => {
      const result = await migrationService.rollback();

      expect(result.success).toBe(false);
      expect(result.message).toContain('没有找到迁移记录');
      expect(result.deletedRules).toBe(0);
    });
  });

  describe('迁移报告', () => {
    test('应该生成完整的迁移报告', async () => {
      // Set migration info
      localStorage.setItem(
        'momentum_exception_rules_migration',
        JSON.stringify({
          version: '1.0.0',
          migratedAt: new Date().toISOString(),
          totalRules: 2,
          skippedRules: 0,
          errors: 0,
        }),
      );

      vi.spyOn(exceptionRuleManager, 'getAllRules').mockResolvedValue([
        {
          scope: 'global',
          createdAt: new Date(),
          usageCount: 0,
          isActive: true,
          type: ExceptionRuleType.PAUSE_ONLY,
          id: 'rule1',
          name: '规则1',
          description: '从旧系统迁移的规则',
        },
      ]);

      mockStorage.getChains.mockResolvedValueOnce([] as any);

      const report = await migrationService.generateMigrationReport();
      const parsedReport = JSON.parse(report);

      expect(parsedReport.title).toBe('例外规则迁移报告');
      expect(parsedReport.migrationInfo).toBeDefined();
      expect(parsedReport.validation).toBeDefined();
      expect(parsedReport.suggestions).toBeDefined();
      expect(parsedReport.summary).toBeDefined();
      expect(parsedReport.summary.migrationCompleted).toBe(true);
    });

    test('发生错误时应该生成错误报告', async () => {
      vi.spyOn(exceptionRuleManager, 'getAllRules').mockRejectedValue(
        new Error('测试错误'),
      );
      mockStorage.getChains.mockResolvedValueOnce([] as any);

      const report = await migrationService.generateMigrationReport();
      const parsedReport = JSON.parse(report);

      expect(parsedReport.validation?.isValid).toBe(false);
      expect(parsedReport.validation?.issues?.length).toBeGreaterThan(0);
    });
  });
});
