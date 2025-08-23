/**
 * 资源管理器
 * 
 * 统一管理应用中的各种资源，包括：
 * - 网络请求管理
 * - 事件监听器管理
 * - 定时器管理
 * - WebWorker管理
 * - DOM资源管理
 */

interface ResourceMetrics {
  networkRequests: {
    active: number;
    completed: number;
    failed: number;
    totalBytes: number;
  };
  eventListeners: {
    count: number;
    types: Record<string, number>;
  };
  timers: {
    intervals: number;
    timeouts: number;
  };
  workers: {
    active: number;
    terminated: number;
  };
  dom: {
    elements: number;
    observers: number;
  };
}

interface ResourceConfig {
  maxConcurrentRequests: number;
  requestTimeout: number;
  enableResourceTracking: boolean;
  enableAutoCleanup: boolean;
  cleanupInterval: number;
}

interface TrackedResource {
  id: string;
  type: 'request' | 'listener' | 'timer' | 'worker' | 'observer';
  created: number;
  cleanup: () => void;
  metadata?: any;
}

class ResourceManager {
  private static instance: ResourceManager;
  private config: ResourceConfig;
  private trackedResources = new Map<string, TrackedResource>();
  private networkRequestQueue: Promise<any>[] = [];
  private cleanupTimer: NodeJS.Timeout | null = null;
  private resourceMetrics: ResourceMetrics;

  private constructor() {
    this.config = {
      maxConcurrentRequests: 10,
      requestTimeout: 30000,
      enableResourceTracking: true,
      enableAutoCleanup: true,
      cleanupInterval: 60000 // 1分钟
    };

    this.resourceMetrics = {
      networkRequests: { active: 0, completed: 0, failed: 0, totalBytes: 0 },
      eventListeners: { count: 0, types: {} },
      timers: { intervals: 0, timeouts: 0 },
      workers: { active: 0, terminated: 0 },
      dom: { elements: 0, observers: 0 }
    };

    this.initializeResourceManagement();
  }

  static getInstance(): ResourceManager {
    if (!this.instance) {
      this.instance = new ResourceManager();
    }
    return this.instance;
  }

