import { LayoutStabilityMonitor } from '../LayoutStabilityMonitor';

const ensureWindowProp = (key: string, value: unknown) => {
  Object.defineProperty(window, key, {
    configurable: true,
    writable: true,
    value,
  });
};

const restoreWindowProp = (key: string, original: unknown) => {
  if (original === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (window as any)[key];
    return;
  }

  ensureWindowProp(key, original);
};

const ensureGlobalProp = (key: string, value: unknown) => {
  try {
    (global as any)[key] = value;
    return;
  } catch {
    // fall back to defineProperty below
  }

  try {
    Object.defineProperty(global, key, {
      configurable: true,
      writable: true,
      value,
    });
  } catch {
    // If the environment defines a non-configurable global (common in jsdom),
    // rely on the window override instead.
  }
};

const restoreGlobalProp = (key: string, original: unknown) => {
  if (original === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (global as any)[key];
    } catch {
      // ignore
    }
    return;
  }

  ensureGlobalProp(key, original);
};

describe('LayoutStabilityMonitor', () => {
  let monitor: LayoutStabilityMonitor;
  let container: HTMLElement;

  let resizeObserverObserve: ReturnType<
    typeof vi.fn<(...args: unknown[]) => void>
  >;
  let resizeObserverDisconnect: ReturnType<
    typeof vi.fn<(...args: unknown[]) => void>
  >;
  let mutationObserverObserve: ReturnType<
    typeof vi.fn<(...args: unknown[]) => void>
  >;
  let mutationObserverDisconnect: ReturnType<
    typeof vi.fn<(...args: unknown[]) => void>
  >;
  let performanceObserverObserve: ReturnType<
    typeof vi.fn<(...args: unknown[]) => void>
  >;
  let performanceObserverDisconnect: ReturnType<
    typeof vi.fn<(...args: unknown[]) => void>
  >;

  let mockResizeObserver: ReturnType<
    typeof vi.fn<(...args: unknown[]) => void>
  >;
  let mockMutationObserver: ReturnType<
    typeof vi.fn<(...args: unknown[]) => void>
  >;
  let mockPerformanceObserver: ReturnType<
    typeof vi.fn<(...args: unknown[]) => void>
  >;
  let mockRequestAnimationFrame: ReturnType<
    typeof vi.fn<(callback: FrameRequestCallback) => number>
  >;

  let originalResizeObserver: unknown;
  let originalMutationObserver: unknown;
  let originalPerformanceObserver: unknown;
  let originalRequestAnimationFrame: unknown;

  let originalGlobalResizeObserver: unknown;
  let originalGlobalMutationObserver: unknown;
  let originalGlobalPerformanceObserver: unknown;
  let originalGlobalRequestAnimationFrame: unknown;

  const flushRaf = () => {
    vi.advanceTimersByTime(16);
  };

  beforeEach(() => {
    vi.useFakeTimers();

    originalResizeObserver = (window as any).ResizeObserver;
    originalMutationObserver = (window as any).MutationObserver;
    originalPerformanceObserver = (window as any).PerformanceObserver;
    originalRequestAnimationFrame = (window as any).requestAnimationFrame;

    originalGlobalResizeObserver = (global as any).ResizeObserver;
    originalGlobalMutationObserver = (global as any).MutationObserver;
    originalGlobalPerformanceObserver = (global as any).PerformanceObserver;
    originalGlobalRequestAnimationFrame = (global as any).requestAnimationFrame;

    resizeObserverObserve = vi.fn();
    resizeObserverDisconnect = vi.fn();
    mockResizeObserver = vi.fn();
    class MockResizeObserver {
      observe = resizeObserverObserve;
      disconnect = resizeObserverDisconnect;
      unobserve = vi.fn();
      constructor(cb: ResizeObserverCallback) {
        mockResizeObserver(cb);
      }
    }

    mutationObserverObserve = vi.fn();
    mutationObserverDisconnect = vi.fn();
    mockMutationObserver = vi.fn();
    class MockMutationObserver {
      observe = mutationObserverObserve;
      disconnect = mutationObserverDisconnect;
      constructor(cb: MutationCallback) {
        mockMutationObserver(cb);
      }
    }

    performanceObserverObserve = vi.fn();
    performanceObserverDisconnect = vi.fn();
    mockPerformanceObserver = vi.fn();
    class MockPerformanceObserver {
      observe = performanceObserverObserve;
      disconnect = performanceObserverDisconnect;
      constructor(cb: PerformanceObserverCallback) {
        mockPerformanceObserver(cb);
      }
    }

    mockRequestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      setTimeout(() => cb(performance.now()), 16);
      return 1;
    });

    ensureWindowProp('ResizeObserver', MockResizeObserver);
    ensureWindowProp('MutationObserver', MockMutationObserver);
    ensureWindowProp('PerformanceObserver', MockPerformanceObserver);
    ensureWindowProp('requestAnimationFrame', mockRequestAnimationFrame);

    ensureGlobalProp('ResizeObserver', MockResizeObserver);
    ensureGlobalProp('MutationObserver', MockMutationObserver);
    ensureGlobalProp('PerformanceObserver', MockPerformanceObserver);
    ensureGlobalProp('requestAnimationFrame', mockRequestAnimationFrame);

    monitor = new LayoutStabilityMonitor();

    // Create a mock container
    container = document.createElement('div');
    container.className = 'test-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    monitor.stopMonitoring();
    document.body.removeChild(container);

    restoreWindowProp('ResizeObserver', originalResizeObserver);
    restoreWindowProp('MutationObserver', originalMutationObserver);
    restoreWindowProp('PerformanceObserver', originalPerformanceObserver);
    restoreWindowProp('requestAnimationFrame', originalRequestAnimationFrame);

    restoreGlobalProp('ResizeObserver', originalGlobalResizeObserver);
    restoreGlobalProp('MutationObserver', originalGlobalMutationObserver);
    restoreGlobalProp('PerformanceObserver', originalGlobalPerformanceObserver);
    restoreGlobalProp(
      'requestAnimationFrame',
      originalGlobalRequestAnimationFrame,
    );
  });

  describe('initialization', () => {
    it('should initialize without errors', () => {
      expect(monitor).toBeInstanceOf(LayoutStabilityMonitor);
    });

    it('should not create observers until startMonitoring', () => {
      expect(mockMutationObserver).not.toHaveBeenCalled();
      expect(mockResizeObserver).not.toHaveBeenCalled();
      expect(mockPerformanceObserver).not.toHaveBeenCalled();
    });
  });

  describe('monitoring', () => {
    it('should start monitoring', () => {
      monitor.startMonitoring(container);

      // Should call observe methods
      expect(mockMutationObserver).toHaveBeenCalledTimes(1);
      expect(mockResizeObserver).toHaveBeenCalledTimes(1);
      expect(mockPerformanceObserver).toHaveBeenCalledTimes(1);

      expect(mutationObserverObserve).toHaveBeenCalledWith(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
      expect(resizeObserverObserve).toHaveBeenCalledWith(container);
      expect(performanceObserverObserve).toHaveBeenCalledWith({
        entryTypes: ['layout-shift'],
      });
    });

    it('should stop monitoring', () => {
      monitor.startMonitoring(container);
      monitor.stopMonitoring();

      // Should call disconnect methods
      expect(mutationObserverDisconnect).toHaveBeenCalledTimes(1);
      expect(resizeObserverDisconnect).toHaveBeenCalledTimes(1);
      expect(performanceObserverDisconnect).toHaveBeenCalledTimes(1);
    });

    it('should not start monitoring twice', () => {
      monitor.startMonitoring(container);
      monitor.startMonitoring(container);

      // Should only call observe once
      expect(mutationObserverObserve).toHaveBeenCalledTimes(1);
      expect(resizeObserverObserve).toHaveBeenCalledTimes(1);
      expect(performanceObserverObserve).toHaveBeenCalledTimes(1);
    });
  });

  describe('layout stabilization', () => {
    it('should stabilize layout', () => {
      // Add some rule items to the container
      const ruleItem = document.createElement('div');
      ruleItem.className = 'rule-item';
      container.appendChild(ruleItem);

      monitor.stabilizeLayout(container);

      flushRaf();

      expect(ruleItem.style.minHeight).toBe('60px');
      expect(ruleItem.style.boxSizing).toBe('border-box');
    });

    it('should fix scroll containers', () => {
      const scrollContainer = document.createElement('div');
      scrollContainer.setAttribute('data-scroll-container', '');
      container.appendChild(scrollContainer);

      monitor.stabilizeLayout(container);

      flushRaf();

      expect(scrollContainer.style.maxHeight).toBe('400px');
      expect(scrollContainer.style.overflowY).toBe('auto');
      expect(scrollContainer.style.overscrollBehavior).toBe('contain');
    });

    it('should fix popover layers', () => {
      const popover = document.createElement('div');
      popover.setAttribute('data-popover', '');
      container.appendChild(popover);

      monitor.stabilizeLayout(container);

      flushRaf();

      expect(popover.style.transform).toContain('translateZ(0)');
      expect(popover.style.backfaceVisibility).toBe('hidden');
    });

    it('should not stabilize if already stabilizing', () => {
      const callback = vi.fn();
      monitor.onStabilized(callback);

      monitor.stabilizeLayout(container);
      monitor.stabilizeLayout(container); // Second call should be ignored

      flushRaf();
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('callbacks', () => {
    it('should register and call stabilization callbacks', () => {
      const callback = vi.fn();
      const unsubscribe = monitor.onStabilized(callback);

      monitor.stabilizeLayout(container);

      flushRaf();
      expect(callback).toHaveBeenCalledTimes(1);

      // Test unsubscribe
      unsubscribe();
      monitor.stabilizeLayout(container);
      flushRaf();
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Test error');
      });
      const normalCallback = vi.fn();

      monitor.onStabilized(errorCallback);
      monitor.onStabilized(normalCallback);

      vi.mocked(console.error).mockClear();

      monitor.stabilizeLayout(container);

      flushRaf();

      expect(errorCallback).toHaveBeenCalledTimes(1);
      expect(normalCallback).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Stabilization callback error'),
      );
    });
  });

  describe('stability report', () => {
    it('should generate stability report', () => {
      const report = monitor.getStabilityReport();

      expect(report).toHaveProperty('cumulativeLayoutShift');
      expect(report).toHaveProperty('totalIssues');
      expect(report).toHaveProperty('issuesByType');
      expect(report).toHaveProperty('issuesBySeverity');
      expect(report).toHaveProperty('recommendations');
    });

    it('should clear issues', () => {
      monitor.clearIssues();
      const report = monitor.getStabilityReport();

      expect(report.totalIssues).toBe(0);
      expect(report.cumulativeLayoutShift).toBe(0);
    });
  });

  describe('manual checks', () => {
    it('should perform manual check', () => {
      const spy = vi.spyOn(monitor as any, 'performInitialCheck');
      monitor.checkNow(container);

      expect(spy).toHaveBeenCalledWith(container);
    });

    it('should use document.body as default container', () => {
      const spy = vi.spyOn(monitor as any, 'performInitialCheck');
      monitor.checkNow();

      expect(spy).toHaveBeenCalledWith(document.body);
    });
  });

  describe('state tracking', () => {
    it('should track stabilization state', () => {
      expect(monitor.isStabilizingLayout()).toBe(false);

      monitor.stabilizeLayout(container);
      expect(monitor.isStabilizingLayout()).toBe(true);

      flushRaf();
      expect(monitor.isStabilizingLayout()).toBe(false);
    });
  });

  describe('element checking', () => {
    it('should detect horizontal overflow', () => {
      // Create an element with overflow
      const overflowElement = document.createElement('div');
      overflowElement.style.width = '100px';
      overflowElement.style.overflow = 'visible';

      // Mock scrollWidth to be larger than clientWidth
      Object.defineProperty(overflowElement, 'scrollWidth', {
        value: 200,
        configurable: true,
      });
      Object.defineProperty(overflowElement, 'clientWidth', {
        value: 100,
        configurable: true,
      });

      container.appendChild(overflowElement);

      monitor.checkNow(container);
      const report = monitor.getStabilityReport();

      expect(report.totalIssues).toBeGreaterThan(0);
    });
  });
});
