import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const addToBufferMock = vi.hoisted(() => vi.fn());
const processBatchDataMock = vi.hoisted(() => vi.fn(async () => undefined));
const runWhenIdleMock = vi.hoisted(() =>
  vi.fn((callback: () => void) => callback()),
);
const startFpsMonitoringMock = vi.hoisted(() => vi.fn());
const measureRenderMock = vi.hoisted(() => vi.fn());
const measureInteractionMock = vi.hoisted(() => vi.fn());
const createPerformanceObserversMock = vi.hoisted(() => vi.fn());
const reportMetricsMock = vi.hoisted(() =>
  vi.fn((metrics) => ({ ...metrics })),
);
const checkPerformanceMock = vi.hoisted(() =>
  vi.fn(() => ({ passed: true, issues: [] as string[] })),
);
const performanceLoggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
}));

vi.mock('../../env', () => ({
  isDev: true,
}));

vi.mock('../../performanceLogger', () => ({
  performanceLogger: performanceLoggerMock,
}));

vi.mock('../buffer', () => ({
  addToBuffer: addToBufferMock,
  processBatchData: processBatchDataMock,
}));

vi.mock('../idle', () => ({
  runWhenIdle: runWhenIdleMock,
}));

vi.mock('../fps', () => ({
  startFpsMonitoring: startFpsMonitoringMock,
}));

vi.mock('../measures', () => ({
  measureRender: measureRenderMock,
  measureInteraction: measureInteractionMock,
}));

vi.mock('../observers', () => ({
  createPerformanceObservers: createPerformanceObserversMock,
}));

vi.mock('../reporting', () => ({
  reportMetrics: reportMetricsMock,
  checkPerformance: checkPerformanceMock,
}));

import { performanceMonitor } from '../PerformanceMonitor';

function resetMonitorState() {
  const monitor = performanceMonitor as unknown as {
    metrics: {
      renderTime: number;
      interactionTime: number;
      layoutShifts: number;
      fps: number;
    };
    observers: Record<string, { disconnect?: () => void }>;
    fpsCounter: {
      frames: number;
      lastTime: number;
      fps: number;
      lastWarnTime: number;
    };
    isMonitoring: boolean;
    backgroundMode: boolean;
    dataBuffer: unknown[];
    reportingEnabled: boolean;
    initialized: boolean;
    batchInterval: ReturnType<typeof setInterval> | null;
  };

  if (monitor.batchInterval) {
    clearInterval(monitor.batchInterval);
  }

  monitor.metrics = {
    renderTime: 0,
    interactionTime: 0,
    layoutShifts: 0,
    fps: 0,
  };
  monitor.observers = {};
  monitor.fpsCounter = {
    frames: 0,
    lastTime: 0,
    fps: 0,
    lastWarnTime: 0,
  };
  monitor.isMonitoring = false;
  monitor.backgroundMode = true;
  monitor.dataBuffer = [];
  monitor.reportingEnabled = true;
  monitor.initialized = false;
  monitor.batchInterval = null;
}