  /**
   * 初始化资源管理
   */
  private initializeResourceManagement(): void {
    if (this.config.enableAutoCleanup) {
      this.startAutoCleanup();
    }

    // 监听页面卸载事件，清理所有资源
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.cleanupAllResources();
      });

      // 监听页面可见性变化
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.suspendNonCriticalResources();
        } else {
          this.resumeResources();
        }
      });
    }
  }

  /**
   * 创建受管理的网络请求
   */
  async createManagedRequest<T>(
    requestFn: () => Promise<T>,
    options: {
      priority?: 'low' | 'normal' | 'high';
      timeout?: number;
      retries?: number;
      metadata?: any;
    } = {}
  ): Promise<T> {
    const requestId = this.generateResourceId();
    const startTime = Date.now();

    // 等待请求队列空间
    await this.waitForRequestSlot();

    const cleanup = () => {
      this.trackedResources.delete(requestId);
      this.resourceMetrics.networkRequests.active--;
    };

    // 跟踪资源
    this.trackedResources.set(requestId, {
      id: requestId,
      type: 'request',
      created: startTime,
      cleanup,
      metadata: options.metadata
    });

    this.resourceMetrics.networkRequests.active++;

    const requestPromise = Promise.race([
      requestFn(),
      this.createTimeoutPromise<T>(options.timeout || this.config.requestTimeout)
    ]);

    this.networkRequestQueue.push(requestPromise);

    try {
      const result = await requestPromise;
      this.resourceMetrics.networkRequests.completed++;
      
      // 估算响应大小
      const responseSize = this.estimateResponseSize(result);
      this.resourceMetrics.networkRequests.totalBytes += responseSize;

      return result;
    } catch (error) {
      this.resourceMetrics.networkRequests.failed++;
      throw error;
    } finally {
      cleanup();
      this.removeFromRequestQueue(requestPromise);
    }
  }

  /**
   * 创建受管理的事件监听器
   */
  createManagedEventListener(
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ): () => void {
    const listenerId = this.generateResourceId();

    const cleanup = () => {
      element.removeEventListener(event, handler, options);
      this.trackedResources.delete(listenerId);
      this.resourceMetrics.eventListeners.count--;
      this.resourceMetrics.eventListeners.types[event] = 
        (this.resourceMetrics.eventListeners.types[event] || 0) - 1;
    };

    // 添加事件监听器
    element.addEventListener(event, handler, options);

    // 跟踪资源
    this.trackedResources.set(listenerId, {
      id: listenerId,
      type: 'listener',
      created: Date.now(),
      cleanup,
      metadata: { element, event }
    });

    this.resourceMetrics.eventListeners.count++;
    this.resourceMetrics.eventListeners.types[event] = 
      (this.resourceMetrics.eventListeners.types[event] || 0) + 1;

    return cleanup;
  }

  /**
   * 创建受管理的定时器
   */
  createManagedInterval(callback: () => void, delay: number): () => void {
    const timerId = this.generateResourceId();
    const intervalId = setInterval(callback, delay);

    const cleanup = () => {
      clearInterval(intervalId);
      this.trackedResources.delete(timerId);
      this.resourceMetrics.timers.intervals--;
    };

    this.trackedResources.set(timerId, {
      id: timerId,
      type: 'timer',
      created: Date.now(),
      cleanup,
      metadata: { type: 'interval', delay }
    });

    this.resourceMetrics.timers.intervals++;
    return cleanup;
  }

  /**
   * 创建受管理的超时
   */
  createManagedTimeout(callback: () => void, delay: number): () => void {
    const timerId = this.generateResourceId();
    const timeoutId = setTimeout(() => {
      callback();
      this.trackedResources.delete(timerId);
      this.resourceMetrics.timers.timeouts--;
    }, delay);

    const cleanup = () => {
      clearTimeout(timeoutId);
      this.trackedResources.delete(timerId);
      this.resourceMetrics.timers.timeouts--;
    };

    this.trackedResources.set(timerId, {
      id: timerId,
      type: 'timer',
      created: Date.now(),
      cleanup,
      metadata: { type: 'timeout', delay }
    });

    this.resourceMetrics.timers.timeouts++;
    return cleanup;
  }

  /**
   * 创建受管理的WebWorker
   */
  createManagedWorker(scriptURL: string | URL, options?: WorkerOptions): {
    worker: Worker;
    terminate: () => void;
  } {
    const workerId = this.generateResourceId();
    const worker = new Worker(scriptURL, options);

    const cleanup = () => {
      worker.terminate();
      this.trackedResources.delete(workerId);
      this.resourceMetrics.workers.active--;
      this.resourceMetrics.workers.terminated++;
    };

    // 监听worker错误
    worker.addEventListener('error', (error) => {
      console.error(`[ResourceManager] Worker ${workerId} error:`, error);
      cleanup();
    });

    this.trackedResources.set(workerId, {
      id: workerId,
      type: 'worker',
      created: Date.now(),
      cleanup,
      metadata: { scriptURL: scriptURL.toString() }
    });

    this.resourceMetrics.workers.active++;

    return {
      worker,
      terminate: cleanup
    };
  }

  /**
   * 创建受管理的DOM观察器
   */
  createManagedObserver<T extends MutationObserver | IntersectionObserver | ResizeObserver>(
    ObserverClass: new (...args: any[]) => T,
    callback: any,
    ...args: any[]
  ): { observer: T; disconnect: () => void } {
    const observerId = this.generateResourceId();
    const observer = new ObserverClass(callback, ...args);

    const cleanup = () => {
      observer.disconnect();
      this.trackedResources.delete(observerId);
      this.resourceMetrics.dom.observers--;
    };

    this.trackedResources.set(observerId, {
      id: observerId,
      type: 'observer',
      created: Date.now(),
      cleanup,
      metadata: { observerType: ObserverClass.name }
    });

    this.resourceMetrics.dom.observers++;

    return {
      observer,
      disconnect: cleanup
    };
  }

  /**
   * 等待请求队列空间
   */
  private async waitForRequestSlot(): Promise<void> {
    while (this.networkRequestQueue.length >= this.config.maxConcurrentRequests) {
      // 等待至少一个请求完成
      try {
        await Promise.race(this.networkRequestQueue);
      } catch {
        // 忽略错误，只关心队列空间
      }
    }
  }

  /**
   * 创建超时Promise
   */
  private createTimeoutPromise<T>(timeout: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * 估算响应大小
   */
  private estimateResponseSize(response: any): number {
    try {
      return JSON.stringify(response).length * 2; // 粗略估算（UTF-16）
    } catch {
      return 1024; // 默认1KB
    }
  }

  /**
   * 从请求队列中移除
   */
  private removeFromRequestQueue(promise: Promise<any>): void {
    const index = this.networkRequestQueue.indexOf(promise);
    if (index > -1) {
      this.networkRequestQueue.splice(index, 1);
    }
  }

  /**
   * 生成资源ID
   */
  private generateResourceId(): string {
    return `resource_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 开始自动清理
   */
  private startAutoCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.performRoutineCleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * 执行例行清理
   */
  private performRoutineCleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5分钟

    let cleanedCount = 0;

    for (const [id, resource] of this.trackedResources) {
      // 清理过期的超时定时器和已完成的请求
      if (
        (resource.type === 'timer' && resource.metadata?.type === 'timeout' && 
         now - resource.created > resource.metadata?.delay + 1000) ||
        (resource.type === 'request' && now - resource.created > maxAge)
      ) {
        try {
          resource.cleanup();
          cleanedCount++;
        } catch (error) {
          console.warn(`[ResourceManager] Failed to cleanup resource ${id}:`, error);
        }
      }
    }

    if (cleanedCount > 0) {
      console.debug(`[ResourceManager] Cleaned up ${cleanedCount} expired resources`);
    }
  }

  /**
   * 暂停非关键资源
   */
  private suspendNonCriticalResources(): void {
    console.debug('[ResourceManager] Suspending non-critical resources');
    
    // 暂停低优先级的请求
    // 注意：这里只是概念性实现，实际项目中需要更复杂的优先级管理
  }

  /**
   * 恢复资源
   */
  private resumeResources(): void {
    console.debug('[ResourceManager] Resuming resources');
    // 恢复暂停的资源
  }

  /**
   * 清理所有资源
   */
  cleanupAllResources(): void {
    console.info(`[ResourceManager] Cleaning up ${this.trackedResources.size} resources`);

    const errors: Error[] = [];

    for (const [id, resource] of this.trackedResources) {
      try {
        resource.cleanup();
      } catch (error) {
        errors.push(error as Error);
        console.error(`[ResourceManager] Failed to cleanup resource ${id}:`, error);
      }
    }

    this.trackedResources.clear();
    this.networkRequestQueue = [];

    // 重置指标
    this.resourceMetrics = {
      networkRequests: { active: 0, completed: 0, failed: 0, totalBytes: 0 },
      eventListeners: { count: 0, types: {} },
      timers: { intervals: 0, timeouts: 0 },
      workers: { active: 0, terminated: 0 },
      dom: { elements: 0, observers: 0 }
    };

    if (errors.length > 0) {
      console.warn(`[ResourceManager] ${errors.length} resources failed to cleanup properly`);
    }
  }

  /**
   * 清理特定类型的资源
   */
  cleanupResourcesByType(type: TrackedResource['type']): number {
    let cleanedCount = 0;

    for (const [id, resource] of this.trackedResources) {
      if (resource.type === type) {
        try {
          resource.cleanup();
          cleanedCount++;
        } catch (error) {
          console.error(`[ResourceManager] Failed to cleanup ${type} resource ${id}:`, error);
        }
      }
    }

    return cleanedCount;
  }

  /**
   * 获取资源指标
   */
  getResourceMetrics(): ResourceMetrics {
    return {
      networkRequests: { ...this.resourceMetrics.networkRequests },
      eventListeners: { 
        count: this.resourceMetrics.eventListeners.count,
        types: { ...this.resourceMetrics.eventListeners.types }
      },
      timers: { ...this.resourceMetrics.timers },
      workers: { ...this.resourceMetrics.workers },
      dom: { ...this.resourceMetrics.dom }
    };
  }

  /**
   * 获取资源使用报告
   */
  getResourceReport(): {
    summary: ResourceMetrics;
    activeResources: number;
    recommendations: string[];
    issues: string[];
  } {
    const summary = this.getResourceMetrics();
    const activeResources = this.trackedResources.size;
    const recommendations: string[] = [];
    const issues: string[] = [];

    // 分析并提供建议
    if (summary.networkRequests.active > 5) {
      issues.push(`过多并发网络请求: ${summary.networkRequests.active}`);
      recommendations.push('考虑限制并发请求数量或使用请求队列');
    }

    if (summary.eventListeners.count > 100) {
      issues.push(`过多事件监听器: ${summary.eventListeners.count}`);
      recommendations.push('检查并清理未使用的事件监听器');
    }

    if (summary.timers.intervals > 10) {
      issues.push(`过多定时器: ${summary.timers.intervals} intervals`);
      recommendations.push('检查并清理未使用的定时器');
    }

    if (summary.workers.active > 4) {
      issues.push(`过多WebWorker: ${summary.workers.active}`);
      recommendations.push('考虑使用WebWorker池管理');
    }

    if (activeResources > 200) {
      recommendations.push('总资源数量较多，建议启用自动清理');
    }

    return {
      summary,
      activeResources,
      recommendations,
      issues
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<ResourceConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // 重启自动清理
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.config.enableAutoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * 获取配置
   */
  getConfig(): ResourceConfig {
    return { ...this.config };
  }

  /**
   * 销毁资源管理器
   */
  destroy(): void {
    this.cleanupAllResources();

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.cleanupAllResources);
    }
  }
}

// 创建全局实例
export const resourceManager = ResourceManager.getInstance();
export { ResourceManager };