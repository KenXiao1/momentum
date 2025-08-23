/**
 * 智能多层缓存系统
 * 
 * 实现L1内存缓存 + L2本地存储缓存 + L3持久化缓存
 * 智能缓存策略：LRU、TTL、预加载、缓存预热、智能失效
 */

import { logger } from './logger';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  priority: CachePriority;
  tags: string[];
  version: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  memoryUsage: number;
  averageResponseTime: number;
}

type CachePriority = 'low' | 'normal' | 'high' | 'critical';

interface CacheOptions {
  ttl?: number;
  priority?: CachePriority;
  tags?: string[];
  preload?: boolean;
  compress?: boolean;
  serialize?: boolean;
}

interface CacheStrategy {
  maxMemoryUsage: number; // 最大内存使用 (字节)
  maxItems: number; // 最大条目数
  defaultTTL: number; // 默认TTL (毫秒)
  cleanupInterval: number; // 清理间隔 (毫秒)
  compressionThreshold: number; // 压缩阈值 (字节)
  preloadEnabled: boolean; // 启用预加载
}

class SmartCacheSystem {
  // L1 内存缓存
  private l1Cache = new Map<string, CacheItem<any>>();
  
  // L2 本地存储缓存
  private l2CachePrefix = 'momentum_l2_';
  
  // 缓存访问模式分析
  private accessPatterns = new Map<string, {
    frequency: number;
    lastAccess: number;
    avgTimeSpan: number;
    predictedNextAccess: number;
  }>();

