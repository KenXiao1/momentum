import type { ComponentHealth } from './types';

function getNumberMetric(
  metrics: Record<string, unknown> | undefined,
  key: string,
): number | null {
  if (!metrics) return null;

  const value = metrics[key];
  return typeof value === 'number' ? value : null;
}

function getRecommendationsForComponent(component: ComponentHealth): string[] {
  const recommendations: string[] = [];

  if (component.status === 'critical') {
    recommendations.push(`紧急修复 ${component.name} 组件`);
  } else if (component.status === 'warning') {
    recommendations.push(`关注 ${component.name} 组件的问题`);
  }

  if (component.name === '数据完整性' && component.issues.length > 0) {
    recommendations.push('运行数据修复工具');
  }

  if (component.name === '错误处理') {
    const criticalErrors = getNumberMetric(component.metrics, 'criticalErrors');
    if (criticalErrors !== null && criticalErrors > 0) {
      recommendations.push('检查并解决严重错误');
    }
  }

  return recommendations;
}

export function generateRecommendations(
  components: ComponentHealth[],
): string[] {
  const recommendations: string[] = [];

  for (const component of components) {
    recommendations.push(...getRecommendationsForComponent(component));
  }

  if (components.some((component) => component.status === 'critical')) {
    recommendations.push('考虑重启系统或联系技术支持');
  }

  return [...new Set(recommendations)]; // 去重
}
