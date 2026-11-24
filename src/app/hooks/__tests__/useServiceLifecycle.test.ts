import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useServiceLifecycle } from '../useServiceLifecycle';
import { forwardTimerManager } from '../../../utils/forward-timer';
import { performanceMonitor } from '../../../utils/performance-monitor/PerformanceMonitor';
import { exceptionRuleManager } from '../../../services/exception-rule-manager/ExceptionRuleManager';
import { checkForUpdates } from '../../../utils/platform-adapters/updater';

vi.mock('../../../utils/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils/env')>()),
  isDev: false,
}));

vi.mock('../../../utils/forward-timer', () => ({
  forwardTimerManager: {
    start: vi.fn(),
    stop: vi.fn(),
  },
}));

vi.mock('../../../utils/performance-monitor/PerformanceMonitor', () => ({
  performanceMonitor: { start: vi.fn(), stop: vi.fn() },
}));

vi.mock(
  '../../../services/exception-rule-manager/ExceptionRuleManager',
  () => ({
    exceptionRuleManager: { initialize: vi.fn(async () => undefined) },
  }),
);

vi.mock('../../../services/migration', () => ({
  migrationCoordinator: {
    runStartupMigrations: vi.fn(),
  },
}));

vi.mock('../../../utils/platform-adapters/updater', () => ({
  checkForUpdates: vi.fn(async () => undefined),
}));

describe('useServiceLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start services on mount and stop services on unmount', async () => {
    const { result, unmount } = renderHook(() => useServiceLifecycle());

    expect(result.current.isInitialized).toBe(true);
    expect(forwardTimerManager.start).toHaveBeenCalledTimes(1);
    expect(performanceMonitor.start).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    await Promise.resolve();

    expect(exceptionRuleManager.initialize).toHaveBeenCalledTimes(1);
    expect(checkForUpdates).toHaveBeenCalledTimes(1);

    unmount();

    expect(forwardTimerManager.stop).toHaveBeenCalledTimes(1);
  });
});
