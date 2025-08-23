/**
 * 内存优化器
 * 
 * 提供以下功能：
 * - 内存使用监控
 * - 自动内存清理
 * - 内存压力管理
 * - 垃圾回收优化
 * - 内存泄漏检测
 */

interface MemoryStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  timestamp: number;
}

interface MemoryThresholds {
  warning: number;  // 警告阈值（MB）
  critical: number; // 危险阈值（MB）
  cleanup: number;  // 清理阈值（MB）
}

interface MemoryOptimizationConfig {
  monitoringInterval: number;     // 监控间隔（ms）
  enableAutoCleanup: boolean;     // 启用自动清理
  enableGCOptimization: boolean;  // 启用GC优化
  thresholds: MemoryThresholds;
  maxHistorySize: number;         // 最大历史记录数
}

interface CleanupTask {
  name: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  cleanup: () => Promise<void> | void;
  estimatedMemoryFreed: number; // MB
}

class MemoryOptimizer {
  private static instance: MemoryOptimizer;
  private config: MemoryOptimizationConfig;
  private memoryHistory: MemoryStats[] = [];
  private cleanupTasks: CleanupTask[] = [];
  private monitoringTimer: NodeJS.Timeout | null = null;
  private isCleaningUp = false;
  private lastCleanupTime = 0;

  private constructor() {
    this.config = {
      monitoringInterval: 30000, // 30秒
      enableAutoCleanup: true,
      enableGCOptimization: true,
      thresholds: {
        warning: 100,   // 100MB
        critical: 200,  // 200MB
        cleanup: 150    // 150MB
      },
      maxHistorySize: 288 // 24小时的5分钟间隔记录
    };

    this.initializeMemoryMonitoring();
    this.registerDefaultCleanupTasks();
  }

  static getInstance(): MemoryOptimizer {
    if (!this.instance) {
      this.instance = new MemoryOptimizer();
    }
    return this.instance;
  }

