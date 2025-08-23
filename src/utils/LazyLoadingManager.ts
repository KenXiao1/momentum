/**
 * 智能懒加载管理器
 * 
 * 实现高级懒加载策略，包括：
 * - 智能预测性加载
 * - 基于用户行为的预加载
 * - 内容优先级管理
 * - 渐进式数据加载
 * - 自适应加载策略
 * - 内存和带宽优化
 */

import { logger } from './logger';
import { smartCache } from './smartCacheSystem';
import { batchOperationsManager } from './BatchOperationsManager';
import { highPerformanceDataAccess } from './highPerformanceDataAccess';

interface LazyLoadItem {
  id: string;
  key: string;
  loader: () => Promise<any>;
  priority: 'low' | 'normal' | 'high' | 'critical';
  dependencies?: string[];
  predicates?: (() => boolean)[];
  expiry?: number;
  loadedAt?: Date;
  loadCount: number;
  lastAccessed?: Date;
  size?: number;
}

interface LoadingStrategy {
  name: string;
  condition: (item: LazyLoadItem, context: LoadingContext) => boolean;
  execute: (items: LazyLoadItem[], context: LoadingContext) => Promise<void>;
  priority: number;
}

interface LoadingContext {
  userId?: string;
  currentView: string;
  userBehavior: UserBehaviorPattern;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  connectionSpeed: 'slow' | 'medium' | 'fast';
  memoryPressure: 'low' | 'medium' | 'high';
  batteryLevel?: 'low' | 'medium' | 'high';
}

interface UserBehaviorPattern {
  frequentlyAccessedItems: Set<string>;
  recentlyAccessedItems: string[];
  accessPatterns: Map<string, {
    frequency: number;
    lastAccess: Date;
    avgAccessInterval: number;
    predictedNextAccess: Date;
  }>;
  sessionDuration: number;
  interactionType: 'reading' | 'creating' | 'editing' | 'browsing';
}

interface LazyLoadStats {
  totalItems: number;
  loadedItems: number;
  preloadedItems: number;
  cacheHitRate: number;
  averageLoadTime: number;
  memoryUsage: number;
  loadingErrors: number;
  totalLoadTime: number;
}

interface ViewportObservation {
  element: string;
  isVisible: boolean;
  distanceFromViewport: number;
  visibilityTime: number;
  interactionProbability: number;
}

class LazyLoadingManager {
  private static instance: LazyLoadingManager;
  private lazyItems = new Map<string, LazyLoadItem>();
  private loadingQueue = new Map<string, Promise<any>>();
  private loadingStrategies: LoadingStrategy[] = [];
  private userBehaviorPattern: UserBehaviorPattern;
  private loadingContext: LoadingContext;
  private stats: LazyLoadStats;
  private viewportObserver: IntersectionObserver | null = null;
  private performanceObserver: PerformanceObserver | null = null;
  private memoryPressureTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.userBehaviorPattern = {
      frequentlyAccessedItems: new Set(),
      recentlyAccessedItems: [],
      accessPatterns: new Map(),
      sessionDuration: 0,
      interactionType: 'browsing'
    };

    this.loadingContext = {
      currentView: 'home',
      userBehavior: this.userBehaviorPattern,
      timeOfDay: this.getTimeOfDay(),
      connectionSpeed: this.detectConnectionSpeed(),
      memoryPressure: this.detectMemoryPressure()
    };

    this.stats = {
      totalItems: 0,
      loadedItems: 0,
      preloadedItems: 0,
      cacheHitRate: 0,
      averageLoadTime: 0,
      memoryUsage: 0,
      loadingErrors: 0,
      totalLoadTime: 0
    };

