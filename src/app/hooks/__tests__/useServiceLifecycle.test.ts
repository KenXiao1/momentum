import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useServiceLifecycle } from '../useServiceLifecycle';
import { forwardTimerManager } from '../../../utils/forwardTimer';
import { ruleStateManager } from '../../../services/RuleStateManager';
import { migrationCoordinator } from '../../../services/migration';
import { exceptionRuleCache } from '../../../utils/cache';
import { performanceMonitor } from '../../../utils/performanceMonitor';
import { initializeRuleSystem } from '../../../utils/initializeRuleSystem';
import { checkForUpdates } from '../../../utils/platform-adapters/updater';
import { logger } from '../../../utils/logger';

vi.mock('../../../utils/env', () => ({
  isDev: false,
}));

vi.mock('../../../utils/forwardTimer', () => ({
  forwardTimerManager: {
    start: vi.fn(),
    stop: vi.fn(),
  },
}));

vi.mock('../../../utils/cache', () => ({
  exceptionRuleCache: { start: vi.fn(), stop: vi.fn() },
}));

vi.mock('../../../utils/performanceMonitor', () => ({
  performanceMonitor: { start: vi.fn(), stop: vi.fn() },
}));

vi.mock('../../../services/RuleStateManager', () => ({
  ruleStateManager: {
    start: vi.fn(),
    stop: vi.fn(),
  },
}));

vi.mock('../../../utils/initializeRuleSystem', () => ({
  initializeRuleSystem: vi.fn(async () => ({ success: true, message: 'ok' })),
}));

vi.mock('../../../services/migration', () => ({
  migrationCoordinator: {
    runStartupMigrations: vi.fn(),
  },
}));

vi.mock('../../../utils/platform-adapters/updater', () => ({
  checkForUpdates: vi.fn(async () => undefined),
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
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
    expect(exceptionRuleCache.start).toHaveBeenCalledTimes(1);
    expect(ruleStateManager.start).toHaveBeenCalledTimes(1);
    expect(performanceMonitor.start).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    await Promise.resolve();

    expect(initializeRuleSystem).toHaveBeenCalledTimes(1);
    expect(migrationCoordinator.runStartupMigrations).toHaveBeenCalledTimes(1);
    expect(checkForUpdates).toHaveBeenCalledTimes(1);

    unmount();

    expect(forwardTimerManager.stop).toHaveBeenCalledTimes(1);
    expect(exceptionRuleCache.stop).toHaveBeenCalledTimes(1);
    expect(ruleStateManager.stop).toHaveBeenCalledTimes(1);
  });

  it('should log error when non-critical initialization reports failure', async () => {
    vi.mocked(initializeRuleSystem).mockResolvedValue({
      success: false,
      message: 'init failed',
    });

    renderHook(() => useServiceLifecycle());

    vi.advanceTimersByTime(150);
    await Promise.resolve();

    expect(logger.error).toHaveBeenCalledWith(
      'SERVICE_LIFECYCLE',
      'Rule system initialization failed: init failed',
    );
  });
});