  // 性能指标
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
    memoryUsage: 0,
    averageResponseTime: 0
  };

  // 缓存策略配置
  private strategy: CacheStrategy = {
    maxMemoryUsage: 50 * 1024 * 1024, // 50MB
    maxItems: 10000,
    defaultTTL: 5 * 60 * 1000, // 5分钟
    cleanupInterval: 60 * 1000, // 1分钟清理一次
    compressionThreshold: 1024, // 1KB开始压缩
    preloadEnabled: true
  };

  // 清理定时器
  private cleanupTimer: NodeJS.Timeout | null = null;

  // 预加载队列
  private preloadQueue = new Set<string>();

  constructor() {
    this.initializeCleanup();
    this.warmUpCache();
  }

  /**
   * 智能获取缓存数据
   * 多层级查找：L1 -> L2 -> 数据源
   */
  async get<T>(
    key: string, 
    dataLoader?: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<T | null> {
    const startTime = performance.now();
    
    try {
      // L1 缓存查找
      const l1Result = this.getFromL1<T>(key);
      if (l1Result !== null) {
        this.updateAccessPattern(key);
        this.metrics.hits++;
        this.metrics.averageResponseTime = this.updateAverageTime(performance.now() - startTime);
        return l1Result;
      }

      // L2 缓存查找
      const l2Result = await this.getFromL2<T>(key);
      if (l2Result !== null) {
        // 提升到L1缓存
        this.setL1(key, l2Result, options);
        this.updateAccessPattern(key);
        this.metrics.hits++;
        this.metrics.averageResponseTime = this.updateAverageTime(performance.now() - startTime);
        return l2Result;
      }

      // 缓存未命中，从数据源加载
      if (dataLoader) {
        const data = await dataLoader();
        if (data !== null && data !== undefined) {
          await this.set(key, data, options);
        }
        this.metrics.misses++;
        this.metrics.averageResponseTime = this.updateAverageTime(performance.now() - startTime);
        return data;
      }

      this.metrics.misses++;
      return null;
    } catch (error) {
      logger.error('Cache get error', { key, error: error.message });
      this.metrics.misses++;
      return null;
    }
  }

  /**
   * 智能设置缓存
   * 根据数据特征和访问模式选择最优存储策略
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    try {
      const ttl = options.ttl || this.strategy.defaultTTL;
      const priority = options.priority || 'normal';
      const tags = options.tags || [];

      // 计算数据大小
      const size = this.calculateDataSize(data);
      
      // 根据大小和重要性选择缓存层级
      if (size > this.strategy.compressionThreshold || priority === 'critical') {
        // 大数据或高优先级数据同时存储到L1和L2
        await this.setL1(key, data, options);
        await this.setL2(key, data, ttl);
      } else {
        // 小数据优先存储到L1
        await this.setL1(key, data, options);
      }

      this.metrics.sets++;
      this.updateAccessPattern(key);

      // 触发预加载相关数据
      if (options.preload && this.strategy.preloadEnabled) {
        this.schedulePreload(key, tags);
      }

    } catch (error) {
      logger.error('Cache set error', { key, error: error.message });
    }
  }

  /**
   * L1缓存操作 (内存缓存)
   */
  private getFromL1<T>(key: string): T | null {
    const item = this.l1Cache.get(key);
    if (!item) return null;

    // 检查TTL过期
    if (Date.now() > item.timestamp + item.ttl) {
      this.l1Cache.delete(key);
      return null;
    }

    // 更新访问信息
    item.accessCount++;
    item.lastAccessed = Date.now();
    
    return item.data;
  }

  private setL1<T>(key: string, data: T, options: CacheOptions = {}): void {
    const size = this.calculateDataSize(data);
    
    // 检查内存限制，必要时执行LRU驱逐
    this.ensureMemoryLimit(size);

    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: options.ttl || this.strategy.defaultTTL,
      accessCount: 1,
      lastAccessed: Date.now(),
      size,
      priority: options.priority || 'normal',
      tags: options.tags || [],
      version: 1
    };

    this.l1Cache.set(key, item);
    this.metrics.memoryUsage += size;
  }

  /**
   * L2缓存操作 (本地存储)
   */
  private async getFromL2<T>(key: string): Promise<T | null> {
    try {
      const storageKey = this.l2CachePrefix + key;
      const cached = localStorage.getItem(storageKey);
      
      if (!cached) return null;

      const { data, timestamp, ttl } = JSON.parse(cached);
      
      // 检查TTL过期
      if (Date.now() > timestamp + ttl) {
        localStorage.removeItem(storageKey);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('L2 cache get error', { key, error: error.message });
      return null;
    }
  }

  private async setL2<T>(key: string, data: T, ttl: number): Promise<void> {
    try {
      const storageKey = this.l2CachePrefix + key;
      const cacheData = {
        data,
        timestamp: Date.now(),
        ttl
      };

      // 检查LocalStorage容量
      const serialized = JSON.stringify(cacheData);
      
      try {
        localStorage.setItem(storageKey, serialized);
      } catch (quotaError) {
        // 存储容量满，清理最旧的L2缓存项
        await this.cleanupL2Cache();
        localStorage.setItem(storageKey, serialized);
      }
    } catch (error) {
      logger.error('L2 cache set error', { key, error: error.message });
    }
  }

  /**
   * 批量缓存操作
   */
  async batchGet<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    const uncachedKeys: string[] = [];

    // 并行从L1缓存获取
    for (const key of keys) {
      const l1Result = this.getFromL1<T>(key);
      if (l1Result !== null) {
        results.set(key, l1Result);
      } else {
        uncachedKeys.push(key);
      }
    }

    // 从L2缓存批量获取剩余的键
    if (uncachedKeys.length > 0) {
      const l2Promises = uncachedKeys.map(async key => {
        const l2Result = await this.getFromL2<T>(key);
        if (l2Result !== null) {
          // 提升到L1
          this.setL1(key, l2Result);
          results.set(key, l2Result);
          return key;
        }
        return null;
      });

      await Promise.all(l2Promises);
    }

    // 为未找到的键设置null
    for (const key of keys) {
      if (!results.has(key)) {
        results.set(key, null);
      }
    }

    return results;
  }

  async batchSet<T>(entries: Array<{key: string; data: T; options?: CacheOptions}>): Promise<void> {
    const l1Operations: Promise<void>[] = [];
    const l2Operations: Promise<void>[] = [];

    for (const entry of entries) {
      l1Operations.push(Promise.resolve(this.setL1(entry.key, entry.data, entry.options)));
      
      const size = this.calculateDataSize(entry.data);
      if (size > this.strategy.compressionThreshold) {
        l2Operations.push(this.setL2(
          entry.key, 
          entry.data, 
          entry.options?.ttl || this.strategy.defaultTTL
        ));
      }
    }

    await Promise.all([...l1Operations, ...l2Operations]);
  }

  /**
   * 智能预加载
   * 基于访问模式预测和预加载相关数据
   */
  private schedulePreload(key: string, tags: string[]): void {
    // 基于标签预加载相关数据
    for (const tag of tags) {
      const relatedKeys = this.findKeysByTag(tag);
      for (const relatedKey of relatedKeys) {
        if (!this.l1Cache.has(relatedKey) && !this.preloadQueue.has(relatedKey)) {
          this.preloadQueue.add(relatedKey);
        }
      }
    }

    // 基于访问模式预测
    const pattern = this.accessPatterns.get(key);
    if (pattern && pattern.frequency > 5) {
      // 高频访问的数据，预加载相关键
      this.predictivePreload(key);
    }

    // 异步处理预加载队列
    setTimeout(() => this.processPreloadQueue(), 0);
  }

  /**
   * 预测性预加载
   */
  private predictivePreload(baseKey: string): void {
    const relatedKeys = this.generateRelatedKeys(baseKey);
    for (const key of relatedKeys) {
      if (!this.l1Cache.has(key)) {
        this.preloadQueue.add(key);
      }
    }
  }

  /**
   * 生成相关键名
   */
  private generateRelatedKeys(baseKey: string): string[] {
    const relatedKeys: string[] = [];
    
    // 基于模式生成相关键
    if (baseKey.includes('chains:')) {
      const userId = baseKey.split(':')[1];
      relatedKeys.push(
        `sessions:active:${userId}`,
        `completions:recent:${userId}`,
        `stats:${userId}`
      );
    }
    
    if (baseKey.includes('user:')) {
      const userId = baseKey.split(':')[1];
      relatedKeys.push(
        `chains:${userId}:active`,
        `preferences:${userId}`,
        `settings:${userId}`
      );
    }
    
    return relatedKeys;
  }

  /**
   * 处理预加载队列
   */
  private async processPreloadQueue(): Promise<void> {
    if (this.preloadQueue.size === 0) return;

    const batch = Array.from(this.preloadQueue).slice(0, 10); // 限制批量大小
    this.preloadQueue.clear();

    const preloadPromises = batch.map(async key => {
      try {
        // 这里需要根据键名确定数据加载器
        const dataLoader = this.getDataLoaderForKey(key);
        if (dataLoader) {
          const data = await dataLoader();
          if (data) {
            await this.set(key, data, { ttl: this.strategy.defaultTTL * 2 }); // 预加载数据TTL更长
          }
        }
      } catch (error) {
        logger.error('Preload error', { key, error: error.message });
      }
    });

    await Promise.allSettled(preloadPromises);
  }

  /**
   * 根据键名获取数据加载器
   */
  private getDataLoaderForKey(key: string): (() => Promise<any>) | null {
    // 这里需要根据项目实际情况实现
    // 示例实现：
    if (key.startsWith('chains:')) {
      // 返回链条数据加载器
      return null; // 实际项目中需要实现
    }
    
    if (key.startsWith('sessions:')) {
      // 返回会话数据加载器
      return null; // 实际项目中需要实现
    }
    
    return null;
  }

  /**
   * 内存管理和LRU驱逐
   */
  private ensureMemoryLimit(newItemSize: number): void {
    while (
      this.metrics.memoryUsage + newItemSize > this.strategy.maxMemoryUsage ||
      this.l1Cache.size >= this.strategy.maxItems
    ) {
      const victimKey = this.selectEvictionVictim();
      if (victimKey) {
        const item = this.l1Cache.get(victimKey);
        if (item) {
          this.metrics.memoryUsage -= item.size;
          this.metrics.evictions++;
        }
        this.l1Cache.delete(victimKey);
      } else {
        break; // 没有可驱逐的项
      }
    }
  }

  /**
   * 选择驱逐受害者 (LRU + 优先级)
   */
  private selectEvictionVictim(): string | null {
    let victim: { key: string; score: number } | null = null;

    for (const [key, item] of this.l1Cache.entries()) {
      // 跳过关键优先级的项
      if (item.priority === 'critical') continue;

      // 计算驱逐分数 (越小越容易被驱逐)
      const age = Date.now() - item.lastAccessed;
      const priorityWeight = this.getPriorityWeight(item.priority);
      const accessFrequencyWeight = item.accessCount > 0 ? 1 / item.accessCount : 1;
      
      const evictionScore = age * accessFrequencyWeight / priorityWeight;

      if (!victim || evictionScore > victim.score) {
        victim = { key, score: evictionScore };
      }
    }

    return victim?.key || null;
  }

  /**
   * 获取优先级权重
   */
  private getPriorityWeight(priority: CachePriority): number {
    switch (priority) {
      case 'critical': return 1000;
      case 'high': return 10;
      case 'normal': return 1;
      case 'low': return 0.1;
      default: return 1;
    }
  }

  /**
   * 标签管理
   */
  invalidateByTag(tag: string): void {
    const keysToInvalidate: string[] = [];
    
    for (const [key, item] of this.l1Cache.entries()) {
      if (item.tags.includes(tag)) {
        keysToInvalidate.push(key);
      }
    }

    for (const key of keysToInvalidate) {
      this.delete(key);
    }
  }

  private findKeysByTag(tag: string): string[] {
    const keys: string[] = [];
    
    for (const [key, item] of this.l1Cache.entries()) {
      if (item.tags.includes(tag)) {
        keys.push(key);
      }
    }

    return keys;
  }

  /**
   * 删除缓存项
   */
  delete(key: string): boolean {
    const l1Item = this.l1Cache.get(key);
    if (l1Item) {
      this.metrics.memoryUsage -= l1Item.size;
    }
    
    const l1Deleted = this.l1Cache.delete(key);
    
    // 删除L2缓存
    try {
      localStorage.removeItem(this.l2CachePrefix + key);
    } catch (error) {
      logger.error('L2 cache delete error', { key, error: error.message });
    }

    return l1Deleted;
  }

  /**
   * 清理过期项
   */
  private initializeCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredItems();
    }, this.strategy.cleanupInterval);
  }

  private cleanupExpiredItems(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, item] of this.l1Cache.entries()) {
      if (now > item.timestamp + item.ttl) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.delete(key);
    }

    // L2缓存清理
    this.cleanupL2Cache();
  }

  private async cleanupL2Cache(): Promise<void> {
    try {
      const keysToRemove: string[] = [];
      const now = Date.now();

      // 遍历localStorage查找过期项
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.l2CachePrefix)) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const { timestamp, ttl } = JSON.parse(cached);
              if (now > timestamp + ttl) {
                keysToRemove.push(key);
              }
            }
          } catch (error) {
            // 损坏的缓存项，也删除
            keysToRemove.push(key);
          }
        }
      }

      // 删除过期项
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      logger.error('L2 cache cleanup error', { error: error.message });
    }
  }

  /**
   * 缓存预热
   */
  private async warmUpCache(): Promise<void> {
    // 预热关键数据
    const warmUpKeys = [
      'app:config',
      'user:preferences',
      'app:settings'
    ];

    for (const key of warmUpKeys) {
      const dataLoader = this.getDataLoaderForKey(key);
      if (dataLoader) {
        try {
          const data = await dataLoader();
          if (data) {
            await this.set(key, data, { 
              priority: 'high',
              ttl: this.strategy.defaultTTL * 4 // 预热数据TTL更长
            });
          }
        } catch (error) {
          logger.error('Cache warm-up error', { key, error: error.message });
        }
      }
    }
  }

  /**
   * 访问模式分析
   */
  private updateAccessPattern(key: string): void {
    const now = Date.now();
    const pattern = this.accessPatterns.get(key);

    if (pattern) {
      const timeSinceLastAccess = now - pattern.lastAccess;
      pattern.frequency++;
      pattern.avgTimeSpan = (pattern.avgTimeSpan + timeSinceLastAccess) / 2;
      pattern.lastAccess = now;
      pattern.predictedNextAccess = now + pattern.avgTimeSpan;
    } else {
      this.accessPatterns.set(key, {
        frequency: 1,
        lastAccess: now,
        avgTimeSpan: 0,
        predictedNextAccess: now + this.strategy.defaultTTL
      });
    }
  }

  /**
   * 工具方法
   */
  private calculateDataSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // 粗略估计Unicode字符大小
    } catch {
      return 1024; // 默认1KB
    }
  }

  private updateAverageTime(responseTime: number): number {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    if (totalRequests <= 1) return responseTime;
    
    return (this.metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
  }

  /**
   * 性能监控和统计
   */
  getMetrics(): CacheMetrics & { hitRate: string; efficiency: string } {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    const hitRate = totalRequests > 0 ? (this.metrics.hits / totalRequests * 100).toFixed(2) + '%' : '0%';
    const efficiency = this.metrics.evictions > 0 ? 
      (this.metrics.sets / this.metrics.evictions).toFixed(2) : 'Excellent';

    return {
      ...this.metrics,
      hitRate,
      efficiency
    };
  }

  /**
   * 配置更新
   */
  updateStrategy(newStrategy: Partial<CacheStrategy>): void {
    this.strategy = { ...this.strategy, ...newStrategy };
  }

  /**
   * 清理资源
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.l1Cache.clear();
    this.accessPatterns.clear();
    this.preloadQueue.clear();
    
    // 清理L2缓存
    this.cleanupL2Cache();
  }

  /**
   * 调试工具
   */
  debug(): any {
    return {
      l1CacheSize: this.l1Cache.size,
      accessPatternsSize: this.accessPatterns.size,
      preloadQueueSize: this.preloadQueue.size,
      metrics: this.getMetrics(),
      memoryUsage: `${(this.metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
      strategy: this.strategy
    };
  }
}

// 创建全局缓存系统实例
export const smartCache = new SmartCacheSystem();