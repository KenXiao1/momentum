/**
 * 数据完整性检查器
 *
 * 这是一个门面类，整合了以下子模块：
 * - RuleIntegrityChecker: 规则完整性检查
 * - UsageRecordIntegrityChecker: 使用记录检查
 * - IntegrityReportGenerator: 报告生成
 *
 * @see src/services/integrity/
 */

import { ExceptionRuleError, ExceptionRuleException } from '../types';
import { exceptionRuleStorage } from './ExceptionRuleStorage';
import { ruleIntegrityChecker } from './integrity/RuleIntegrityChecker';
import { usageRecordIntegrityChecker } from './integrity/UsageRecordIntegrityChecker';
import { integrityReportGenerator } from './integrity/IntegrityReportGenerator';
import type {
  IntegrityIssue,
  IntegrityReport,
  FixResult,
} from './integrity/IntegrityTypes';

class DataIntegrityChecker {
  async checkRuleDataIntegrity(): Promise<IntegrityReport> {
    try {
      const issues: IntegrityIssue[] = [];
      const rules = await exceptionRuleStorage.getRules();
      const usageRecords = await exceptionRuleStorage.getUsageRecords();

      issues.push(...ruleIntegrityChecker.validateRuleIds(rules));
      issues.push(...ruleIntegrityChecker.checkDuplicateNames(rules));
      issues.push(...ruleIntegrityChecker.checkRuleFields(rules));
      issues.push(
        ...usageRecordIntegrityChecker.checkUsageRecordsIntegrity(
          usageRecords,
          rules,
        ),
      );
      issues.push(
        ...usageRecordIntegrityChecker.checkDataConsistency(
          rules,
          usageRecords,
        ),
      );

      return integrityReportGenerator.generateReport(issues);
    } catch (error) {
      throw new ExceptionRuleException(
        ExceptionRuleError.STORAGE_ERROR,
        `数据完整性检查失败: ${error instanceof Error ? error.message : '未知错误'}`,
        error,
      );
    }
  }

  async autoFixIssues(issues: IntegrityIssue[]): Promise<FixResult[]> {
    const results: FixResult[] = [];
    const autoFixableIssues = issues.filter((issue) => issue.autoFixable);

    for (const issue of autoFixableIssues) {
      try {
        if (issue.fixAction) {
          await issue.fixAction();
          const result: FixResult = {
            issueType: issue.type,
            success: true,
            message: `已修复: ${issue.description}`,
            details: issue.details,
          };
          results.push(result);
        }
      } catch (error) {
        const result: FixResult = {
          issueType: issue.type,
          success: false,
          message: `修复失败: ${error instanceof Error ? error.message : '未知错误'}`,
          details: { issue, error },
        };
        results.push(result);
      }
    }

    return results;
  }

  validateRuleIds =
    ruleIntegrityChecker.validateRuleIds.bind(ruleIntegrityChecker);
  checkDuplicateNames =
    ruleIntegrityChecker.checkDuplicateNames.bind(ruleIntegrityChecker);
}

export const dataIntegrityChecker = new DataIntegrityChecker();
