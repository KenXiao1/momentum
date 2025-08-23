/**
 * 响应时间监控器
 * 
 * 提供全面的应用性能监控，包括：
 * - 页面加载时间监控
 * - API请求响应时间
 * - 用户交互响应时间
 * - 渲染性能监控
 * - 资源加载性能
 * - 自定义性能指标
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  category: 'navigation' | 'api' | 'interaction' | 'rendering' | 'custom';
  metadata?: Record<string, any>;
}

interface PerformanceThresholds {
  navigation: {
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    cumulativeLayoutShift: number;
    firstInputDelay: number;
  };
  api: {
    fast: number;
    acceptable: number;
    slow: number;
  };
  interaction: {
    fast: number;
    acceptable: number;
  };
  rendering: {
    targetFPS: number;
    warningFPS: number;
  };
}

interface PerformanceConfig {
  enableAutoMonitoring: boolean;
  enableWebVitals: boolean;
  enableAPIMonitoring: boolean;
  enableInteractionMonitoring: boolean;
  enableRenderingMonitoring: boolean;
  sampleRate: number; // 0-1, 采样率
  maxHistorySize: number;
  reportingInterval: number;
}

interface PerformanceReport {
  period: {
    start: number;
    end: number;
    duration: number;
  };
  metrics: {
    navigation: PerformanceMetric[];
    api: PerformanceMetric[];
    interaction: PerformanceMetric[];
    rendering: PerformanceMetric[];
    custom: PerformanceMetric[];
  };
  summary: {
    totalMetrics: number;
    averageResponseTime: number;
    slowQueries: number;
    performanceScore: number;
  };
  issues: string[];
  recommendations: string[];
}

class ResponseTimeMonitor {
  private static instance: ResponseTimeMonitor;
  private config: PerformanceConfig;
  private thresholds: PerformanceThresholds;
  private metrics: PerformanceMetric[] = [];
  private reportingTimer: NodeJS.Timeout | null = null;
  private observers: PerformanceObserver[] = [];

  private constructor() {
    this.config = {
      enableAutoMonitoring: true,
      enableWebVitals: true,
      enableAPIMonitoring: true,
      enableInteractionMonitoring: true,
      enableRenderingMonitoring: true,
      sampleRate: 1.0,
      maxHistorySize: 1000,
      reportingInterval: 60000 // 1分钟
    };

    this.thresholds = {
      navigation: {
        firstContentfulPaint: 1800,  // 1.8秒
        largestContentfulPaint: 2500, // 2.5秒
        cumulativeLayoutShift: 0.1,   // 0.1
        firstInputDelay: 100          // 100毫秒
      },
      api: {
        fast: 500,      // 500ms以下为快速
        acceptable: 2000, // 2秒以下为可接受
        slow: 5000      // 5秒以上为慢速
      },
      interaction: {
        fast: 50,       // 50ms以下为快速响应
        acceptable: 200 // 200ms以下为可接受
      },
      rendering: {
        targetFPS: 60,
        warningFPS: 30
      }
    };

    this.initializeMonitoring();
  }

  static getInstance(): ResponseTimeMonitor {
    if (!this.instance) {
      this.instance = new ResponseTimeMonitor();
    }
    return this.instance;
  }

  /**
   * 初始化监控
   */
  private initializeMonitoring(): void {
    if (typeof window === 'undefined') return;

    if (this.config.enableAutoMonitoring) {
      this.startAutoMonitoring();
    }

    if (this.config.enableWebVitals) {
      this.initializeWebVitals();
    }

    if (this.config.enableInteractionMonitoring) {
      this.initializeInteractionMonitoring();
    }

    if (this.config.enableRenderingMonitoring) {
      this.initializeRenderingMonitoring();
    }

    // 开始定期报告
    this.startReporting();
  }

  /**
   * 开始自动监控
   */
  private startAutoMonitoring(): void {
    // 监控页面加载性能
    if ('performance' in window && 'timing' in performance) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          this.collectNavigationMetrics();
        }, 0);
      });
    }

    // 监控页面可见性变化
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.recordMetric({
          name: 'page_visibility_change',
          value: performance.now(),
          timestamp: Date.now(),
          category: 'navigation',
          metadata: { visible: true }
        });
      }
    });
  }

  /**
   * 初始化Web Vitals监控
   */
  private initializeWebVitals(): void {
    // First Contentful Paint
    this.createPerformanceObserver('paint', (entries) => {
      for (const entry of entries) {
        if (entry.name === 'first-contentful-paint') {
          this.recordMetric({
            name: 'first_contentful_paint',
            value: entry.startTime,
            timestamp: Date.now(),
            category: 'navigation',
            metadata: { 
              threshold: this.thresholds.navigation.firstContentfulPaint,
              status: entry.startTime <= this.thresholds.navigation.firstContentfulPaint ? 'good' : 'poor'
            }
          });
        }
      }
    });

    // Largest Contentful Paint
    this.createPerformanceObserver('largest-contentful-paint', (entries) => {
      for (const entry of entries) {
        this.recordMetric({
          name: 'largest_contentful_paint',
          value: entry.startTime,
          timestamp: Date.now(),
          category: 'navigation',
          metadata: {
            element: entry.element?.tagName || 'unknown',
            threshold: this.thresholds.navigation.largestContentfulPaint,
            status: entry.startTime <= this.thresholds.navigation.largestContentfulPaint ? 'good' : 'poor'
          }
        });
      }
    });

    // First Input Delay (通过事件监听器实现)
    this.measureFirstInputDelay();

    // Cumulative Layout Shift
    this.createPerformanceObserver('layout-shift', (entries) => {
      let cumulativeScore = 0;
      for (const entry of entries) {
        if (!entry.hadRecentInput) {
          cumulativeScore += entry.value;
        }
      }

      if (cumulativeScore > 0) {
        this.recordMetric({
          name: 'cumulative_layout_shift',
          value: cumulativeScore,
          timestamp: Date.now(),
          category: 'navigation',
          metadata: {
            threshold: this.thresholds.navigation.cumulativeLayoutShift,
            status: cumulativeScore <= this.thresholds.navigation.cumulativeLayoutShift ? 'good' : 'poor'
          }
        });
      }
    });
  }

  /**
   * 测量首次输入延迟
   */
  private measureFirstInputDelay(): void {
    let firstInputTime: number | null = null;
    
    const onFirstInput = (event: Event) => {
      if (firstInputTime === null) {
        firstInputTime = performance.now();
        
        // 使用requestIdleCallback来测量处理时间
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => {
            const processingTime = performance.now() - firstInputTime!;
            this.recordMetric({
              name: 'first_input_delay',
              value: processingTime,
              timestamp: Date.now(),
              category: 'interaction',
              metadata: {
                eventType: event.type,
                threshold: this.thresholds.navigation.firstInputDelay,
                status: processingTime <= this.thresholds.navigation.firstInputDelay ? 'good' : 'poor'
              }
            });
            
            // 移除监听器
            ['click', 'keydown', 'touchstart'].forEach(eventType => {
              document.removeEventListener(eventType, onFirstInput, { capture: true, passive: true });
            });
          });
        }
      }
    };

    ['click', 'keydown', 'touchstart'].forEach(eventType => {
      document.addEventListener(eventType, onFirstInput, { capture: true, passive: true, once: true });
    });
  }

  /**
   * 初始化交互监控
   */
  private initializeInteractionMonitoring(): void {
    // 监控点击响应时间
    document.addEventListener('click', this.measureInteractionTime.bind(this, 'click'));
    
    // 监控键盘响应时间
    document.addEventListener('keydown', this.measureInteractionTime.bind(this, 'keydown'));
    
    // 监控滚动性能
    let scrollTimeout: NodeJS.Timeout;
    document.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.recordMetric({
          name: 'scroll_performance',
          value: performance.now(),
          timestamp: Date.now(),
          category: 'interaction',
          metadata: { scrollY: window.scrollY }
        });
      }, 100);
    }, { passive: true });
  }

  /**
   * 测量交互时间
   */
  private measureInteractionTime(eventType: string, event: Event): void {
    if (Math.random() > this.config.sampleRate) return;

    const startTime = performance.now();
    
    requestAnimationFrame(() => {
      const responseTime = performance.now() - startTime;
      
      let status = 'good';
      if (responseTime > this.thresholds.interaction.acceptable) {
        status = 'poor';
      } else if (responseTime > this.thresholds.interaction.fast) {
        status = 'needs_improvement';
      }

      this.recordMetric({
        name: `${eventType}_response_time`,
        value: responseTime,
        timestamp: Date.now(),
        category: 'interaction',
        metadata: {
          eventType,
          target: (event.target as Element)?.tagName || 'unknown',
          status
        }
      });
    });
  }

  /**
   * 初始化渲染监控
   */
  private initializeRenderingMonitoring(): void {
    let frameCount = 0;
    let lastTime = performance.now();
    let fps = 60;

    const measureFPS = () => {
      const currentTime = performance.now();
      frameCount++;
      
      if (currentTime - lastTime >= 1000) {
        fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        frameCount = 0;
        lastTime = currentTime;
        
        let status = 'good';
        if (fps < this.thresholds.rendering.warningFPS) {
          status = 'poor';
        } else if (fps < this.thresholds.rendering.targetFPS) {
          status = 'needs_improvement';
        }

        this.recordMetric({
          name: 'rendering_fps',
          value: fps,
          timestamp: Date.now(),
          category: 'rendering',
          metadata: { status }
        });
      }
      
      requestAnimationFrame(measureFPS);
    };

    requestAnimationFrame(measureFPS);
  }

  /**
   * 创建性能观察器
   */
  private createPerformanceObserver(type: string, callback: (entries: PerformanceEntry[]) => void): void {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      
      observer.observe({ entryTypes: [type] });
      this.observers.push(observer);
    } catch (error) {
      console.warn(`[ResponseTimeMonitor] Failed to create observer for ${type}:`, error);
    }
  }

  /**
   * 收集导航指标
   */
  private collectNavigationMetrics(): void {
    if (!performance.timing) return;

    const timing = performance.timing;
    const navigation = performance.navigation;

    // 页面加载时间
    const loadTime = timing.loadEventEnd - timing.navigationStart;
    this.recordMetric({
      name: 'page_load_time',
      value: loadTime,
      timestamp: Date.now(),
      category: 'navigation',
      metadata: { 
        navigationType: navigation.type,
        redirectCount: navigation.redirectCount
      }
    });

    // DOM内容加载时间
    const domContentLoadedTime = timing.domContentLoadedEventEnd - timing.navigationStart;
    this.recordMetric({
      name: 'dom_content_loaded_time',
      value: domContentLoadedTime,
      timestamp: Date.now(),
      category: 'navigation'
    });

    // DNS查询时间
    if (timing.domainLookupEnd > timing.domainLookupStart) {
      const dnsTime = timing.domainLookupEnd - timing.domainLookupStart;
      this.recordMetric({
        name: 'dns_lookup_time',
        value: dnsTime,
        timestamp: Date.now(),
        category: 'navigation'
      });
    }

    // TCP连接时间
    if (timing.connectEnd > timing.connectStart) {
      const tcpTime = timing.connectEnd - timing.connectStart;
      this.recordMetric({
        name: 'tcp_connection_time',
        value: tcpTime,
        timestamp: Date.now(),
        category: 'navigation'
      });
    }
  }

  /**
   * 监控API请求
   */
  measureAPIRequest<T>(
    name: string,
    requestFn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    
    return requestFn()
      .then(result => {
        const responseTime = performance.now() - startTime;
        
        let status = 'fast';
        if (responseTime > this.thresholds.api.slow) {
          status = 'slow';
        } else if (responseTime > this.thresholds.api.acceptable) {
          status = 'acceptable';
        }

        this.recordMetric({
          name: `api_${name}`,
          value: responseTime,
          timestamp: Date.now(),
          category: 'api',
          metadata: {
            ...metadata,
            status,
            success: true
          }
        });

        return result;
      })
      .catch(error => {
        const responseTime = performance.now() - startTime;
        
        this.recordMetric({
          name: `api_${name}`,
          value: responseTime,
          timestamp: Date.now(),
          category: 'api',
          metadata: {
            ...metadata,
            status: 'error',
            success: false,
            error: error.message
          }
        });

        throw error;
      });
  }

  /**
   * 记录自定义指标
   */
  recordCustomMetric(name: string, value: number, metadata?: Record<string, any>): void {
    this.recordMetric({
      name,
      value,
      timestamp: Date.now(),
      category: 'custom',
      metadata
    });
  }

  /**
   * 记录指标
   */
  private recordMetric(metric: PerformanceMetric): void {
    // 采样控制
    if (Math.random() > this.config.sampleRate) return;

    this.metrics.push(metric);

    // 保持历史记录在限制范围内
    if (this.metrics.length > this.config.maxHistorySize) {
      this.metrics = this.metrics.slice(-this.config.maxHistorySize);
    }
  }

  /**
   * 开始定期报告
   */
  private startReporting(): void {
    this.reportingTimer = setInterval(() => {
      const report = this.generatePerformanceReport();
      this.handlePerformanceReport(report);
    }, this.config.reportingInterval);
  }

  /**
   * 生成性能报告
   */
  generatePerformanceReport(timeRange?: { start: number; end: number }): PerformanceReport {
    const now = Date.now();
    const period = timeRange || {
      start: now - this.config.reportingInterval,
      end: now,
      duration: this.config.reportingInterval
    };

    // 筛选时间范围内的指标
    const filteredMetrics = this.metrics.filter(metric => 
      metric.timestamp >= period.start && metric.timestamp <= period.end
    );

    // 按类别分组
    const metricsByCategory = {
      navigation: filteredMetrics.filter(m => m.category === 'navigation'),
      api: filteredMetrics.filter(m => m.category === 'api'),
      interaction: filteredMetrics.filter(m => m.category === 'interaction'),
      rendering: filteredMetrics.filter(m => m.category === 'rendering'),
      custom: filteredMetrics.filter(m => m.category === 'custom')
    };

    // 计算摘要统计
    const totalMetrics = filteredMetrics.length;
    const averageResponseTime = totalMetrics > 0 
      ? filteredMetrics.reduce((sum, m) => sum + m.value, 0) / totalMetrics 
      : 0;
    
    const slowQueries = metricsByCategory.api.filter(m => 
      m.value > this.thresholds.api.acceptable
    ).length;

    // 计算性能分数 (0-100)
    const performanceScore = this.calculatePerformanceScore(metricsByCategory);

    // 识别问题和建议
    const issues = this.identifyPerformanceIssues(metricsByCategory);
    const recommendations = this.generateRecommendations(metricsByCategory, issues);

    return {
      period: {
        start: period.start,
        end: period.end,
        duration: period.end - period.start
      },
      metrics: metricsByCategory,
      summary: {
        totalMetrics,
        averageResponseTime,
        slowQueries,
        performanceScore
      },
      issues,
      recommendations
    };
  }

  /**
   * 计算性能分数
   */
  private calculatePerformanceScore(metrics: Record<string, PerformanceMetric[]>): number {
    let score = 100;
    
    // Web Vitals评分
    const fcp = metrics.navigation.find(m => m.name === 'first_contentful_paint');
    if (fcp && fcp.value > this.thresholds.navigation.firstContentfulPaint) {
      score -= 15;
    }

    const lcp = metrics.navigation.find(m => m.name === 'largest_contentful_paint');
    if (lcp && lcp.value > this.thresholds.navigation.largestContentfulPaint) {
      score -= 20;
    }

    const cls = metrics.navigation.find(m => m.name === 'cumulative_layout_shift');
    if (cls && cls.value > this.thresholds.navigation.cumulativeLayoutShift) {
      score -= 15;
    }

    const fid = metrics.interaction.find(m => m.name === 'first_input_delay');
    if (fid && fid.value > this.thresholds.navigation.firstInputDelay) {
      score -= 10;
    }

    // API性能评分
    const slowApiCalls = metrics.api.filter(m => m.value > this.thresholds.api.acceptable).length;
    const totalApiCalls = metrics.api.length;
    if (totalApiCalls > 0) {
      const slowRatio = slowApiCalls / totalApiCalls;
      score -= slowRatio * 20;
    }

    // 渲染性能评分
    const lowFPSMetrics = metrics.rendering.filter(m => 
      m.name === 'rendering_fps' && m.value < this.thresholds.rendering.warningFPS
    );
    if (lowFPSMetrics.length > 0) {
      score -= 10;
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * 识别性能问题
   */
  private identifyPerformanceIssues(metrics: Record<string, PerformanceMetric[]>): string[] {
    const issues: string[] = [];

    // 页面加载问题
    const loadTime = metrics.navigation.find(m => m.name === 'page_load_time');
    if (loadTime && loadTime.value > 3000) {
      issues.push(`页面加载时间过长: ${(loadTime.value / 1000).toFixed(2)}秒`);
    }

    // API响应问题
    const slowAPIs = metrics.api.filter(m => m.value > this.thresholds.api.slow);
    if (slowAPIs.length > 0) {
      issues.push(`检测到 ${slowAPIs.length} 个慢速API请求`);
    }

    // 渲染性能问题
    const lowFPS = metrics.rendering.filter(m => 
      m.name === 'rendering_fps' && m.value < this.thresholds.rendering.warningFPS
    );
    if (lowFPS.length > 0) {
      issues.push(`检测到渲染帧率低于 ${this.thresholds.rendering.warningFPS} FPS`);
    }

    // 交互延迟问题
    const slowInteractions = metrics.interaction.filter(m => 
      m.value > this.thresholds.interaction.acceptable
    );
    if (slowInteractions.length > 0) {
      issues.push(`检测到 ${slowInteractions.length} 个缓慢的用户交互`);
    }

    return issues;
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(
    metrics: Record<string, PerformanceMetric[]>, 
    issues: string[]
  ): string[] {
    const recommendations: string[] = [];

    if (issues.some(issue => issue.includes('页面加载'))) {
      recommendations.push('优化图片和资源加载，考虑使用CDN');
      recommendations.push('启用浏览器缓存和资源压缩');
    }

    if (issues.some(issue => issue.includes('API'))) {
      recommendations.push('优化数据库查询和API响应时间');
      recommendations.push('考虑使用缓存策略减少API调用');
    }

    if (issues.some(issue => issue.includes('帧率'))) {
      recommendations.push('优化动画和渲染逻辑');
      recommendations.push('减少DOM操作和重绘次数');
    }

    if (issues.some(issue => issue.includes('交互'))) {
      recommendations.push('优化事件处理函数的执行效率');
      recommendations.push('使用防抖和节流技术优化高频事件');
    }

    // 通用建议
    if (issues.length === 0) {
      recommendations.push('当前性能表现良好，继续保持');
    } else {
      recommendations.push('定期监控性能指标，及时发现问题');
    }

    return recommendations;
  }

  /**
   * 处理性能报告
   */
  private handlePerformanceReport(report: PerformanceReport): void {
    // 在开发环境中输出详细信息
    if (process.env.NODE_ENV === 'development') {
      console.group('[ResponseTimeMonitor] Performance Report');
      console.log('Performance Score:', report.summary.performanceScore);
      console.log('Average Response Time:', report.summary.averageResponseTime.toFixed(2) + 'ms');
      console.log('Slow Queries:', report.summary.slowQueries);
      
      if (report.issues.length > 0) {
        console.warn('Issues:', report.issues);
      }
      
      if (report.recommendations.length > 0) {
        console.info('Recommendations:', report.recommendations);
      }
      
      console.groupEnd();
    }

    // 可以在这里添加发送报告到监控服务的逻辑
  }

  /**
   * 获取最新的性能报告
   */
  getLatestReport(): PerformanceReport {
    return this.generatePerformanceReport();
  }

  /**
   * 获取指标历史
   */
  getMetricsHistory(category?: PerformanceMetric['category']): PerformanceMetric[] {
    if (category) {
      return this.metrics.filter(m => m.category === category);
    }
    return [...this.metrics];
  }

  /**
   * 清除历史指标
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // 重启报告定时器
    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
    }
    this.startReporting();
  }

  /**
   * 更新阈值
   */
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  /**
   * 获取配置
   */
  getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  /**
   * 获取阈值
   */
  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  /**
   * 销毁监控器
   */
  destroy(): void {
    // 停止报告定时器
    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
      this.reportingTimer = null;
    }

    // 断开所有观察器
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];

    // 清除指标
    this.metrics = [];
  }
}

// 创建全局实例
export const responseTimeMonitor = ResponseTimeMonitor.getInstance();
export { ResponseTimeMonitor };