    this.initializeLazyLoadingStrategies();
    this.startBehaviorTracking();
    this.setupPerformanceMonitoring();
  }

  static getInstance(): LazyLoadingManager {
    if (!this.instance) {
      this.instance = new LazyLoadingManager();
    }
    return this.instance;
  }

  /**
   * 注册懒加载项
   */
  registerLazyItem(
    key: string,
    loader: () => Promise<any>,
    options: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      dependencies?: string[];
      predicates?: (() => boolean)[];
      expiry?: number;
    } = {}
  ): string {
    const id = this.generateItemId();
    
    const item: LazyLoadItem = {
      id,
      key,
      loader,
      priority: options.priority || 'normal',
      dependencies: options.dependencies || [],
      predicates: options.predicates || [],
      expiry: options.expiry || 5 * 60 * 1000, // 5分钟默认过期
      loadCount: 0
    };

    this.lazyItems.set(key, item);
    this.stats.totalItems++;

    logger.debug(`[LazyLoadingManager] 注册懒加载项: ${key}`, {
      itemId: id,
      priority: item.priority,
      dependencies: item.dependencies.length
    });

    // 触发智能预加载检查
    setTimeout(() => {
      this.evaluatePreloadingOpportunity(item);
    }, 0);

    return id;
  }

  /**
   * 加载项目
   */
  async loadItem<T>(key: string, forceReload: boolean = false): Promise<T> {
    const item = this.lazyItems.get(key);
    if (!item) {
      throw new Error(`Lazy load item not found: ${key}`);
    }

    // 检查是否正在加载
    if (this.loadingQueue.has(key)) {
      return this.loadingQueue.get(key) as Promise<T>;
    }

    // 更新访问模式
    this.updateAccessPattern(key);

    // 检查缓存
    if (!forceReload) {
      const cached = await this.getCachedItem<T>(key);
      if (cached !== null) {
        this.stats.cacheHitRate = (this.stats.cacheHitRate + 1) / 2; // 简化计算
        return cached;
      }
    }

    // 创建加载 Promise
    const loadingPromise = this.executeLoad<T>(item);
    this.loadingQueue.set(key, loadingPromise);

    try {
      const result = await loadingPromise;
      
      // 更新统计
      item.loadCount++;
      item.lastAccessed = new Date();
      item.loadedAt = new Date();
      this.stats.loadedItems++;

      // 缓存结果
      await this.cacheLoadedItem(key, result, item);

      return result;
    } finally {
      this.loadingQueue.delete(key);
    }
  }

  /**
   * 执行实际加载
   */
  private async executeLoad<T>(item: LazyLoadItem): Promise<T> {
    const startTime = performance.now();

    try {
      // 检查前置条件
      if (!this.checkPredicates(item)) {
        throw new Error(`Predicates failed for item: ${item.key}`);
      }

      // 检查依赖项
      await this.loadDependencies(item);

      // 执行加载
      const result = await item.loader();
      
      const loadTime = performance.now() - startTime;
      this.updateLoadTimeStats(loadTime);

      logger.debug(`[LazyLoadingManager] 项目加载完成: ${item.key}`, {
        loadTime: loadTime.toFixed(2) + 'ms',
        size: this.estimateDataSize(result)
      });

      return result;
    } catch (error) {
      this.stats.loadingErrors++;
      logger.error(`[LazyLoadingManager] 项目加载失败: ${item.key}`, error);
      throw error;
    }
  }

  /**
   * 批量加载项目
   */
  async loadMultipleItems(keys: string[], maxConcurrent: number = 3): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    
    // 按优先级排序
    const sortedItems = keys
      .map(key => this.lazyItems.get(key))
      .filter(item => item !== undefined)
      .sort((a, b) => this.getPriorityValue(a!.priority) - this.getPriorityValue(b!.priority));

    // 分批处理
    for (let i = 0; i < sortedItems.length; i += maxConcurrent) {
      const batch = sortedItems.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (item) => {
        try {
          const result = await this.loadItem(item!.key);
          return { key: item!.key, result, success: true };
        } catch (error) {
          return { key: item!.key, error, success: false };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(({ key, result, success }) => {
        if (success) {
          results.set(key, result);
        }
      });
    }

    return results;
  }

  /**
   * 预加载基于策略
   */
  async preloadBasedOnContext(context: Partial<LoadingContext> = {}): Promise<void> {
    // 更新加载上下文
    this.loadingContext = { ...this.loadingContext, ...context };

    // 获取候选预加载项
    const candidates = this.getPreloadCandidates();
    
    if (candidates.length === 0) return;

    // 执行预加载策略
    for (const strategy of this.loadingStrategies) {
      const applicableItems = candidates.filter(item => 
        strategy.condition(item, this.loadingContext)
      );

      if (applicableItems.length > 0) {
        try {
          await strategy.execute(applicableItems, this.loadingContext);
          logger.debug(`[LazyLoadingManager] 执行预加载策略: ${strategy.name}`, {
            itemCount: applicableItems.length
          });
        } catch (error) {
          logger.error(`[LazyLoadingManager] 预加载策略失败: ${strategy.name}`, error);
        }
      }
    }
  }

  /**
   * 智能预测用户下一步可能需要的内容
   */
  async predictivePreload(): Promise<void> {
    const predictions = this.predictNextAccess();
    
    for (const prediction of predictions.slice(0, 5)) { // 限制预加载数量
      if (this.shouldPreload(prediction)) {
        try {
          await this.loadItem(prediction.key);
          this.stats.preloadedItems++;
          
          logger.debug(`[LazyLoadingManager] 预测性预加载: ${prediction.key}`, {
            probability: prediction.probability,
            reasons: prediction.reasons
          });
        } catch (error) {
          logger.error(`[LazyLoadingManager] 预测性预加载失败: ${prediction.key}`, error);
        }
      }
    }
  }

  /**
   * 初始化懒加载策略
   */
  private initializeLazyLoadingStrategies(): void {
    this.loadingStrategies = [
      // 视口可见性策略
      {
        name: 'viewport-visibility',
        condition: (item, context) => {
          return context.currentView === 'list' && item.priority !== 'low';
        },
        execute: async (items, context) => {
          const visibleItems = items.slice(0, 3); // 只加载前3个可见项
          await Promise.all(visibleItems.map(item => this.loadItem(item.key)));
        },
        priority: 1
      },

      // 用户行为预测策略
      {
        name: 'behavior-prediction',
        condition: (item, context) => {
          const pattern = context.userBehavior.accessPatterns.get(item.key);
          return pattern && pattern.frequency > 2;
        },
        execute: async (items, context) => {
          // 基于访问频率排序
          const sortedItems = items
            .map(item => ({
              item,
              frequency: context.userBehavior.accessPatterns.get(item.key)?.frequency || 0
            }))
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 5)
            .map(({ item }) => item);

          await this.staggeredLoad(sortedItems, 500); // 每500ms加载一个
        },
        priority: 2
      },

      // 时间敏感策略
      {
        name: 'time-sensitive',
        condition: (item, context) => {
          const pattern = context.userBehavior.accessPatterns.get(item.key);
          if (!pattern) return false;
          
          const now = Date.now();
          const predictedNext = pattern.predictedNextAccess.getTime();
          return predictedNext - now <= 60000; // 1分钟内预期访问
        },
        execute: async (items, context) => {
          // 按预期访问时间排序
          const sortedItems = items
            .sort((a, b) => {
              const aPattern = context.userBehavior.accessPatterns.get(a.key);
              const bPattern = context.userBehavior.accessPatterns.get(b.key);
              if (!aPattern || !bPattern) return 0;
              return aPattern.predictedNextAccess.getTime() - bPattern.predictedNextAccess.getTime();
            })
            .slice(0, 3);

          await Promise.all(sortedItems.map(item => this.loadItem(item.key)));
        },
        priority: 0 // 最高优先级
      },

      // 空闲时间策略
      {
        name: 'idle-time',
        condition: (item, context) => {
          return context.userBehavior.interactionType === 'browsing' && 
                 context.memoryPressure !== 'high';
        },
        execute: async (items, context) => {
          // 空闲时加载低优先级项目
          const idleItems = items
            .filter(item => item.priority === 'low' || item.priority === 'normal')
            .slice(0, 2);

          await this.staggeredLoad(idleItems, 2000); // 每2秒加载一个
        },
        priority: 3
      }
    ];

    // 按优先级排序策略
    this.loadingStrategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 错开加载
   */
  private async staggeredLoad(items: LazyLoadItem[], delayMs: number): Promise<void> {
    for (let i = 0; i < items.length; i++) {
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      try {
        await this.loadItem(items[i].key);
      } catch (error) {
        logger.error(`[LazyLoadingManager] 错开加载失败: ${items[i].key}`, error);
      }
    }
  }

  /**
   * 获取预加载候选项
   */
  private getPreloadCandidates(): LazyLoadItem[] {
    const candidates: LazyLoadItem[] = [];
    
    for (const item of this.lazyItems.values()) {
      // 跳过已加载的项目
      if (this.loadingQueue.has(item.key)) continue;
      
      // 跳过最近已加载的项目
      if (item.loadedAt && Date.now() - item.loadedAt.getTime() < item.expiry!) continue;
      
      candidates.push(item);
    }
    
    return candidates;
  }

  /**
   * 预测下一次访问
   */
  private predictNextAccess(): Array<{
    key: string;
    probability: number;
    reasons: string[];
  }> {
    const predictions: Array<{
      key: string;
      probability: number;
      reasons: string[];
    }> = [];

    for (const [key, pattern] of this.userBehaviorPattern.accessPatterns.entries()) {
      const reasons: string[] = [];
      let probability = 0;

      // 基于频率的预测
      if (pattern.frequency > 5) {
        probability += 0.3;
        reasons.push('高频访问');
      }

      // 基于时间模式的预测
      const timeSinceLastAccess = Date.now() - pattern.lastAccess.getTime();
      if (timeSinceLastAccess >= pattern.avgAccessInterval * 0.8) {
        probability += 0.4;
        reasons.push('基于时间模式');
      }

      // 基于最近访问的预测
      if (this.userBehaviorPattern.recentlyAccessedItems.includes(key)) {
        probability += 0.2;
        reasons.push('最近访问过');
      }

      // 基于用户当前行为的预测
      if (this.userBehaviorPattern.interactionType === 'creating' && key.includes('template')) {
        probability += 0.3;
        reasons.push('当前创建模式');
      }

      if (probability > 0.3) {
        predictions.push({ key, probability, reasons });
      }
    }

    // 按概率排序
    return predictions.sort((a, b) => b.probability - a.probability);
  }

  /**
   * 判断是否应该预加载
   */
  private shouldPreload(prediction: { key: string; probability: number }): boolean {
    // 检查内存压力
    if (this.loadingContext.memoryPressure === 'high' && prediction.probability < 0.8) {
      return false;
    }

    // 检查网络条件
    if (this.loadingContext.connectionSpeed === 'slow' && prediction.probability < 0.6) {
      return false;
    }

    // 检查电池电量（如果可用）
    if (this.loadingContext.batteryLevel === 'low' && prediction.probability < 0.7) {
      return false;
    }

    return prediction.probability > 0.4;
  }

  /**
   * 更新访问模式
   */
  private updateAccessPattern(key: string): void {
    const now = new Date();
    const pattern = this.userBehaviorPattern.accessPatterns.get(key);

    if (pattern) {
      // 更新现有模式
      pattern.frequency++;
      const timeSinceLastAccess = now.getTime() - pattern.lastAccess.getTime();
      pattern.avgAccessInterval = (pattern.avgAccessInterval + timeSinceLastAccess) / 2;
      pattern.lastAccess = now;
      pattern.predictedNextAccess = new Date(now.getTime() + pattern.avgAccessInterval);
    } else {
      // 创建新模式
      this.userBehaviorPattern.accessPatterns.set(key, {
        frequency: 1,
        lastAccess: now,
        avgAccessInterval: 0,
        predictedNextAccess: now
      });
    }

    // 更新频繁访问项目
    if (pattern && pattern.frequency > 5) {
      this.userBehaviorPattern.frequentlyAccessedItems.add(key);
    }

    // 更新最近访问项目
    this.userBehaviorPattern.recentlyAccessedItems.unshift(key);
    if (this.userBehaviorPattern.recentlyAccessedItems.length > 10) {
      this.userBehaviorPattern.recentlyAccessedItems = 
        this.userBehaviorPattern.recentlyAccessedItems.slice(0, 10);
    }
  }

  /**
   * 开始行为跟踪
   */
  private startBehaviorTracking(): void {
    // 每30秒更新上下文
    setInterval(() => {
      this.loadingContext.timeOfDay = this.getTimeOfDay();
      this.loadingContext.connectionSpeed = this.detectConnectionSpeed();
      this.loadingContext.memoryPressure = this.detectMemoryPressure();
    }, 30000);

    // 每5分钟执行一次预测性预加载
    setInterval(() => {
      this.predictivePreload().catch(error => {
        logger.error('[LazyLoadingManager] 预测性预加载失败:', error);
      });
    }, 5 * 60 * 1000);
  }

  /**
   * 设置性能监控
   */
  private setupPerformanceMonitoring(): void {
    // 监控内存压力
    this.memoryPressureTimer = setInterval(() => {
      this.loadingContext.memoryPressure = this.detectMemoryPressure();
      
      // 在高内存压力下清理过期缓存
      if (this.loadingContext.memoryPressure === 'high') {
        this.cleanupExpiredCache();
      }
    }, 10000);

    // 性能观察器
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.name.includes('lazy-load')) {
            this.updateLoadTimeStats(entry.duration);
          }
        });
      });
      
      this.performanceObserver.observe({ entryTypes: ['measure', 'navigation'] });
    }
  }

  /**
   * 工具方法
   */
  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  private detectConnectionSpeed(): 'slow' | 'medium' | 'fast' {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        const effectiveType = connection.effectiveType;
        if (effectiveType === '4g') return 'fast';
        if (effectiveType === '3g') return 'medium';
        return 'slow';
      }
    }
    return 'medium'; // 默认
  }

  private detectMemoryPressure(): 'low' | 'medium' | 'high' {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      if (memory) {
        const usedRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        if (usedRatio > 0.8) return 'high';
        if (usedRatio > 0.6) return 'medium';
        return 'low';
      }
    }
    return 'medium'; // 默认
  }

  private async getCachedItem<T>(key: string): Promise<T | null> {
    return await smartCache.get<T>(`lazy_${key}`);
  }

  private async cacheLoadedItem(key: string, data: any, item: LazyLoadItem): Promise<void> {
    await smartCache.set(`lazy_${key}`, data, {
      ttl: item.expiry,
      priority: item.priority === 'critical' ? 'high' : 'normal',
      tags: ['lazy_load', key]
    });
  }

  private checkPredicates(item: LazyLoadItem): boolean {
    return item.predicates?.every(predicate => predicate()) ?? true;
  }

  private async loadDependencies(item: LazyLoadItem): Promise<void> {
    if (item.dependencies && item.dependencies.length > 0) {
      await Promise.all(
        item.dependencies.map(dep => this.loadItem(dep))
      );
    }
  }

  private getPriorityValue(priority: string): number {
    switch (priority) {
      case 'critical': return 0;
      case 'high': return 1;
      case 'normal': return 2;
      case 'low': return 3;
      default: return 2;
    }
  }

  private generateItemId(): string {
    return `lazy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateLoadTimeStats(loadTime: number): void {
    this.stats.totalLoadTime += loadTime;
    this.stats.averageLoadTime = this.stats.totalLoadTime / this.stats.loadedItems;
  }

  private estimateDataSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // 粗略估算
    } catch {
      return 1024; // 默认1KB
    }
  }

  private cleanupExpiredCache(): void {
    smartCache.invalidateByTag('lazy_load');
    logger.info('[LazyLoadingManager] 清理过期懒加载缓存');
  }

  /**
   * 公共API方法
   */

  /**
   * 获取统计信息
   */
  getStats(): LazyLoadStats {
    return { ...this.stats };
  }

  /**
   * 获取用户行为模式
   */
  getUserBehaviorPattern(): UserBehaviorPattern {
    return {
      ...this.userBehaviorPattern,
      accessPatterns: new Map(this.userBehaviorPattern.accessPatterns)
    };
  }

  /**
   * 更新视图上下文
   */
  updateViewContext(view: string): void {
    this.loadingContext.currentView = view;
    
    // 触发基于上下文的预加载
    setTimeout(() => {
      this.preloadBasedOnContext();
    }, 100);
  }

  /**
   * 预加载指定项目
   */
  async preloadItem<T>(
    key: string, 
    loader: () => Promise<T>, 
    options: { priority?: 'low' | 'normal' | 'high' | 'critical' } = {}
  ): Promise<T> {
    // 注册项目（如果不存在）
    if (!this.lazyItems.has(key)) {
      this.registerLazyItem(key, loader, { priority: options.priority });
    }
    
    // 加载项目
    return this.loadItem<T>(key);
  }

  /**
   * 调度预加载
   */
  schedulePreload(
    key: string, 
    loader: () => Promise<any>, 
    options: { priority?: 'low' | 'normal' | 'high' | 'critical' } = {}
  ): void {
    // 注册项目
    this.registerLazyItem(key, loader, { priority: options.priority });
    
    // 根据优先级调度预加载
    const delay = this.getPriorityDelay(options.priority || 'normal');
    setTimeout(() => {
      this.preloadItem(key, loader, options).catch(error => {
        logger.warn(`[LazyLoadingManager] 调度预加载失败: ${key}`, error);
      });
    }, delay);
  }

  /**
   * 启动预测性预加载
   */
  startPredictivePreload(): void {
    // 基于用户行为模式进行预测性预加载
    setTimeout(() => {
      this.predictivePreload();
    }, 1000);
  }

  /**
   * 获取优先级延迟
   */
  private getPriorityDelay(priority: 'low' | 'normal' | 'high' | 'critical'): number {
    const delays = {
      critical: 0,
      high: 100,
      normal: 500,
      low: 1000
    };
    return delays[priority];
  }

  /**
   * 清理缓存（别名方法）
   */
  clearCache(): void {
    this.clearAllCache();
  }

  /**
   * 获取统计信息（添加健康状态）
   */
  getStats(): LazyLoadingStats & { isHealthy: boolean } {
    const stats = {
      totalItems: this.stats.totalItems,
      loadedItems: this.stats.loadedItems,
      preloadedItems: this.stats.preloadedItems,
      cacheHitRate: this.stats.cacheHitRate,
      averageLoadTime: this.stats.averageLoadTime,
      memoryUsage: this.stats.memoryUsage,
      loadingErrors: this.stats.loadingErrors,
      totalLoadTime: this.stats.totalLoadTime
    };

    // 判断健康状态
    const isHealthy = 
      this.stats.loadingErrors < this.stats.totalItems * 0.1 && // 错误率小于10%
      this.stats.averageLoadTime < 2000 && // 平均加载时间小于2秒
      this.stats.cacheHitRate > 0.5; // 缓存命中率大于50%

    return { ...stats, isHealthy };
  }

  /**
   * 清理所有缓存
   */
  clearAllCache(): void {
    smartCache.invalidateByTag('lazy_load');
    this.stats.loadedItems = 0;
    this.stats.preloadedItems = 0;
    
    logger.info('[LazyLoadingManager] 所有懒加载缓存已清理');
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    this.lazyItems.clear();
    this.loadingQueue.clear();
    
    if (this.memoryPressureTimer) {
      clearInterval(this.memoryPressureTimer);
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    if (this.viewportObserver) {
      this.viewportObserver.disconnect();
    }
    
    logger.info('[LazyLoadingManager] 实例已销毁');
  }
}

// 创建全局实例
export const lazyLoadingManager = LazyLoadingManager.getInstance();
export { LazyLoadingManager };