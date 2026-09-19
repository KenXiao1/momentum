/**
 * RuleExportImportService - 规则导入导出服务
 * 负责规则的导入和导出逻辑
 */

import {
  ExceptionRule,
  RuleUsageRecord,
  ExceptionRuleError,
  ExceptionRuleException,
} from '../../types';
import { exceptionRuleStorage } from '../ExceptionRuleStorage';
import { ruleCreator } from './RuleCreator';
import { ruleMaintenanceService } from './RuleMaintenanceService';
import { findExactDuplicateRules } from '../duplication/duplicationDetection';

interface ImportOptions {
  skipDuplicates?: boolean;
  updateExisting?: boolean;
}

export interface ImportResult {
  imported: ExceptionRule[];
  skipped: Array<{ name: string; reason: string }>;
  errors: Array<{ name: string; error: string }>;
}

export interface ExportResult {
  rules: ExceptionRule[];
  usageRecords?: RuleUsageRecord[];
  exportedAt: Date;
  summary: {
    totalRules: number;
    totalUsageRecords: number;
  };
}

interface RuleImportData {
  name: string;
  type: ExceptionRule['type'];
  description?: string;
}

/**
 * 规则导入导出服务类
 * 单一职责：处理规则的导入和导出
 */
class RuleExportImportService {
  private async handleDuplicateImport(params: {
    ruleData: RuleImportData;
    duplicates: ExceptionRule[];
    options: ImportOptions;
    imported: ExceptionRule[];
    skipped: Array<{ name: string; reason: string }>;
    errors: Array<{ name: string; error: string }>;
  }): Promise<boolean> {
    const { ruleData, duplicates, options, imported, skipped, errors } = params;
    if (duplicates.length === 0) return false;

    if (options.skipDuplicates) {
      skipped.push({ name: ruleData.name, reason: 'Rule name already exists' });
      return true;
    }

    if (options.updateExisting) {
      const existingRule = duplicates[0];
      const updated = await ruleMaintenanceService.updateRule(existingRule.id, {
        type: ruleData.type,
        description: ruleData.description,
      });
      imported.push(updated.rule);
      return true;
    }

    errors.push({ name: ruleData.name, error: 'Rule name already exists' });
    return true;
  }

  /**
   * 批量导入规则
   */
  async importRules(
    rules: RuleImportData[],
    options: ImportOptions = {},
  ): Promise<ImportResult> {
    const imported: ExceptionRule[] = [];
    const skipped: Array<{ name: string; reason: string }> = [];
    const errors: Array<{ name: string; error: string }> = [];

    for (const ruleData of rules) {
      try {
        const existingRules = await exceptionRuleStorage.getRules();
        const duplicates = findExactDuplicateRules(
          existingRules,
          ruleData.name,
        );

        const wasDuplicateHandled = await this.handleDuplicateImport({
          ruleData,
          duplicates,
          options,
          imported,
          skipped,
          errors,
        });
        if (wasDuplicateHandled) continue;

        const { rule } = await ruleCreator.createRule(
          ruleData.name,
          ruleData.type,
          ruleData.description,
        );
        imported.push(rule);
      } catch (error) {
        errors.push({
          name: ruleData.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { imported, skipped, errors };
  }

  /**
   * 导出规则数据
   */
  async exportRules(includeUsageData: boolean = false): Promise<ExportResult> {
    try {
      const rules = await exceptionRuleStorage.getRules();
      const activeRules = rules.filter((r) => r.isActive);

      let usageRecords: RuleUsageRecord[] | undefined;
      if (includeUsageData) {
        usageRecords = await exceptionRuleStorage.getUsageRecords();
      }

      return {
        rules: activeRules,
        usageRecords,
        exportedAt: new Date(),
        summary: {
          totalRules: activeRules.length,
          totalUsageRecords: usageRecords?.length || 0,
        },
      };
    } catch (error) {
      throw new ExceptionRuleException(
        ExceptionRuleError.STORAGE_ERROR,
        'Failed to export rule data',
        error,
      );
    }
  }
}

export const ruleExportImportService = new RuleExportImportService();
