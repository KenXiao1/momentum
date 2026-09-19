/**
 * 核心例外规则管理器集成测试
 */

import { ExceptionRuleManager } from '../ExceptionRuleManager';
import { exceptionRuleStorage } from '../ExceptionRuleStorage';
import {
  ExceptionRuleType,
  ExceptionRuleError,
  SessionContext,
  ExceptionRuleException,
} from '../../types';

describe('ExceptionRuleManager', () => {
  let manager: ExceptionRuleManager;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('language', 'zh');
    manager = new ExceptionRuleManager();
  });

  const createMockSessionContext = (
    overrides: Partial<SessionContext> = {},
  ): SessionContext => ({
    sessionId: 'session_1',
    chainId: 'chain_1',
    chainName: '测试任务',
    startedAt: new Date(),
    elapsedTime: 300,
    remainingTime: 600,
    isDurationless: false,
    ...overrides,
  });

  describe('规则创建和管理', () => {
    test('应该能够创建新规则', async () => {
      const result = await manager.createRule(
        '上厕所',
        ExceptionRuleType.PAUSE_ONLY,
        '生理需求',
      );

      expect(result.rule.name).toBe('上厕所');
      expect(result.rule.type).toBe(ExceptionRuleType.PAUSE_ONLY);
      expect(result.rule.description).toBe('生理需求');
      expect(result.warnings).toHaveLength(1); // 常见模式警告
    });

    test('创建重复规则应该抛出异常', async () => {
      await manager.createRule('上厕所', ExceptionRuleType.PAUSE_ONLY);

      await expect(
        manager.createRule('上厕所', ExceptionRuleType.EARLY_COMPLETION_ONLY),
      ).rejects.toThrow(ExceptionRuleException);
    });

    test('创建相似规则应该返回警告', async () => {
      await manager.createRule('上厕所', ExceptionRuleType.PAUSE_ONLY);

      const result = await manager.createRule(
        '去厕所',
        ExceptionRuleType.PAUSE_ONLY,
      );

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('相似规则');
    });

    test('应该能够更新规则', async () => {
      const createResult = await manager.createRule(
        '原始规则',
        ExceptionRuleType.PAUSE_ONLY,
      );

      const updateResult = await manager.updateRule(createResult.rule.id, {
        name: '更新后的规则',
        description: '新的描述',
      });

      expect(updateResult.rule.name).toBe('更新后的规则');
      expect(updateResult.rule.description).toBe('新的描述');
    });

    test('应该能够删除规则', async () => {
      const createResult = await manager.createRule(
        '待删除规则',
        ExceptionRuleType.PAUSE_ONLY,
      );

      await manager.deleteRule(createResult.rule.id);

      const rule = await manager.getRuleById(createResult.rule.id);
      expect(rule?.isActive).toBe(false);
    });

    test('应该能够获取规则详情', async () => {
      const createResult = await manager.createRule(
        '测试规则',
        ExceptionRuleType.PAUSE_ONLY,
      );

      const rule = await manager.getRuleById(createResult.rule.id);

      expect(rule).not.toBeNull();
      expect(rule!.name).toBe('测试规则');
    });
  });

  describe('规则分类和筛选', () => {
    beforeEach(async () => {
      await manager.createRule('暂停规则1', ExceptionRuleType.PAUSE_ONLY);
      await manager.createRule('暂停规则2', ExceptionRuleType.PAUSE_ONLY);
      await manager.createRule(
        '完成规则1',
        ExceptionRuleType.EARLY_COMPLETION_ONLY,
      );
    });

    test('应该能够按类型获取规则', async () => {
      const pauseRules = await manager.getRulesByType(
        ExceptionRuleType.PAUSE_ONLY,
      );
      const completionRules = await manager.getRulesByType(
        ExceptionRuleType.EARLY_COMPLETION_ONLY,
      );

      expect(pauseRules).toHaveLength(2);
      expect(completionRules).toHaveLength(1);
    });

    test('应该能够获取适用于指定操作的规则', async () => {
      const pauseRules = await manager.getRulesForAction('pause');
      const completionRules =
        await manager.getRulesForAction('early_completion');

      expect(pauseRules).toHaveLength(2);
      expect(completionRules).toHaveLength(1);
    });

    test('应该能够验证规则是否适用于操作', async () => {
      const pauseRule = await manager.createRule(
        '暂停规则',
        ExceptionRuleType.PAUSE_ONLY,
      );

      const isValidForPause = await manager.validateRuleForAction(
        pauseRule.rule.id,
        'pause',
      );
      const isValidForCompletion = await manager.validateRuleForAction(
        pauseRule.rule.id,
        'early_completion',
      );

      expect(isValidForPause).toBe(true);
      expect(isValidForCompletion).toBe(false);
    });

    test('应该能够搜索规则', async () => {
      const results = await manager.searchRules('暂停');
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.name.includes('暂停'))).toBe(true);
    });

    test('应该能够按操作类型搜索规则', async () => {
      const results = await manager.searchRules('', undefined, 'pause');
      expect(results).toHaveLength(2);
      expect(
        results.every((r) => r.type === ExceptionRuleType.PAUSE_ONLY),
      ).toBe(true);
    });
  });

  describe('规则使用和统计', () => {
    test('reports a storage failure without treating it as a missing rule or recording usage', async () => {
      const lookup = vi
        .spyOn(exceptionRuleStorage, 'getRuleById')
        .mockRejectedValueOnce(new Error('storage unavailable'));
      try {
        await expect(
          manager.useRule(
            'persisted-rule',
            createMockSessionContext(),
            'pause',
          ),
        ).rejects.toMatchObject({ type: ExceptionRuleError.STORAGE_ERROR });
        expect(await exceptionRuleStorage.getUsageRecords()).toEqual([]);
      } finally {
        lookup.mockRestore();
      }
    });

    test('uses the persisted chain rule ID immediately and after reloading', async () => {
      const { rule } = await manager.createChainRule(
        'chain_1',
        'Persisted rule',
        ExceptionRuleType.PAUSE_ONLY,
      );
      expect(await manager.getRuleById(rule.id)).toEqual(rule);
      const first = await manager.useRule(
        rule.id,
        createMockSessionContext(),
        'pause',
      );
      expect(first.record.ruleId).toBe(rule.id);

      const reloaded = new ExceptionRuleManager();
      const second = await reloaded.useRule(
        rule.id,
        createMockSessionContext(),
        'pause',
      );
      expect(second.rule.id).toBe(rule.id);
      expect(await reloaded.getRuleUsageHistory(rule.id)).toHaveLength(2);
    });

    test('rejects a deleted rule without recording usage', async () => {
      const { rule } = await manager.createChainRule(
        'chain_1',
        'Deleted rule',
        ExceptionRuleType.PAUSE_ONLY,
      );
      await manager.deleteRule(rule.id);
      await expect(
        manager.useRule(rule.id, createMockSessionContext(), 'pause'),
      ).rejects.toMatchObject({ type: ExceptionRuleError.RULE_NOT_FOUND });
      expect(await manager.getRuleUsageHistory(rule.id)).toEqual([]);
      expect((await manager.getRuleById(rule.id))?.usageCount).toBe(0);
    });

    test('应该能够使用规则并记录统计', async () => {
      const createResult = await manager.createRule(
        '测试规则',
        ExceptionRuleType.PAUSE_ONLY,
      );
      const sessionContext = createMockSessionContext();

      const useResult = await manager.useRule(
        createResult.rule.id,
        sessionContext,
        'pause',
      );

      expect(useResult.record.ruleId).toBe(createResult.rule.id);
      expect(useResult.record.actionType).toBe('pause');
      expect(useResult.rule.name).toBe('测试规则');
    });

    test('使用不匹配类型的规则应该抛出异常', async () => {
      const createResult = await manager.createRule(
        '暂停规则',
        ExceptionRuleType.PAUSE_ONLY,
      );
      const sessionContext = createMockSessionContext();

      await expect(
        manager.useRule(
          createResult.rule.id,
          sessionContext,
          'early_completion',
        ),
      ).rejects.toThrow(ExceptionRuleException);
    });

    test('应该能够获取规则统计信息', async () => {
      const createResult = await manager.createRule(
        '测试规则',
        ExceptionRuleType.PAUSE_ONLY,
      );
      const sessionContext = createMockSessionContext();

      await manager.useRule(createResult.rule.id, sessionContext, 'pause');
      await manager.useRule(createResult.rule.id, sessionContext, 'pause');

      const stats = await manager.getRuleStats(createResult.rule.id);

      expect(stats.totalUsage).toBe(2);
      expect(stats.pauseUsage).toBe(2);
      expect(stats.earlyCompletionUsage).toBe(0);
    });

    test('应该能够获取整体统计信息', async () => {
      const pauseRule = await manager.createRule(
        '暂停规则',
        ExceptionRuleType.PAUSE_ONLY,
      );
      const completionRule = await manager.createRule(
        '完成规则',
        ExceptionRuleType.EARLY_COMPLETION_ONLY,
      );
      const sessionContext = createMockSessionContext();

      await manager.useRule(pauseRule.rule.id, sessionContext, 'pause');
      await manager.useRule(
        completionRule.rule.id,
        sessionContext,
        'early_completion',
      );

      const stats = await manager.getOverallStats();

      expect(stats.totalRules).toBe(2);
      expect(stats.totalUsage).toBe(2);
      expect(stats.pauseUsage).toBe(1);
      expect(stats.earlyCompletionUsage).toBe(1);
    });

    test('应该能够获取使用建议', async () => {
      const rule1 = await manager.createRule(
        '高频规则',
        ExceptionRuleType.PAUSE_ONLY,
      );
      const rule2 = await manager.createRule(
        '低频规则',
        ExceptionRuleType.PAUSE_ONLY,
      );
      const sessionContext = createMockSessionContext();

      // 使用规则1多次
      await manager.useRule(rule1.rule.id, sessionContext, 'pause');
      await manager.useRule(rule1.rule.id, sessionContext, 'pause');
      await manager.useRule(rule2.rule.id, sessionContext, 'pause');

      const suggestions = await manager.getRuleUsageSuggestions('pause');

      expect(suggestions.mostUsed).toHaveLength(2);
      expect(suggestions.mostUsed[0].name).toBe('高频规则'); // 使用次数最多的在前
    });
  });

  describe('重复检测和建议', () => {
    test('应该能够获取重复检测建议', async () => {
      await manager.createRule('上厕所', ExceptionRuleType.PAUSE_ONLY);

      const suggestions = await manager.getDuplicationSuggestions('上厕所');

      expect(suggestions.hasExactMatch).toBe(true);
      expect(suggestions.exactMatches).toHaveLength(1);
      expect(suggestions.nameSuggestions.length).toBeGreaterThan(0);
    });

    test('应该能够获取相似规则建议', async () => {
      await manager.createRule('上厕所', ExceptionRuleType.PAUSE_ONLY);

      const suggestions = await manager.getDuplicationSuggestions('去厕所');

      expect(suggestions.hasExactMatch).toBe(false);
      expect(suggestions.hasSimilarRules).toBe(true);
      expect(suggestions.suggestion).not.toBeNull();
    });
  });

  describe('批量操作', () => {
    test('应该能够批量导入规则', async () => {
      const rulesToImport = [
        {
          name: '规则1',
          type: ExceptionRuleType.PAUSE_ONLY,
          description: '描述1',
        },
        {
          name: '规则2',
          type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
          description: '描述2',
        },
        {
          name: '规则1',
          type: ExceptionRuleType.PAUSE_ONLY,
          description: '重复规则',
        }, // 重复
      ];

      const result = await manager.importRules(rulesToImport, {
        skipDuplicates: true,
      });

      expect(result.imported).toHaveLength(2);
      expect(result.skipped).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    test('应该能够导出规则数据', async () => {
      await manager.createRule('测试规则', ExceptionRuleType.PAUSE_ONLY);
      const sessionContext = createMockSessionContext();
      const rule = (await manager.getAllRules())[0];
      await manager.useRule(rule.id, sessionContext, 'pause');

      const exportData = await manager.exportRules(true);

      expect(exportData.rules).toHaveLength(1);
      expect(exportData.usageRecords).toHaveLength(1);
      expect(exportData.summary.totalRules).toBe(1);
      expect(exportData.summary.totalUsageRecords).toBe(1);
    });
  });

  describe('系统管理', () => {
    test('应该能够获取规则类型统计', async () => {
      await manager.createRule('暂停规则1', ExceptionRuleType.PAUSE_ONLY);
      await manager.createRule('暂停规则2', ExceptionRuleType.PAUSE_ONLY);
      await manager.createRule(
        '完成规则1',
        ExceptionRuleType.EARLY_COMPLETION_ONLY,
      );

      const stats = await manager.getRuleTypeStats();

      expect(stats.total).toBe(3);
      expect(stats.pauseOnly).toBe(2);
      expect(stats.earlyCompletionOnly).toBe(1);
      expect(stats.mostUsedType).toBe(ExceptionRuleType.PAUSE_ONLY);
    });

    test('应该能够获取推荐的规则类型', async () => {
      await manager.createRule('暂停规则1', ExceptionRuleType.PAUSE_ONLY);
      await manager.createRule('暂停规则2', ExceptionRuleType.PAUSE_ONLY);

      const recommended = await manager.getRecommendedRuleType(true);
      expect(recommended).toBe(ExceptionRuleType.PAUSE_ONLY);
    });

    test('应该能够清理数据', async () => {
      const rule = await manager.createRule(
        '测试规则',
        ExceptionRuleType.PAUSE_ONLY,
      );
      const sessionContext = createMockSessionContext();
      await manager.useRule(rule.rule.id, sessionContext, 'pause');

      const cleanupResult = await manager.cleanupData({
        removeExpiredRecords: true,
        retentionDays: 30,
      });

      expect(cleanupResult.cleanedAt).toBeInstanceOf(Date);
      expect(cleanupResult.removedRecords).toBe(0); // 刚创建的记录不会被清理
    });

    test('应该能够获取系统健康状态', async () => {
      await manager.createRule('测试规则', ExceptionRuleType.PAUSE_ONLY);
      const rule = (await manager.getAllRules())[0];
      const sessionContext = createMockSessionContext();
      await manager.useRule(rule.id, sessionContext, 'pause');

      const health = await manager.getSystemHealth();

      expect(health.status).toBe('healthy');
      expect(health.totalRules).toBe(1);
      expect(health.activeRules).toBe(1);
      expect(health.totalUsageRecords).toBe(1);
      expect(health.lastUsedAt).toBeInstanceOf(Date);
      expect(health.issues).toHaveLength(0);
    });

    test('没有规则时应该返回警告状态', async () => {
      const health = await manager.getSystemHealth();

      expect(health.status).toBe('warning');
      expect(health.totalRules).toBe(0);
      expect(health.activeRules).toBe(0);
      expect(health.issues).toContain('没有活跃的例外规则');
    });
  });

  describe('错误处理', () => {
    test('获取不存在规则的统计应该抛出异常', async () => {
      await expect(manager.getRuleStats('non_existent_id')).rejects.toThrow(
        ExceptionRuleException,
      );
    });

    test('使用不存在的规则应该抛出异常', async () => {
      const sessionContext = createMockSessionContext();

      await expect(
        manager.useRule('non_existent_id', sessionContext, 'pause'),
      ).rejects.toThrow(ExceptionRuleException);
    });

    test('更新不存在的规则应该抛出异常', async () => {
      await expect(
        manager.updateRule('non_existent_id', { name: '新名称' }),
      ).rejects.toThrow(ExceptionRuleException);
    });
  });
});
