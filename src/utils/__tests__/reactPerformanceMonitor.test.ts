import { beforeEach, describe, expect, it, vi } from 'vitest';

type PerformanceLoggerMock = {
  log: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  group: ReturnType<typeof vi.fn>;
};

async function loadMonitor(isDev: boolean): Promise<{
  monitor: typeof import('../reactPerformanceMonitor').reactPerformanceMonitor;
  logger: PerformanceLoggerMock;
}> {
  vi.resetModules();

  const logger: PerformanceLoggerMock = {
    log: vi.fn(),
    warn: vi.fn(),
    group: vi.fn((_label: string, fn: () => void) => fn()),
  };

  vi.doMock('../env', () => ({ isDev }));
  vi.doMock('../performanceLogger', () => ({ performanceLogger: logger }));

  const module = await import('../reactPerformanceMonitor');
  module.reactPerformanceMonitor.reset();

  return {
    monitor: module.reactPerformanceMonitor,
    logger,
  };
}

describe('reactPerformanceMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks render metrics', async () => {
    const { monitor, logger } = await loadMonitor(true);

    monitor.trackRender('Dashboard', 12);
    monitor.trackRender('Dashboard', 20);

    const stats = monitor.getStats();

    expect(stats.totalRenders).toBe(2);
    expect(stats.avgRenderTime).toBe('16.00');
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('tracks per-component render metrics and resets them', async () => {
    const { monitor } = await loadMonitor(true);

    monitor.trackComponentRender('Dashboard', 'mount', 12);
    monitor.trackComponentRender('Dashboard', 'update', 18);
    monitor.trackComponentRender('RSIP', 'mount', 9);

    expect(monitor.getComponentStats()).toEqual({
      Dashboard: {
        renderCount: 2,
        totalDuration: 30,
        maxDuration: 18,
        lastDuration: 18,
        avgDuration: 15,
        lastPhase: 'update',
      },
      RSIP: {
        renderCount: 1,
        totalDuration: 9,
        maxDuration: 9,
        lastDuration: 9,
        avgDuration: 9,
        lastPhase: 'mount',
      },
    });

    monitor.reset();

    expect(monitor.getComponentStats()).toEqual({});
    expect(monitor.getStats().totalRenders).toBe(0);
  });

  it('generates report and emits recommendation warnings when thresholds are exceeded', async () => {
    const { monitor, logger } = await loadMonitor(true);

    monitor.trackComponentRender('HeavyComponent', 'mount', 25);

    const report = monitor.generateReport();

    expect(report.totalRenders).toBe(1);
    expect(report.components).toEqual({
      HeavyComponent: {
        renderCount: 1,
        totalDuration: 25,
        maxDuration: 25,
        lastDuration: 25,
        avgDuration: 25,
        lastPhase: 'mount',
      },
    });
    expect(logger.group).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('does not emit slow warnings in non-dev mode', async () => {
    const { monitor, logger } = await loadMonitor(false);

    monitor.trackRender('ProdComponent', 50);

    expect(logger.warn).not.toHaveBeenCalled();
    expect(monitor.getStats().totalRenders).toBe(1);
  });
});
