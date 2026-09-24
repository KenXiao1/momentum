/**
 * 例外规则存储服务测试
 */

import { ExceptionRuleStorageService } from '../ExceptionRuleStorage';
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

describe('ExceptionRuleStorageService', () => {
  let storage: ExceptionRuleStorageService;

  beforeEach(() => {
    storage = new ExceptionRuleStorageService();
    localStorage.clear();
  });

  describe('规则CRUD操作', () => {
    test('应该能够创建新规则', async () => {
      const ruleData = {
        name: '测试规则',
        type: ExceptionRuleType.PAUSE_ONLY,
        description: '这是一个测试规则',
      };

      const rule = await storage.createRule(ruleData);

      expect(rule.id).toBeDefined();
      expect(rule.name).toBe(ruleData.name);
      expect(rule.type).toBe(ruleData.type);
      expect(rule.description).toBe(ruleData.description);
      expect(rule.usageCount).toBe(0);
      expect(rule.isActive).toBe(true);
      expect(rule.createdAt).toBeInstanceOf(Date);
    });

    test('应该能够获取所有规则', async () => {
      await storage.createRule({
        name: '规则1',
        type: ExceptionRuleType.PAUSE_ONLY,
      });
      await storage.createRule({
        name: '规则2',
        type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
      });

      const rules = await storage.getRules();
      expect(rules).toHaveLength(2);
      expect(rules[0].name).toBe('规则1');
      expect(rules[1].name).toBe('规则2');
    });

    test('应该能够根据ID获取规则', async () => {
      const createdRule = await storage.createRule({
        name: '测试规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });

      const rule = await storage.getRuleById(createdRule.id);
      expect(rule).not.toBeNull();
      expect(rule!.id).toBe(createdRule.id);
      expect(rule!.name).toBe('测试规则');
    });

    test('应该能够根据类型获取规则', async () => {
      await storage.createRule({
        name: '暂停规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });
      await storage.createRule({
        name: '完成规则',
        type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
      });

      const pauseRules = await storage.getRulesByType(
        ExceptionRuleType.PAUSE_ONLY,
      );
      const completionRules = await storage.getRulesByType(
        ExceptionRuleType.EARLY_COMPLETION_ONLY,
      );

      expect(pauseRules).toHaveLength(1);
      expect(pauseRules[0].name).toBe('暂停规则');
      expect(completionRules).toHaveLength(1);
      expect(completionRules[0].name).toBe('完成规则');
    });

    test('应该能够更新规则', async () => {
      const rule = await storage.createRule({
        name: '原始规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });

      const updatedRule = await storage.updateRule(rule.id, {
        name: '更新后的规则',
        description: '新的描述',
      });

      expect(updatedRule.name).toBe('更新后的规则');
      expect(updatedRule.description).toBe('新的描述');
      expect(updatedRule.type).toBe(ExceptionRuleType.PAUSE_ONLY);
    });

    test('应该能够删除规则（软删除）', async () => {
      const rule = await storage.createRule({
        name: '待删除规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });

      await storage.deleteRule(rule.id);

      const allRules = await storage.getRules();
      const activeRules = await storage.getRulesByType(
        ExceptionRuleType.PAUSE_ONLY,
      );

      expect(allRules[0].isActive).toBe(false);
      expect(activeRules).toHaveLength(0);
    });
  });

  describe('规则验证', () => {
    test('应该拒绝重复的规则名称', async () => {
      await storage.createRule({
        name: '重复规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });

      await expect(
        storage.createRule({
          name: '重复规则',
          type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
        }),
      ).rejects.toThrow(ExceptionRuleException);
    });

    test('应该验证规则名称不能为空', () => {
      expect(() => storage.validateRule({ name: '' })).toThrow(
        ExceptionRuleException,
      );
      expect(() => storage.validateRule({ name: '   ' })).toThrow(
        ExceptionRuleException,
      );
    });

    test('应该验证规则名称长度限制', () => {
      const longName = 'a'.repeat(101);
      expect(() => storage.validateRule({ name: longName })).toThrow(
        ExceptionRuleException,
      );
    });

    test('应该验证规则类型有效性', () => {
      expect(() =>
        storage.validateRule({
          name: '测试',
          type: 'invalid_type' as ExceptionRuleType,
        }),
      ).toThrow(ExceptionRuleException);
    });

    test('应该验证描述长度限制', () => {
      const longDescription = 'a'.repeat(501);
      expect(() =>
        storage.validateRule({
          name: '测试',
          description: longDescription,
        }),
      ).toThrow(ExceptionRuleException);
    });
  });

  describe('使用记录管理', () => {
    test('应该能够创建使用记录', async () => {
      const rule = await storage.createRule({
        name: '测试规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });

      const recordData = {
        ruleId: rule.id,
        chainId: 'chain_1',
        sessionId: 'session_1',
        ruleScope: 'global' as const,
        actionType: 'pause' as const,
        taskElapsedTime: 300,
        taskRemainingTime: 600,
      };

      const record = await storage.createUsageRecord(recordData);

      expect(record.id).toBeDefined();
      expect(record.ruleId).toBe(rule.id);
      expect(record.actionType).toBe('pause');
      expect(record.taskElapsedTime).toBe(300);
      expect(record.usedAt).toBeInstanceOf(Date);
    });

    test('应该能够获取规则的使用记录', async () => {
      const rule = await storage.createRule({
        name: '测试规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });

      await storage.createUsageRecord({
        ruleId: rule.id,
        chainId: 'chain_1',
        sessionId: 'session_1',
        ruleScope: 'global' as const,
        actionType: 'pause',
        taskElapsedTime: 300,
      });

      await storage.createUsageRecord({
        ruleId: rule.id,
        chainId: 'chain_2',
        sessionId: 'session_2',
        ruleScope: 'global' as const,
        actionType: 'pause',
        taskElapsedTime: 450,
      });

      const records = await storage.getUsageRecordsByRuleId(rule.id);
      expect(records).toHaveLength(2);
      expect(records[0].taskElapsedTime).toBe(450); // 最新的记录在前
      expect(records[1].taskElapsedTime).toBe(300);
    });

    test('创建使用记录应该更新规则统计', async () => {
      const rule = await storage.createRule({
        name: '测试规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });

      await storage.createUsageRecord({
        ruleId: rule.id,
        chainId: 'chain_1',
        sessionId: 'session_1',
        ruleScope: 'global' as const,
        actionType: 'pause',
        taskElapsedTime: 300,
      });

      const updatedRule = await storage.getRuleById(rule.id);
      expect(updatedRule!.usageCount).toBe(1);
      expect(updatedRule!.lastUsedAt).toBeInstanceOf(Date);
    });
  });

  describe('数据导入导出', () => {
    test('应该能够导出数据', async () => {
      const rule = await storage.createRule({
        name: '测试规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });

      await storage.createUsageRecord({
        ruleId: rule.id,
        chainId: 'chain_1',
        sessionId: 'session_1',
        ruleScope: 'global' as const,
        actionType: 'pause',
        taskElapsedTime: 300,
      });

      const exportedData = await storage.exportData();

      expect(exportedData.rules).toHaveLength(1);
      expect(exportedData.usageRecords).toHaveLength(1);
      expect(exportedData.lastSyncAt).toBeInstanceOf(Date);
    });

    test('应该能够导入数据（替换模式）', async () => {
      // 创建现有数据
      await storage.createRule({
        name: '现有规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });

      const importData = {
        rules: [
          {
            scope: 'global' as const,
            id: 'imported_rule_1',
            name: '导入规则',
            type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
            createdAt: new Date(),
            usageCount: 5,
            isActive: true,
          },
        ],
        usageRecords: [],
        lastSyncAt: new Date(),
      };

      await storage.importData(importData, 'replace');

      const rules = await storage.getRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].name).toBe('导入规则');
    });

    test('应该能够导入数据（合并模式）', async () => {
      // 创建现有数据
      await storage.createRule({
        name: '现有规则',
        type: ExceptionRuleType.PAUSE_ONLY,
      });

      const importData = {
        rules: [
          {
            scope: 'global' as const,
            id: 'imported_rule_1',
            name: '导入规则',
            type: ExceptionRuleType.EARLY_COMPLETION_ONLY,
            createdAt: new Date(),
            usageCount: 5,
            isActive: true,
          },
        ],
        usageRecords: [],
        lastSyncAt: new Date(),
      };

      await storage.importData(importData, 'merge');

      const rules = await storage.getRules();
      expect(rules).toHaveLength(2);
      expect(rules.some((r) => r.name === '现有规则')).toBe(true);
      expect(rules.some((r) => r.name === '导入规则')).toBe(true);
    });
  });

  describe('错误处理', () => {
    test('获取不存在的规则应该返回null', async () => {
      const rule = await storage.getRuleById('non_existent_id');
      expect(rule).toBeNull();
    });

    test('更新不存在的规则应该抛出错误', async () => {
      await expect(
        storage.updateRule('non_existent_id', { name: '新名称' }),
      ).rejects.toThrow(ExceptionRuleException);
    });

    test('删除不存在的规则应该抛出错误', async () => {
      await expect(storage.deleteRule('non_existent_id')).rejects.toThrow(
        ExceptionRuleException,
      );
    });
  });
});
