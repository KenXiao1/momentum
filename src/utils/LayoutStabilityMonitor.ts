import { useCallback } from 'react';
/**
 * 布局稳定性监控器
 * 监控和修复布局偏移问题
 */

import { isDev } from './env';
import { logger } from './logger';
import { toError } from './errorMessage';
import {
  DOMChangeObserver,
  LayoutIssueDetector,
  LayoutShiftObserver,
  ResizeChangeObserver,
  describeElement,
} from './layout-monitor';

export class LayoutStabilityMonitor {
  private readonly issueDetector: LayoutIssueDetector;
  private layoutShiftObserver: LayoutShiftObserver | null = null;
  private domChangeObserver: DOMChangeObserver | null = null;
  private resizeChangeObserver: ResizeChangeObserver | null = null;
  private isMonitoring = false;
  private stabilizationCallbacks: Set<() => void> = new Set();
  private isStabilizing = false;

  constructor(autoFix = true) {
    this.issueDetector = new LayoutIssueDetector(autoFix);
  }

  startMonitoring(container?: HTMLElement) {
    if (this.isMonitoring) return;
    if (typeof window === 'undefined') return;
    if (typeof document === 'undefined') return;

    const target = container || document.body;

    this.layoutShiftObserver ??= new LayoutShiftObserver((entry) => {
      this.issueDetector.handleLayoutShift(entry);
    });
    this.domChangeObserver ??= new DOMChangeObserver((element) => {
      this.issueDetector.checkElement(element);
    });
    this.resizeChangeObserver ??= new ResizeChangeObserver((element) => {
      this.issueDetector.checkElementStability(element);
    });

    this.isMonitoring = true;

    this.layoutShiftObserver.start();
    this.domChangeObserver.observe(target);
    this.resizeChangeObserver.observe(target);

    this.performInitialCheck(target);

    if (isDev) {
      logger.debug('LAYOUT', '📳 布局稳定性监控已启动', {
        target: describeElement(target),
      });
    }
  }

  stopMonitoring() {
    this.isMonitoring = false;

    this.layoutShiftObserver?.stop();
    this.domChangeObserver?.stop();
    this.resizeChangeObserver?.stop();

    if (isDev) {
      logger.debug('LAYOUT', '⏹️ 布局稳定性监控已停止');
      this.issueDetector.reportIssues();
    }
  }

  // 立即检查当前布局
  checkNow(container?: HTMLElement) {
    if (typeof document === 'undefined') return;
    const target = container || document.body;
    this.performInitialCheck(target);
  }

  private performInitialCheck(container: HTMLElement) {
    this.issueDetector.performInitialCheck(container);
  }

  // 获取布局稳定性报告
  getStabilityReport() {
    return this.issueDetector.getStabilityReport();
  }

  clearIssues() {
    this.issueDetector.clearIssues();
  }

  // 稳定布局（用于规则管理界面）
  stabilizeLayout(container: HTMLElement): void {
    if (this.isStabilizing) return;

    this.isStabilizing = true;

    // 使用 requestAnimationFrame 确保在下一帧处理
    requestAnimationFrame(() => {
      this.issueDetector.applyStabilityFixes(container);

      // 通知稳定化完成
      this.stabilizationCallbacks.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          logger.error(
            'LAYOUT',
            'Stabilization callback error',
            undefined,
            toError(error),
          );
        }
      });

      this.isStabilizing = false;
    });
  }

  // 注册稳定化回调
  onStabilized(callback: () => void): () => void {
    this.stabilizationCallbacks.add(callback);
    return () => this.stabilizationCallbacks.delete(callback);
  }

  // 检查是否正在稳定化
  isStabilizingLayout(): boolean {
    return this.isStabilizing;
  }
}

// 单例实例
export const layoutStabilityMonitor = new LayoutStabilityMonitor();

// React Hook
export const useLayoutStability = (
  containerRef?: React.RefObject<HTMLElement>,
) => {
  const startMonitoring = useCallback(() => {
    const container = containerRef?.current || undefined;
    layoutStabilityMonitor.startMonitoring(container);
  }, [containerRef]);

  const stopMonitoring = useCallback(() => {
    layoutStabilityMonitor.stopMonitoring();
  }, []);

  const checkNow = () => {
    const container = containerRef?.current || undefined;
    layoutStabilityMonitor.checkNow(container);
  };

  const getReport = () => {
    return layoutStabilityMonitor.getStabilityReport();
  };

  return {
    startMonitoring,
    stopMonitoring,
    checkNow,
    getReport,
    clearIssues: () => layoutStabilityMonitor.clearIssues(),
  };
};