  /**
   * 初始化内存监控
   */
  private initializeMemoryMonitoring(): void {
    this.startMonitoring();

    // 在页面卸载时执行清理
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.performEmergencyCleanup();
      });

      // 监听内存压力事件
      if ('memory' in performance && 'onmemorywarning' in performance) {
        (performance as any).addEventListener('memorywarning', () => {
          this.handleMemoryPressure();
        });
      }
    }
  }

  /**
   * 开始内存监控
   */
  startMonitoring(): void {
    if (this.monitoringTimer) return;

    this.monitoringTimer = setInterval(() => {
      this.collectMemoryStats();
      this.analyzeMemoryUsage();
    }, this.config.monitoringInterval);

    // 立即收集一次统计信息
    this.collectMemoryStats();
  }

  /**
   * 停止内存监控
   */
  stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
  }

  /**
   * 收集内存统计信息
   */
  private collectMemoryStats(): void {
    if (typeof performance === 'undefined' || !performance.memory) {
      return;
    }

    const memoryInfo = performance.memory;
    const stats: MemoryStats = {
      usedJSHeapSize: memoryInfo.usedJSHeapSize,
      totalJSHeapSize: memoryInfo.totalJSHeapSize,
      jsHeapSizeLimit: memoryInfo.jsHeapSizeLimit,
      timestamp: Date.now()
    };

    this.memoryHistory.push(stats);

    // 保持历史记录在限制范围内
    if (this.memoryHistory.length > this.config.maxHistorySize) {
      this.memoryHistory = this.memoryHistory.slice(-this.config.maxHistorySize);
    }
  }

  /**
   * 分析内存使用情况
   */
  private analyzeMemoryUsage(): void {
    const currentStats = this.getCurrentMemoryStats();
    if (!currentStats) return;

    const usedMB = currentStats.usedJSHeapSize / (1024 * 1024);
    const totalMB = currentStats.totalJSHeapSize / (1024 * 1024);

    // 检查是否需要自动清理
    if (this.config.enableAutoCleanup && !this.isCleaningUp) {
      if (usedMB >= this.config.thresholds.critical) {
        this.performCriticalCleanup();
      } else if (usedMB >= this.config.thresholds.cleanup) {
        this.performRoutineCleanup();
      }
    }

    // 检查内存泄漏
    this.checkForMemoryLeaks();

    // 触发GC优化
    if (this.config.enableGCOptimization && usedMB >= this.config.thresholds.warning) {
      this.optimizeGarbageCollection();
    }
  }

  /**
   * 注册默认清理任务
   */
  private registerDefaultCleanupTasks(): void {
    // 清理缓存
    this.registerCleanupTask({
      name: 'clearCache',
      priority: 'normal',
      estimatedMemoryFreed: 20,
      cleanup: async () => {
        // 清理智能缓存
        try {
          const { smartCache } = await import('./smartCacheSystem');
          smartCache.clearAll();
        } catch (error) {
          console.warn('[MemoryOptimizer] Failed to clear smart cache:', error);
        }
      }
    });

    // 清理懒加载缓存
    this.registerCleanupTask({
      name: 'clearLazyLoadingCache',
      priority: 'low',
      estimatedMemoryFreed: 15,
      cleanup: async () => {
        try {
          const { LazyLoadingManager } = await import('./LazyLoadingManager');
          const lazyLoader = LazyLoadingManager.getInstance();
          lazyLoader.clearCache();
        } catch (error) {
          console.warn('[MemoryOptimizer] Failed to clear lazy loading cache:', error);
        }
      }
    });

    // 清理批处理队列
    this.registerCleanupTask({
      name: 'clearBatchQueue',
      priority: 'high',
      estimatedMemoryFreed: 10,
      cleanup: async () => {
        try {
          const { BatchOperationsManager } = await import('./BatchOperationsManager');
          const batchManager = BatchOperationsManager.getInstance();
          batchManager.clearCompletedOperations();
        } catch (error) {
          console.warn('[MemoryOptimizer] Failed to clear batch queue:', error);
        }
      }
    });

    // 清理DOM缓存
    this.registerCleanupTask({
      name: 'clearDOMCache',
      priority: 'normal',
      estimatedMemoryFreed: 5,
      cleanup: () => {
        // 清理未使用的DOM引用
        if (typeof document !== 'undefined') {
          // 清理事件监听器缓存
          const events = ['click', 'scroll', 'resize', 'mouseover'];
          events.forEach(eventType => {
            document.querySelectorAll(`[data-cached-${eventType}]`).forEach(el => {
              el.removeAttribute(`data-cached-${eventType}`);
            });
          });
        }
      }
    });
  }

  /**
   * 注册清理任务
   */
  registerCleanupTask(task: CleanupTask): void {
    this.cleanupTasks.push(task);
    // 按优先级排序
    this.cleanupTasks.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * 执行例行清理
   */
  private async performRoutineCleanup(): Promise<void> {
    if (this.isCleaningUp) return;

    const now = Date.now();
    if (now - this.lastCleanupTime < 30000) return; // 30秒内只能清理一次

    this.isCleaningUp = true;
    this.lastCleanupTime = now;

    try {
      const tasks = this.cleanupTasks.filter(task => 
        task.priority === 'low' || task.priority === 'normal'
      );

      for (const task of tasks.slice(0, 3)) { // 最多执行3个任务
        try {
          await task.cleanup();
          console.debug(`[MemoryOptimizer] Executed cleanup task: ${task.name}`);
        } catch (error) {
          console.warn(`[MemoryOptimizer] Cleanup task failed: ${task.name}`, error);
        }
      }

    } finally {
      this.isCleaningUp = false;
    }
  }

  /**
   * 执行关键清理
   */
  private async performCriticalCleanup(): Promise<void> {
    if (this.isCleaningUp) return;

    this.isCleaningUp = true;

    try {
      console.warn('[MemoryOptimizer] Performing critical memory cleanup');

      // 执行所有清理任务
      for (const task of this.cleanupTasks) {
        try {
          await task.cleanup();
          console.debug(`[MemoryOptimizer] Critical cleanup task executed: ${task.name}`);
        } catch (error) {
          console.error(`[MemoryOptimizer] Critical cleanup task failed: ${task.name}`, error);
        }
      }

      // 强制垃圾回收
      this.forceGarbageCollection();

    } finally {
      this.isCleaningUp = false;
      this.lastCleanupTime = Date.now();
    }
  }

  /**
   * 执行紧急清理
   */
  performEmergencyCleanup(): void {
    console.warn('[MemoryOptimizer] Performing emergency cleanup');
    
    // 同步执行关键清理任务
    this.cleanupTasks
      .filter(task => task.priority === 'critical' || task.priority === 'high')
      .forEach(task => {
        try {
          const result = task.cleanup();
          if (result instanceof Promise) {
            result.catch(error => console.error(`Emergency cleanup failed: ${task.name}`, error));
          }
        } catch (error) {
          console.error(`Emergency cleanup failed: ${task.name}`, error);
        }
      });

    // 强制垃圾回收
    this.forceGarbageCollection();
  }

  /**
   * 处理内存压力
   */
  private handleMemoryPressure(): void {
    console.warn('[MemoryOptimizer] Memory pressure detected');
    this.performCriticalCleanup();
  }

  /**
   * 优化垃圾回收
   */
  private optimizeGarbageCollection(): void {
    if (!this.config.enableGCOptimization) return;

    // 在空闲时间触发垃圾回收
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => {
        this.forceGarbageCollection();
      }, { timeout: 5000 });
    } else {
      // 降级到setTimeout
      setTimeout(() => {
        this.forceGarbageCollection();
      }, 100);
    }
  }

  /**
   * 强制垃圾回收
   */
  private forceGarbageCollection(): void {
    if (typeof window !== 'undefined' && 'gc' in window) {
      try {
        (window as any).gc();
        console.debug('[MemoryOptimizer] Manual garbage collection triggered');
      } catch (error) {
        console.debug('[MemoryOptimizer] Manual GC not available');
      }
    }
  }

  /**
   * 检查内存泄漏
   */
  private checkForMemoryLeaks(): void {
    if (this.memoryHistory.length < 10) return;

    const recent = this.memoryHistory.slice(-10);
    const trend = this.calculateMemoryTrend(recent);

    // 如果内存持续增长且增长率超过阈值
    if (trend.isIncreasing && trend.growthRate > 5) { // 5MB/监控周期
      console.warn('[MemoryOptimizer] Potential memory leak detected', {
        growthRate: trend.growthRate.toFixed(2) + 'MB/period',
        currentUsage: (recent[recent.length - 1].usedJSHeapSize / (1024 * 1024)).toFixed(2) + 'MB'
      });

      // 触发详细分析
      this.performMemoryLeakAnalysis();
    }
  }

  /**
   * 计算内存趋势
   */
  private calculateMemoryTrend(stats: MemoryStats[]): {
    isIncreasing: boolean;
    growthRate: number;
  } {
    if (stats.length < 2) {
      return { isIncreasing: false, growthRate: 0 };
    }

    const first = stats[0].usedJSHeapSize / (1024 * 1024);
    const last = stats[stats.length - 1].usedJSHeapSize / (1024 * 1024);
    const growthRate = (last - first) / stats.length;

    return {
      isIncreasing: growthRate > 1, // 1MB增长被认为是增长
      growthRate: Math.abs(growthRate)
    };
  }

  /**
   * 执行内存泄漏分析
   */
  private performMemoryLeakAnalysis(): void {
    // 在开发环境中提供更详细的分析
    if (process.env.NODE_ENV === 'development') {
      console.group('[MemoryOptimizer] Memory Leak Analysis');
      
      const currentStats = this.getCurrentMemoryStats();
      if (currentStats) {
        console.log('Current Memory Usage:', {
          used: (currentStats.usedJSHeapSize / (1024 * 1024)).toFixed(2) + 'MB',
          total: (currentStats.totalJSHeapSize / (1024 * 1024)).toFixed(2) + 'MB',
          limit: (currentStats.jsHeapSizeLimit / (1024 * 1024)).toFixed(2) + 'MB'
        });
      }

      console.log('Memory History (last 10 records):', 
        this.memoryHistory.slice(-10).map(stat => ({
          used: (stat.usedJSHeapSize / (1024 * 1024)).toFixed(2) + 'MB',
          timestamp: new Date(stat.timestamp).toISOString()
        }))
      );

      console.groupEnd();
    }
  }

  /**
   * 获取当前内存统计
   */
  getCurrentMemoryStats(): MemoryStats | null {
    return this.memoryHistory[this.memoryHistory.length - 1] || null;
  }

  /**
   * 获取内存使用报告
   */
  getMemoryReport(): {
    current: MemoryStats | null;
    history: MemoryStats[];
    thresholds: MemoryThresholds;
    recommendations: string[];
    trend: {
      isIncreasing: boolean;
      growthRate: number;
    };
  } {
    const current = this.getCurrentMemoryStats();
    const trend = this.memoryHistory.length >= 5 
      ? this.calculateMemoryTrend(this.memoryHistory.slice(-5))
      : { isIncreasing: false, growthRate: 0 };

    const recommendations: string[] = [];

    if (current) {
      const usedMB = current.usedJSHeapSize / (1024 * 1024);
      
      if (usedMB >= this.config.thresholds.critical) {
        recommendations.push('内存使用严重超标，建议立即清理缓存和未使用资源');
      } else if (usedMB >= this.config.thresholds.warning) {
        recommendations.push('内存使用较高，建议优化数据结构和清理缓存');
      }

      if (trend.isIncreasing && trend.growthRate > 3) {
        recommendations.push('检测到内存持续增长，可能存在内存泄漏');
      }

      if (!this.config.enableAutoCleanup) {
        recommendations.push('建议启用自动内存清理功能');
      }
    }

    return {
      current,
      history: this.memoryHistory.slice(-50), // 最近50条记录
      thresholds: this.config.thresholds,
      recommendations,
      trend
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<MemoryOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // 重启监控以应用新配置
    this.stopMonitoring();
    this.startMonitoring();
  }

  /**
   * 获取配置
   */
  getConfig(): MemoryOptimizationConfig {
    return { ...this.config };
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.stopMonitoring();
    this.cleanupTasks = [];
    this.memoryHistory = [];
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.performEmergencyCleanup);
    }
  }
}

// 创建全局实例
export const memoryOptimizer = MemoryOptimizer.getInstance();
export { MemoryOptimizer };