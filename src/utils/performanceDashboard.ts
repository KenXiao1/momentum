import { queryOptimizer } from './queryOptimizer';

/**
 * Performance Dashboard - Monitor query optimization and cache performance
 */

export class PerformanceDashboard {
  private static instance: PerformanceDashboard;
  private metricsHistory: Array<{
    timestamp: number;
    cacheSize: number;
    pendingQueries: number;
    hitRate: number;
  }> = [];
  
  private cacheHits = 0;
  private cacheMisses = 0;
  
  static getInstance(): PerformanceDashboard {
    if (!PerformanceDashboard.instance) {
      PerformanceDashboard.instance = new PerformanceDashboard();
    }
    return PerformanceDashboard.instance;
  }
  
  recordCacheHit(): void {
    this.cacheHits++;
  }
  
  recordCacheMiss(): void {
    this.cacheMisses++;
  }
  
  getHitRate(): number {
    const total = this.cacheHits + this.cacheMisses;
    return total > 0 ? (this.cacheHits / total) * 100 : 0;
  }
  
  captureMetrics(): void {
    const stats = queryOptimizer.getCacheStats();
    const hitRate = this.getHitRate();
    
    this.metricsHistory.push({
      timestamp: Date.now(),
      cacheSize: stats.cacheSize,
      pendingQueries: stats.pendingQueries,
      hitRate
    });
    
    // Keep only last 50 entries
    if (this.metricsHistory.length > 50) {
      this.metricsHistory.shift();
    }
  }
  
  displayConsoleReport(): void {
    const stats = queryOptimizer.getCacheStats();
    const hitRate = this.getHitRate();
    
    console.group('[PERFORMANCE DASHBOARD]');
    console.log('Cache Size:', stats.cacheSize);
    console.log('Pending Queries:', stats.pendingQueries);
    console.log('Cache Hit Rate:', hitRate.toFixed(2) + '%');
    console.log('Total Cache Hits:', this.cacheHits);
    console.log('Total Cache Misses:', this.cacheMisses);
    console.log('Active Cache Keys:', stats.cacheKeys);
    console.groupEnd();
  }
  
  getPerformanceReport() {
    return {
      ...queryOptimizer.getCacheStats(),
      hitRate: this.getHitRate(),
      totalHits: this.cacheHits,
      totalMisses: this.cacheMisses,
      metricsHistory: [...this.metricsHistory]
    };
  }
  
  reset(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.metricsHistory = [];
    queryOptimizer.clearCache();
  }
}

// Export singleton instance
export const performanceDashboard = PerformanceDashboard.getInstance();

// Auto-capture metrics every 30 seconds in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    performanceDashboard.captureMetrics();
  }, 30000);
}
