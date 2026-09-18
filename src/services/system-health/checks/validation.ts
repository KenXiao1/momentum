import { validateRulesIntegrity } from '../../validateRulesIntegrity';
import { exceptionRuleStorage } from '../../ExceptionRuleStorage';
import { statusFromScore } from '../scoring';
import type { ComponentHealth } from '../types';

export async function checkValidationService(): Promise<ComponentHealth> {
  try {
    const rules = await exceptionRuleStorage.getRules();
    const sampleRules = rules.slice(0, 10); // 测试前10个规则

    const issues: string[] = [];
    let score = 100;

    if (sampleRules.length > 0) {
      const report = await validateRulesIntegrity(sampleRules);

      if (report.invalidRules.length > 0) {
        issues.push(`${report.invalidRules.length} 个规则验证失败`);
        score -= (report.invalidRules.length / sampleRules.length) * 50;
      }
    }

    score = Math.max(0, score);

    return {
      name: '验证服务',
      status: statusFromScore(score),
      score,
      issues,
      metrics: {
        testedRules: sampleRules.length,
        totalRules: rules.length,
      },
    };
  } catch {
    return {
      name: '验证服务',
      status: 'critical',
      score: 0,
      issues: ['验证服务检查失败'],
    };
  }
}
