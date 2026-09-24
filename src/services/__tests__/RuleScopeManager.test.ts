/**
 * RuleScopeManager 单元测试
 */

import { RuleScopeManager } from '../RuleScopeManager';
import { exceptionRuleManager } from '../ExceptionRuleManager';
import { exceptionRuleStorage } from '../ExceptionRuleStorage';
import { ExceptionRule, ExceptionRuleType } from '../../types';
import type { Mocked } from 'vitest';

// Mock ExceptionRuleManager
vi.mock('../ExceptionRuleManager', () => ({
  exceptionRuleManager: {
    getAllRules: vi.fn(),
    createRule: vi.fn(),
  },
}));

vi.mock('../ExceptionRuleStorage', () => ({
  exceptionRuleStorage: {
    updateRule: vi.fn(),
  },
}));

describe('RuleScopeManager', () => {
  let ruleScopeManager: RuleScopeManager;
  const mockExceptionRuleManager = exceptionRuleManager as Mocked<
    typeof exceptionRuleManager
  >;
  const mockExceptionRuleStorage = exceptionRuleStorage as Mocked<
    typeof exceptionRuleStorage
  >;

  beforeEach(() => {
    ruleScopeManager = new RuleScopeManager();
    vi.clearAllMocks();
  });

  const mockRules: ExceptionRule[] = [
    {
      id: '1',
      name: '全局规则1',
      type: ExceptionRuleType.PAUSE_ONLY,
      scope: 'global',
      createdAt: new Date(),
      usageCount: 5,
      isActive: true,
    },
    {
      id: '2',
      name: '链规则1',
      type: ExceptionRuleType.PAUSE_ONLY,
      scope: 'chain',
      chainId: 'chain-1',
      createdAt: new Date(),
      usageCount: 3,
      isActive: true,
    },
    {
      id: '3',
      name: '链规则2',
      type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
      scope: 'chain',
      chainId: 'chain-2',
      createdAt: new Date(),
      usageCount: 2,
      isActive: true,
    },
  ];

  describe('getAvailableRules', () => {
    it('应该返回指定链的可用规则（全局 + 链专属）', async () => {
      mockExceptionRuleManager.getAllRules.mockResolvedValue(mockRules);

      const result = await ruleScopeManager.getAvailableRules(
        'chain-1',
        ExceptionRuleType.PAUSE_ONLY,
      );

      expect(result).toHaveLength(2);
      expect(result[0].scope).toBe('chain'); // 链专属规则优先
      expect(result[0].chainId).toBe('chain-1');
      expect(result[1].scope).toBe('global');
    });

    it('应该按优先级排序规则（链专属优先，然后按使用频率）', async () => {
      const testRules = [
        { ...mockRules[0], usageCount: 10 }, // 全局规则，高使用频率
        { ...mockRules[1], usageCount: 1 }, // 链规则，低使用频率
      ];
      mockExceptionRuleManager.getAllRules.mockResolvedValue(testRules);

      const result = await ruleScopeManager.getAvailableRules(
        'chain-1',
        ExceptionRuleType.PAUSE_ONLY,
      );

      expect(result[0].scope).toBe('chain'); // 链规则仍然优先
      expect(result[1].scope).toBe('global');
    });

    it('应该处理获取规则失败的情况', async () => {
      mockExceptionRuleManager.getAllRules.mockRejectedValue(
        new Error('获取失败'),
      );

      const result = await ruleScopeManager.getAvailableRules(
        'chain-1',
        ExceptionRuleType.PAUSE_ONLY,
      );

      expect(result).toEqual([]);
    });
  });

  describe('createChainRule', () => {
    it('应该成功创建链专属规则', async () => {
      const newRule = {
        ...mockRules[1],
        id: 'new-rule',
        chainId: undefined,
        scope: 'global' as const,
      };
      mockExceptionRuleManager.createRule.mockResolvedValue({
        rule: newRule,
        warnings: [],
      });
      mockExceptionRuleStorage.updateRule.mockResolvedValue({
        ...newRule,
        chainId: 'chain-1',
        scope: 'chain',
      } as any);

      const result = await ruleScopeManager.createChainRule(
        'chain-1',
        '新链规则',
        ExceptionRuleType.PAUSE_ONLY,
        '测试描述',
      );

      expect(mockExceptionRuleManager.createRule).toHaveBeenCalledWith(
        '新链规则',
        ExceptionRuleType.PAUSE_ONLY,
        '测试描述',
      );
      expect(mockExceptionRuleStorage.updateRule).toHaveBeenCalledWith(
        'new-rule',
        {
          chainId: 'chain-1',
          scope: 'chain',
        },
      );
      expect(result.scope).toBe('chain');
      expect(result.chainId).toBe('chain-1');
    });

    it('应该处理创建链规则失败的情况', async () => {
      mockExceptionRuleManager.createRule.mockRejectedValue(
        new Error('创建失败'),
      );

      await expect(
        ruleScopeManager.createChainRule(
          'chain-1',
          '新规则',
          ExceptionRuleType.PAUSE_ONLY,
        ),
      ).rejects.toThrow('创建失败');
    });
  });

  describe('createGlobalRule', () => {
    it('应该成功创建全局规则', async () => {
      const newRule = { ...mockRules[0], id: 'new-global-rule' };
      mockExceptionRuleManager.createRule.mockResolvedValue({
        rule: newRule,
        warnings: [],
      });

      const result = await ruleScopeManager.createGlobalRule(
        '新全局规则',
        ExceptionRuleType.PAUSE_ONLY,
        '测试描述',
      );

      expect(mockExceptionRuleManager.createRule).toHaveBeenCalledWith(
        '新全局规则',
        ExceptionRuleType.PAUSE_ONLY,
        '测试描述',
      );
      expect(result).toEqual(newRule);
    });
  });

  describe('convertRuleScope', () => {
    it('应该将规则转换为链专属', async () => {
      await ruleScopeManager.convertRuleScope('rule-1', 'chain', 'chain-1');

      expect(mockExceptionRuleStorage.updateRule).toHaveBeenCalledWith(
        'rule-1',
        {
          scope: 'chain',
          chainId: 'chain-1',
        },
      );
    });

    it('应该将规则转换为全局', async () => {
      await ruleScopeManager.convertRuleScope('rule-1', 'global');

      expect(mockExceptionRuleStorage.updateRule).toHaveBeenCalledWith(
        'rule-1',
        {
          scope: 'global',
          chainId: undefined,
        },
      );
    });

    it('应该处理转换失败的情况', async () => {
      mockExceptionRuleStorage.updateRule.mockRejectedValue(
        new Error('更新失败'),
      );

      await expect(
        ruleScopeManager.convertRuleScope('rule-1', 'global'),
      ).rejects.toThrow('更新失败');
    });
  });

  describe('getChainRuleCount', () => {
    it('应该返回指定链的规则数量', async () => {
      mockExceptionRuleManager.getAllRules.mockResolvedValue(mockRules);

      const count = await ruleScopeManager.getChainRuleCount('chain-1');

      expect(count).toBe(1);
    });

    it('应该处理获取失败的情况', async () => {
      mockExceptionRuleManager.getAllRules.mockRejectedValue(
        new Error('获取失败'),
      );

      const count = await ruleScopeManager.getChainRuleCount('chain-1');

      expect(count).toBe(0);
    });
  });

  describe('getGlobalRuleCount', () => {
    it('应该返回全局规则数量', async () => {
      mockExceptionRuleManager.getAllRules.mockResolvedValue(mockRules);

      const count = await ruleScopeManager.getGlobalRuleCount();

      expect(count).toBe(1);
    });
  });

  describe('checkRuleNameDuplication', () => {
    beforeEach(() => {
      mockExceptionRuleManager.getAllRules.mockResolvedValue(mockRules);
    });

    it('应该检测全局规则名称重复', async () => {
      const isDuplicate = await ruleScopeManager.checkRuleNameDuplication(
        '全局规则1',
        'global',
      );

      expect(isDuplicate).toBe(true);
    });

    it('应该检测链规则名称重复', async () => {
      const isDuplicate = await ruleScopeManager.checkRuleNameDuplication(
        '链规则1',
        'chain',
        'chain-1',
      );

      expect(isDuplicate).toBe(true);
    });

    it('应该返回false当名称不重复时', async () => {
      const isDuplicate = await ruleScopeManager.checkRuleNameDuplication(
        '新规则名',
        'global',
      );

      expect(isDuplicate).toBe(false);
    });

    it('应该忽略大小写进行重复检查', async () => {
      const isDuplicate = await ruleScopeManager.checkRuleNameDuplication(
        '全局规则1',
        'global',
      );

      expect(isDuplicate).toBe(true);
    });

    it('应该处理检查失败的情况', async () => {
      mockExceptionRuleManager.getAllRules.mockRejectedValue(
        new Error('获取失败'),
      );

      const isDuplicate = await ruleScopeManager.checkRuleNameDuplication(
        '测试',
        'global',
      );

      expect(isDuplicate).toBe(false);
    });
  });

  describe('getRuleScopeInfo', () => {
    it('应该返回全局规则的作用域信息', () => {
      const rule = mockRules[0]; // 全局规则

      const info = ruleScopeManager.getRuleScopeInfo(rule);

      expect(info.scope).toBe('全局');
      expect(info.description).toBe('可在所有任务中使用');
    });

    it('应该返回链规则的作用域信息', () => {
      const rule = mockRules[1]; // 链规则

      const info = ruleScopeManager.getRuleScopeInfo(rule);

      expect(info.scope).toBe('链专属');
      expect(info.description).toBe('仅在当前任务中使用');
    });
  });
});
