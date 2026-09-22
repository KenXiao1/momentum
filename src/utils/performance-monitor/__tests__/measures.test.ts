import { describe, expect, it, vi } from 'vitest';
import { measureInteraction, measureRender } from '../measures';
import { performanceLogger } from '../../performanceLogger';
import type { PerformanceMetrics } from '../types';

describe('performance-monitor/measures', () => {
  it('measureRender bypasses instrumentation when reporting is disabled', () => {
    const renderFn = vi.fn(() => 'result');
    const markSpy = vi.spyOn(performance, 'mark');

    const value = measureRender({
      reportingEnabled: false,
      componentName: 'ChainEditor',
      renderFn,
    });

    expect(value).toBe('result');
    expect(renderFn).toHaveBeenCalledTimes(1);
    expect(markSpy).not.toHaveBeenCalled();
  });

  it('measureRender creates marks and handles measure failures', () => {
    const renderFn = vi.fn(() => ({ ok: true }));
    const markSpy = vi.spyOn(performance, 'mark');
    const measureSpy = vi
      .spyOn(performance, 'measure')
      .mockImplementationOnce(() => {
        throw new Error('measure failed');
      });

    const first = measureRender({
      reportingEnabled: true,
      componentName: 'FirstRender',
      renderFn,
    });
    const second = measureRender({
      reportingEnabled: true,
      componentName: 'SecondRender',
      renderFn,
    });

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(markSpy).toHaveBeenCalled();
    expect(measureSpy).toHaveBeenCalledTimes(2);
  });

  it('measureInteraction updates max duration and warns/adds buffer on slow paths', () => {
    const warnSpy = vi
      .spyOn(performanceLogger, 'warn')
      .mockImplementation(() => undefined);
    const metrics: PerformanceMetrics = {
      renderTime: 0,
      interactionTime: 20,
      layoutShifts: 0,
      fps: 60,
    };
    const addToBuffer = vi.fn();

    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(170)
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(360)
      .mockReturnValueOnce(400)
      .mockReturnValueOnce(560);

    const fastResult = measureInteraction({
      reportingEnabled: true,
      backgroundMode: false,
      metrics,
      interactionName: 'quick-click',
      interactionFn: () => 'fast',
      addToBuffer,
    });

    const slowForegroundResult = measureInteraction({
      reportingEnabled: true,
      backgroundMode: false,
      metrics,
      interactionName: 'expensive-save',
      interactionFn: () => 'slow-fg',
      addToBuffer,
    });

    const slowBackgroundResult = measureInteraction({
      reportingEnabled: true,
      backgroundMode: true,
      metrics,
      interactionName: 'expensive-sync',
      interactionFn: () => 'slow-bg',
      addToBuffer,
    });

    expect(fastResult).toBe('fast');
    expect(slowForegroundResult).toBe('slow-fg');
    expect(slowBackgroundResult).toBe('slow-bg');
    expect(metrics.interactionTime).toBe(160);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(addToBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'slow-interaction',
        name: 'expensive-sync',
        duration: 160,
      }),
    );
  });

  it('measureInteraction skips instrumentation when reporting is disabled', () => {
    const metrics: PerformanceMetrics = {
      renderTime: 0,
      interactionTime: 5,
      layoutShifts: 0,
      fps: 60,
    };

    const result = measureInteraction({
      reportingEnabled: false,
      backgroundMode: false,
      metrics,
      interactionName: 'noop',
      interactionFn: () => 42,
      addToBuffer: vi.fn(),
    });

    expect(result).toBe(42);
    expect(metrics.interactionTime).toBe(5);
  });
});
