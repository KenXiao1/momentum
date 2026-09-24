import { describe, expect, it, vi } from 'vitest';
import { runWhenIdle } from '../runWhenIdle';

describe('runWhenIdle', () => {
  it('uses requestIdleCallback when available', () => {
    const callback = vi.fn();
    const requestIdleCallbackMock = vi.fn((cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 10 } as IdleDeadline);
      return 1;
    });

    const previous = window.requestIdleCallback;
    window.requestIdleCallback = requestIdleCallbackMock;

    try {
      runWhenIdle(callback, 321);
      expect(requestIdleCallbackMock).toHaveBeenCalledWith(callback, {
        timeout: 321,
      });
      expect(callback).toHaveBeenCalledTimes(1);
    } finally {
      window.requestIdleCallback = previous;
    }
  });

  it('falls back to setTimeout when requestIdleCallback is unavailable', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const previous = window.requestIdleCallback;
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    try {
      runWhenIdle(callback);
      expect(callback).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(callback).toHaveBeenCalledTimes(1);
    } finally {
      window.requestIdleCallback = previous;
      vi.useRealTimers();
    }
  });
});