describe('performance-monitor/PerformanceMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    createPerformanceObserversMock.mockReturnValue({
      layout: { disconnect: vi.fn() },
      paint: { disconnect: vi.fn() },
      measure: { disconnect: vi.fn() },
    });
    resetMonitorState();
  });

  afterEach(() => {
    performanceMonitor.stop();
    vi.useRealTimers();
    resetMonitorState();
  });

  it('starts monitoring only once and processes background batches', async () => {
    performanceMonitor.start();
    performanceMonitor.start();

    expect(startFpsMonitoringMock).toHaveBeenCalledTimes(1);
    expect(runWhenIdleMock).toHaveBeenCalledTimes(1);
    expect(createPerformanceObserversMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(processBatchDataMock).toHaveBeenCalledTimes(1);
  });

  it('supports foreground mode without scheduling batch interval', () => {
    performanceMonitor.setBackgroundMode(false);
    performanceMonitor.start();

    expect(processBatchDataMock).not.toHaveBeenCalled();
    expect(
      (performanceMonitor as unknown as { batchInterval: unknown })
        .batchInterval,
    ).toBeNull();
    expect(performanceLoggerMock.debug).toHaveBeenCalledTimes(1);
  });

  it('skips observer initialization when reporting is disabled', () => {
    performanceMonitor.setReportingEnabled(false);
    performanceMonitor.start();

    expect(runWhenIdleMock).not.toHaveBeenCalled();
    expect(createPerformanceObserversMock).not.toHaveBeenCalled();
  });

  it('stops monitoring, disconnects observers, clears interval, and reports in dev', () => {
    const layoutDisconnect = vi.fn();
    const paintDisconnect = vi.fn();
    const measureDisconnect = vi.fn();
    createPerformanceObserversMock.mockReturnValue({
      layout: { disconnect: layoutDisconnect },
      paint: { disconnect: paintDisconnect },
      measure: { disconnect: measureDisconnect },
    });

    performanceMonitor.start();
    performanceMonitor.stop();

    expect(layoutDisconnect).toHaveBeenCalledTimes(1);
    expect(paintDisconnect).toHaveBeenCalledTimes(1);
    expect(measureDisconnect).toHaveBeenCalledTimes(1);
    expect(reportMetricsMock).toHaveBeenCalledTimes(1);
    expect(performanceLoggerMock.debug).toHaveBeenCalled();
  });

  it('delegates measure and reporting APIs', () => {
    measureRenderMock.mockReturnValue('render-result');
    measureInteractionMock.mockReturnValue(123);
    reportMetricsMock.mockReturnValue({
      renderTime: 5,
      interactionTime: 6,
      layoutShifts: 0,
      fps: 60,
    });
    checkPerformanceMock.mockReturnValue({ passed: false, issues: ['slow'] });

    const renderResult = performanceMonitor.measureRender(
      'Card',
      () => 'ignored',
    );
    const interactionResult = performanceMonitor.measureInteraction(
      'click',
      () => 1,
    );
    const reportResult = performanceMonitor.reportMetrics();
    const checkResult = performanceMonitor.checkPerformance();

    expect(renderResult).toBe('render-result');
    expect(interactionResult).toBe(123);
    expect(measureRenderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        componentName: 'Card',
      }),
    );
    expect(measureInteractionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        interactionName: 'click',
      }),
    );
    expect(reportResult).toEqual({
      renderTime: 5,
      interactionTime: 6,
      layoutShifts: 0,
      fps: 60,
    });
    expect(checkResult).toEqual({ passed: false, issues: ['slow'] });
  });

  it('passes monitor callbacks into helper modules', () => {
    performanceMonitor.start();

    const fpsArgs = startFpsMonitoringMock.mock.calls[0]?.[0] as {
      getIsMonitoring: () => boolean;
    };
    expect(fpsArgs.getIsMonitoring()).toBe(true);

    const observerArgs = createPerformanceObserversMock.mock.calls[0]?.[0] as {
      addToBuffer: (entry: { type: 'paint'; timestamp: number }) => void;
    };
    observerArgs.addToBuffer({ type: 'paint', timestamp: 11 });

    measureInteractionMock.mockImplementation(({ addToBuffer }) => {
      addToBuffer({
        type: 'measure',
        name: 'chain-editor-click',
        duration: 5,
        timestamp: 22,
      });
      return 'interaction-result';
    });

    const result = performanceMonitor.measureInteraction(
      'click',
      () => 'unused',
    );

    expect(result).toBe('interaction-result');
    expect(addToBufferMock).toHaveBeenCalledWith(
      expect.any(Array),
      100,
      expect.objectContaining({ type: 'paint', timestamp: 11 }),
    );
    expect(addToBufferMock).toHaveBeenCalledWith(
      expect.any(Array),
      100,
      expect.objectContaining({
        type: 'measure',
        name: 'chain-editor-click',
        duration: 5,
        timestamp: 22,
      }),
    );

    performanceMonitor.stop();
    expect(fpsArgs.getIsMonitoring()).toBe(false);
  });

  it('delegates buffering through addToBuffer helper', () => {
    const monitor = performanceMonitor as unknown as {
      addToBuffer: (entry: { type: string; timestamp: number }) => void;
    };

    monitor.addToBuffer({ type: 'paint', timestamp: 1 });

    expect(addToBufferMock).toHaveBeenCalledWith(
      expect.any(Array),
      100,
      expect.objectContaining({ type: 'paint', timestamp: 1 }),
    );
  });
});
