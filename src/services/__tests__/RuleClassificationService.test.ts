/**
 * 规则分类管理服务测试
 */

import { RuleClassificationService } from '../RuleClassificationService';
import {
  ExceptionRuleStorageService,
  exceptionRuleStorage,
} from '../ExceptionRuleStorage';
import {
  ExceptionRuleType,
  ExceptionRuleError,
  ExceptionRuleException,
} from '../../types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('RuleClassificationService', () => {
  let service: RuleClassificationService;
  let storage: ExceptionRuleStorageService;

  beforeEach(() => {
    service = new RuleClassificationService();
    storage = new ExceptionRuleStorageService();
    localStorage.clear();
  });

  describe('按类型获取规则', () => {
    test('应该能够按类型获取规则', async () => {
      await storage.createRule({
        name: '暂停规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });
      await storage.createRule({
        name: '完成规则',
        type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
      });

      const pauseRules = await service.getRulesByType(
        ExceptionRuleType.PAUSE_ONLY,
      );
      const completionRules = await service.getRulesByType(
        ExceptionRuleType.EARLY_COMPLETION_ONLY,
      );

      expect(pauseRules).toHaveLength(1);
      expect(pauseRules[0].name).toBe('暂停规则');
      expect(completionRules).toHaveLength(1);
      expect(completionRules[0].name).toBe('完成规则');
    });

    test('应该按类型分组返回所有规则', async () => {
      await storage.createRule({
        name: '暂停规则1',
        type: ExceptionRuleType.PAUSE_ONLY,
      });
      await storage.createRule({
        name: '暂停规则2',
        type: ExceptionRuleType.PAUSE_ONLY,
      });
      await storage.createRule({
        name: '完成规则1',
        type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
      });

      const grouped = await service.getRulesGroupedByType();

      expect(grouped[ExceptionRuleType.PAUSE_ONLY]).toHaveLength(2);
      expect(grouped[ExceptionRuleType.EARLY_COMPLETION_ONLY]).toHaveLength(1);
    });

    test('分组结果应该按使用频率排序', async () => {
      const rule1 = await storage.createRule({
        name: '低频规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });
      const rule2 = await storage.createRule({
        name: '高频规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });

      // 模拟使用频率
      await storage.updateRule(rule1.id, { usageCount: 1 });
      await storage.updateRule(rule2.id, { usageCount: 5 });

      const grouped = await service.getRulesGroupedByType();
      const pauseRules = grouped[ExceptionRuleType.PAUSE_ONLY];

      expect(pauseRules[0].name).toBe('高频规则');
      expect(pauseRules[1].name).toBe('低频规则');
    });
  });

  describe('规则类型验证', () => {
    test('应该正确验证暂停规则类型', async () => {
      const rule = await storage.createRule({
        name: '暂停规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });

      expect(service.validateRuleTypeForAction(rule, 'pause')).toBe(true);
      expect(service.validateRuleTypeForAction(rule, 'early_completion')).toBe(
        false,
      );
    });

    test('应该正确验证提前完成规则类型', async () => {
      const rule = await storage.createRule({
        name: '完成规则',
        type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
      });

      expect(service.validateRuleTypeForAction(rule, 'early_completion')).toBe(
        true,
      );
      expect(service.validateRuleTypeForAction(rule, 'pause')).toBe(false);
    });

    test('应该为指定操作获取适用的规则', async () => {
      await storage.createRule({
        name: '暂停规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });
      await storage.createRule({
        name: '完成规则',
        type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
      });

      const pauseRules = await service.getRulesForAction('pause');
      const completionRules =
        await service.getRulesForAction('early_completion');

      expect(pauseRules).toHaveLength(1);
      expect(pauseRules[0].name).toBe('暂停规则');
      expect(completionRules).toHaveLength(1);
      expect(completionRules[0].name).toBe('完成规则');
    });

    test('规则类型不匹配时应该抛出异常', async () => {
      const rule = await storage.createRule({
        name: '暂停规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });

      await expect(
        service.validateRuleForAction(rule.id, 'early_completion'),
      ).rejects.toThrow(ExceptionRuleException);
    });

    test('规则不存在时应该抛出异常', async () => {
      await expect(
        service.validateRuleForAction('non_existent_id', 'pause'),
      ).rejects.toThrow(ExceptionRuleException);
    });

    test('已删除规则应该抛出异常', async () => {
      const rule = await storage.createRule({
        name: '待删除规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });

      await storage.deleteRule(rule.id);

      await expect(
        service.validateRuleForAction(rule.id, 'pause'),
      ).rejects.toThrow(ExceptionRuleException);
    });
  });

  test('validation sees edits and deletion immediately without a validation cache protocol', async () => {
    const rule = await storage.createRule({
      name: 'Editable',
      type: ExceptionRuleType.PAUSE_ONLY,
    });
    await expect(
      service.validateRuleForAction(rule.id, 'pause'),
    ).resolves.toBeUndefined();
    await storage.updateRule(rule.id, {
      type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
    });
    await expect(
      service.validateRuleForAction(rule.id, 'pause'),
    ).rejects.toMatchObject({ type: ExceptionRuleError.RULE_TYPE_MISMATCH });
    await expect(
      service.validateRuleForAction(rule.id, 'early_completion'),
    ).resolves.toBeUndefined();
    await storage.deleteRule(rule.id);
    await expect(
      service.validateRuleForAction(rule.id, 'early_completion'),
    ).rejects.toMatchObject({ type: ExceptionRuleError.RULE_NOT_FOUND });
  });

  test('validation reports storage failure and a later retry can succeed', async () => {
    const rule = await storage.createRule({
      name: 'Retry',
      type: ExceptionRuleType.PAUSE_ONLY,
    });
    const read = vi
      .spyOn(exceptionRuleStorage, 'getRuleById')
      .mockRejectedValueOnce(new Error('storage unavailable'));
    try {
      await expect(
        service.validateRuleForAction(rule.id, 'pause'),
      ).rejects.toMatchObject({ type: ExceptionRuleError.VALIDATION_ERROR });
      await expect(
        service.validateRuleForAction(rule.id, 'pause'),
      ).resolves.toBeUndefined();
    } finally {
      read.mockRestore();
    }
  });

  describe('规则类型建议', () => {
    test('应该为类型不匹配的规则提供建议', async () => {
      const rule = await storage.createRule({
        name: '暂停规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });

      const suggestion = await service.suggestRuleTypeChange(
        rule.id,
        'early_completion',
      );
      expect(suggestion).toContain('暂停操作');
      expect(suggestion).toContain('提前完成操作');
    });

    test('类型匹配时应该返回无需更改的建议', async () => {
      const rule = await storage.createRule({
        name: '暂停规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });

      const suggestion = await service.suggestRuleTypeChange(rule.id, 'pause');
      expect(suggestion).toContain('无需更改');
    });

    test('规则不存在时应该返回相应提示', async () => {
      const suggestion = await service.suggestRuleTypeChange(
        'non_existent_id',
        'pause',
      );
      expect(suggestion).toContain('规则不存在');
    });
  });

  describe('规则类型统计', () => {
    test('应该正确统计规则类型信息', async () => {
      await storage.createRule({
        name: '暂停规则1',
        type: ExceptionRuleType.PAUSE_ONLY,
      });
      await storage.createRule({
        name: '暂停规则2',
        type: ExceptionRuleType.PAUSE_ONLY,
      });
      await storage.createRule({
        name: '完成规则1',
        type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
      });

      const stats = await service.getRuleTypeStats();

      expect(stats.total).toBe(3);
      expect(stats.pauseOnly).toBe(2);
      expect(stats.earlyCompletionOnly).toBe(1);
      expect(stats.mostUsedType).toBe(ExceptionRuleType.PAUSE_ONLY);
      expect(stats.leastUsedType).toBe(ExceptionRuleType.EARLY_COMPLETION_ONLY);
    });

    test('没有规则时应该返回空统计', async () => {
      const stats = await service.getRuleTypeStats();

      expect(stats.total).toBe(0);
      expect(stats.pauseOnly).toBe(0);
      expect(stats.earlyCompletionOnly).toBe(0);
      expect(stats.mostUsedType).toBeNull();
      expect(stats.leastUsedType).toBeNull();
    });
  });

  describe('推荐规则类型', () => {
    test('基于使用习惯推荐规则类型', async () => {
      // 创建更多暂停规则
      await storage.createRule({
        name: '暂停规则1',
        type: ExceptionRuleType.PAUSE_ONLY,
      });
      await storage.createRule({
        name: '暂停规则2',
        type: ExceptionRuleType.PAUSE_ONLY,
      });
      await storage.createRule({
        name: '完成规则1',
        type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
      });

      const recommended = await service.getRecommendedRuleType(true);
      expect(recommended).toBe(ExceptionRuleType.PAUSE_ONLY);
    });

    test('不基于使用习惯时应该推荐默认类型', async () => {
      const recommended = await service.getRecommendedRuleType(false);
      expect(recommended).toBe(ExceptionRuleType.PAUSE_ONLY);
    });
  });

  describe('规则搜索', () => {
    beforeEach(async () => {
      await storage.createRule({
        name: '上厕所',
        type: ExceptionRuleType.PAUSE_ONLY,
        description: '生理需求',
      });
      await storage.createRule({
        name: '喝水',
        type: ExceptionRuleType.PAUSE_ONLY,
        description: '补充水分',
      });
      await storage.createRule({
        name: '完成任务',
        type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
        description: '提前完成',
      });
    });

    test('应该能够按名称搜索规则', async () => {
      const results = await service.searchRules('厕所');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('上厕所');
    });

    test('应该能够按描述搜索规则', async () => {
      const results = await service.searchRules('水分');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('喝水');
    });

    test('应该能够按类型筛选搜索结果', async () => {
      const results = await service.searchRules(
        '',
        ExceptionRuleType.PAUSE_ONLY,
      );
      expect(results).toHaveLength(2);
      expect(
        results.every((r) => r.type === ExceptionRuleType.PAUSE_ONLY),
      ).toBe(true);
    });

    test('空查询应该返回所有规则', async () => {
      const results = await service.searchRules('');
      expect(results).toHaveLength(3);
    });

    test('搜索结果应该按相关性排序', async () => {
      // 更新使用频率
      const rules = await storage.getRules();
      const waterRule = rules.find((r) => r.name === '喝水')!;
      await storage.updateRule(waterRule.id, { usageCount: 10 });

      const results = await service.searchRules('水');
      expect(results[0].name).toBe('喝水'); // 名称匹配且使用频率高的应该在前面
    });
  });

  describe('显示名称', () => {
    test('应该返回正确的规则类型显示名称', () => {
      expect(service.getRuleTypeDisplayName(ExceptionRuleType.PAUSE_ONLY)).toBe(
        '仅暂停',
      );
      expect(
        service.getRuleTypeDisplayName(ExceptionRuleType.EARLY_COMPLETION_ONLY),
      ).toBe('仅提前完成');
    });

    test('应该返回正确的操作类型显示名称', () => {
      expect(service.getActionTypeDisplayName('pause')).toBe('暂停计时');
      expect(service.getActionTypeDisplayName('early_completion')).toBe(
        '提前完成',
      );
    });
  });

  describe('类型验证', () => {
    test('应该正确验证规则类型', () => {
      expect(service.isValidRuleType('pause_only')).toBe(true);
      expect(service.isValidRuleType('early_completion_only')).toBe(true);
      expect(service.isValidRuleType('invalid_type')).toBe(false);
    });

    test('应该正确验证操作类型', () => {
      expect(service.isValidActionType('pause')).toBe(true);
      expect(service.isValidActionType('early_completion')).toBe(true);
      expect(service.isValidActionType('invalid_action')).toBe(false);
    });
  });

  describe('使用建议', () => {
    test('应该提供规则使用建议', async () => {
      const rule1 = await storage.createRule({
        name: '高频规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });
      const rule2 = await storage.createRule({
        name: '最近使用规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });

      // 设置使用统计
      await storage.updateRule(rule1.id, {
        usageCount: 10,
        lastUsedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7天前
      });
      await storage.updateRule(rule2.id, {
        usageCount: 3,
        lastUsedAt: new Date(), // 刚刚使用
      });

      const suggestions = await service.getRuleUsageSuggestions('pause');

      expect(suggestions.mostUsed).toHaveLength(2);
      expect(suggestions.mostUsed[0].name).toBe('高频规则');

      expect(suggestions.recentlyUsed).toHaveLength(2);
      expect(suggestions.recentlyUsed[0].name).toBe('最近使用规则');

      expect(suggestions.suggested).toHaveLength(2);
    });

    test('没有规则时应该返回空建议', async () => {
      const suggestions = await service.getRuleUsageSuggestions('pause');

      expect(suggestions.mostUsed).toHaveLength(0);
      expect(suggestions.recentlyUsed).toHaveLength(0);
      expect(suggestions.suggested).toHaveLength(0);
    });
  });
});
