import { errorClassificationService } from '../ErrorClassificationService';
import { exceptionRuleStorage } from '../ExceptionRuleStorage';
import { checkDataIntegrity } from './checks/dataIntegrity';
import { checkErrorHandling } from './checks/errorHandling';
import { checkStorage } from './checks/storage';
import { checkValidationService } from './checks/validation';
import { generateRecommendations } from './recommendations';
import { statusFromScore } from './scoring';
import { generateSummary } from './summary';
import type {
  ComponentHealth,
  QuickHealthCheckResult,
  SystemHealthReport,
} from './types';

class SystemHealthService {
  async performHealthCheck(): Promise<SystemHealthReport> {
    const components: ComponentHealth[] = [];

    components.push(await checkDataIntegrity());
    components.push(await checkValidationService());
    components.push(await checkErrorHandling());
    components.push(await checkStorage());

    const totalScore = components.reduce((sum, comp) => sum + comp.score, 0);
    const averageScore = totalScore / components.length;

    const status = statusFromScore(averageScore);
    const recommendations = generateRecommendations(components);
    const summary = generateSummary(status, averageScore, components);

    return {
      status,
      score: Math.round(averageScore),
      timestamp: new Date(),
      components,
      recommendations,
      summary,
    };
  }

  async quickHealthCheck(): Promise<QuickHealthCheckResult> {
    const issues: string[] = [];
    let score = 100;

    try {
      const rules = await exceptionRuleStorage.getRules();
      if (rules.length === 0) {
        issues.push('没有规则数据');
        score -= 30;
      }

      const errorStats = errorClassificationService.getErrorStatistics();
      const criticalErrors = errorStats.errorsBySeverity.get('critical') || 0;
      if (criticalErrors > 0) {
        issues.push(`${criticalErrors} 个严重错误`);
        score -= 25;
      }
    } catch {
      issues.push('系统检查失败');
      score = 0;
    }

    score = Math.max(0, score);
    const status = statusFromScore(score);

    return { status, score, issues };
  }
}

export const systemHealthService = new SystemHealthService();
