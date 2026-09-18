import {
  ExceptionRule,
  ExceptionRuleError,
  ExceptionRuleException,
  ExceptionRuleType,
} from '../types';
import { exceptionRuleStorage } from './ExceptionRuleStorage';
import { getErrorMessage } from '../utils/errorMessage';
interface ValidationReport {
  totalRules: number;
  validRules: number;
  invalidRules: ValidationIssue[];
  summary: string;
}

interface ValidationIssue {
  ruleId: string;
  ruleName: string;
  issue: string;
  severity: 'critical' | 'warning' | 'info';
  fixable: boolean;
}

function isValidRuleType(type: string): type is ExceptionRuleType {
  return Object.values(ExceptionRuleType).includes(type as ExceptionRuleType);
}

function validateSingleRuleIntegrity(rule: ExceptionRule): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!rule.id) {
    issues.push({
      ruleId: rule.id || 'unknown',
      ruleName: rule.name || 'unnamed',
      issue: '缺少规则ID',
      severity: 'critical',
      fixable: true,
    });
  }

  if (!rule.name || rule.name.trim().length === 0) {
    issues.push({
      ruleId: rule.id,
      ruleName: rule.name || 'unnamed',
      issue: '规则名称为空',
      severity: 'critical',
      fixable: false,
    });
  }

  if (!rule.type) {
    issues.push({
      ruleId: rule.id,
      ruleName: rule.name,
      issue: '缺少规则类型',
      severity: 'critical',
      fixable: true,
    });
  } else if (!isValidRuleType(rule.type)) {
    issues.push({
      ruleId: rule.id,
      ruleName: rule.name,
      issue: `无效的规则类型: ${rule.type}`,
      severity: 'critical',
      fixable: true,
    });
  }

  if (!rule.createdAt) {
    issues.push({
      ruleId: rule.id,
      ruleName: rule.name,
      issue: '缺少创建时间',
      severity: 'warning',
      fixable: true,
    });
  }

  if (typeof rule.usageCount !== 'number' || rule.usageCount < 0) {
    issues.push({
      ruleId: rule.id,
      ruleName: rule.name,
      issue: '使用计数无效',
      severity: 'warning',
      fixable: true,
    });
  }

  return issues;
}

export async function validateRulesIntegrity(
  rules?: ExceptionRule[],
): Promise<ValidationReport> {
  try {
    const rulesToValidate = rules || (await exceptionRuleStorage.getRules());
    const issues: ValidationIssue[] = [];
    let validCount = 0;

    for (const rule of rulesToValidate) {
      const ruleIssues = validateSingleRuleIntegrity(rule);
      if (ruleIssues.length === 0) {
        validCount++;
      } else {
        issues.push(...ruleIssues);
      }
    }

    const summary = `验证了 ${rulesToValidate.length} 个规则，${validCount} 个有效，${issues.length} 个问题`;

    return {
      totalRules: rulesToValidate.length,
      validRules: validCount,
      invalidRules: issues,
      summary,
    };
  } catch (error) {
    throw new ExceptionRuleException(
      ExceptionRuleError.VALIDATION_ERROR,
      `批量验证失败: ${getErrorMessage(error)}`,
      error,
    );
  }
}
