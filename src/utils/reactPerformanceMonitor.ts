/**
 * Performance report utility to track React optimization improvements
 */

import { isDev } from './env';
import { performanceLogger } from './performanceLogger';

interface PerformanceMetrics {
  renderTimes: number[];
  totalRenders: number;
}

interface ComponentRenderMetrics {
  renderCount: number;
  totalDuration: number;
  maxDuration: number;
  lastDuration: number;
  avgDuration: number;
  lastPhase: string;
}

class ReactPerformanceMonitor {
  private metrics: PerformanceMetrics = {
    renderTimes: [],
    totalRenders: 0,
  };

  private componentMetrics = new Map<string, ComponentRenderMetrics>();

  /**
   * Track a component render time
   */
  trackRender(componentName: string, renderTime: number) {
    this.metrics.renderTimes.push(renderTime);
    this.metrics.totalRenders++;

    if (isDev && renderTime > 16) {
      performanceLogger.warn(
        `[PERF] Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`,
      );
    }
  }

  trackComponentRender(
    componentName: string,
    phase: string,
    renderTime: number,
  ) {
    this.trackRender(componentName, renderTime);

    const previous = this.componentMetrics.get(componentName);
    const totalDuration = (previous?.totalDuration ?? 0) + renderTime;
    const renderCount = (previous?.renderCount ?? 0) + 1;

    this.componentMetrics.set(componentName, {
      renderCount,
      totalDuration,
      maxDuration: Math.max(previous?.maxDuration ?? 0, renderTime),
      lastDuration: renderTime,
      avgDuration: totalDuration / renderCount,
      lastPhase: phase,
    });
  }

  getComponentStats(): Record<string, ComponentRenderMetrics> {
    return Object.fromEntries(this.componentMetrics.entries());
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const avgRenderTime =
      this.metrics.renderTimes.length > 0
        ? this.metrics.renderTimes.reduce((a, b) => a + b, 0) /
          this.metrics.renderTimes.length
        : 0;

    const maxRenderTime =
      this.metrics.renderTimes.length > 0
        ? Math.max(...this.metrics.renderTimes)
        : 0;

    return {
      avgRenderTime: avgRenderTime.toFixed(2),
      maxRenderTime: maxRenderTime.toFixed(2),
      totalRenders: this.metrics.totalRenders,
      components: this.getComponentStats(),
    };
  }

  /**
   * Generate a performance report
   */
  generateReport() {
    const stats = this.getStats();

    performanceLogger.group('📊 React Performance Report', () => {
      performanceLogger.log('🚀 Render Performance:');
      performanceLogger.log(`  • Total renders: ${stats.totalRenders}`);
      performanceLogger.log(
        `  • Average render time: ${stats.avgRenderTime}ms`,
      );
      performanceLogger.log(`  • Max render time: ${stats.maxRenderTime}ms`);

      const componentEntries = Object.entries(stats.components);
      if (componentEntries.length > 0) {
        performanceLogger.log('🧩 Component Render Breakdown:');
        for (const [name, componentStats] of componentEntries) {
          performanceLogger.log(
            `  • ${name}: ${componentStats.renderCount} renders, avg ${componentStats.avgDuration.toFixed(2)}ms, max ${componentStats.maxDuration.toFixed(2)}ms`,
          );
        }
      }

      // Performance recommendations
      if (parseFloat(stats.avgRenderTime) > 16) {
        performanceLogger.warn(
          '⚠️  Average render time exceeds 16ms (60 FPS threshold)',
        );
      }
    });

    return stats;
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      renderTimes: [],
      totalRenders: 0,
    };
    this.componentMetrics.clear();
  }
}

// Singleton instance
export const reactPerformanceMonitor = new ReactPerformanceMonitor();
