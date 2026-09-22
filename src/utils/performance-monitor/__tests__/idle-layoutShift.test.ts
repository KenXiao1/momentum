import { describe, expect, it, vi } from 'vitest';
import { runWhenIdle } from '../idle';
import { isLayoutShiftEntry } from '../layoutShift';

describe('performance-monitor idle', () => {
  it('uses requestIdleCallback when present', () => {
    const callback = vi.fn();
    const requestIdleCallbackMock = vi.fn((cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 5 } as IdleDeadline);
      return 1;
    });

    const previous = window.requestIdleCallback;
    window.requestIdleCallback = requestIdleCallbackMock;

    try {
      runWhenIdle(callback, 222);
      expect(requestIdleCallbackMock).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledTimes(1);
    } finally {
      window.requestIdleCallback = previous;
    }
  });

  it('falls back to setTimeout when requestIdleCallback is not available', () => {
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

describe('isLayoutShiftEntry', () => {
  it('returns false when entry type is not layout-shift', () => {
    const result = isLayoutShiftEntry({
      entryType: 'mark',
    } as PerformanceEntry);
    expect(result).toBe(false);
  });

  it('returns false for malformed layout-shift-like entry', () => {
    const malformed = {
      entryType: 'layout-shift',
      value: '1',
      hadRecentInput: true,
      sources: [],
    } as unknown as PerformanceEntry;
    expect(isLayoutShiftEntry(malformed)).toBe(false);
  });

  it('returns true for valid layout shift entry shape', () => {
    const valid = {
      entryType: 'layout-shift',
      value: 0.1,
      hadRecentInput: false,
      sources: [],
    } as unknown as PerformanceEntry;
    expect(isLayoutShiftEntry(valid)).toBe(true);
  });
});
