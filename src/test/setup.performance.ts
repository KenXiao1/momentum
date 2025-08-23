import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Performance testing utilities
export const performanceUtils = {
  // Memory usage tracking
  getMemoryUsage() {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in window.performance) {
      const memory = (window.performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      };
    }
    return { used: 0, total: 0, limit: 0 };
  },

  // Timing utilities
  measureAsyncOperation: async <T>(operation: () => Promise<T>) => {
    const start = performance.now();
    const result = await operation();
    const end = performance.now();
    return {
      result,
      duration: end - start
    };
  },

  measureSyncOperation: <T>(operation: () => T) => {
    const start = performance.now();
    const result = operation();
    const end = performance.now();
    return {
      result,
      duration: end - start
    };
  },

  // Performance benchmarks (acceptable thresholds)
  BENCHMARKS: {
    FAST_OPERATION: 10, // ms
    MEDIUM_OPERATION: 100, // ms
    SLOW_OPERATION: 1000, // ms
    DATABASE_QUERY: 500, // ms
    UI_INTERACTION: 16.67, // ms (60fps)
    MEMORY_LIMIT: 50 * 1024 * 1024, // 50MB
  },

  // Load testing utilities
  async runConcurrentOperations<T>(
    operation: () => Promise<T>,
    concurrency: number,
    iterations: number = 1
  ) {
    const results = [];
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const batch = Array(concurrency).fill(null).map(() => operation());
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }

    const end = performance.now();
    
    return {
      results,
      totalTime: end - start,
      averageTime: (end - start) / (concurrency * iterations),
      operationsPerSecond: (concurrency * iterations) / ((end - start) / 1000)
    };
  },

  // Memory leak detection
  createMemoryLeakDetector() {
    let initialMemory = this.getMemoryUsage();
    
    return {
      reset: () => {
        initialMemory = this.getMemoryUsage();
      },
      check: (threshold = this.BENCHMARKS.MEMORY_LIMIT) => {
        const currentMemory = this.getMemoryUsage();
        const growth = currentMemory.used - initialMemory.used;
        return {
          growth,
          isLeaking: growth > threshold,
          current: currentMemory,
          initial: initialMemory
        };
      }
    };
  }
};

// Mock high-resolution timer for consistent performance tests
const mockPerformanceNow = vi.fn();
let mockTime = 0;

mockPerformanceNow.mockImplementation(() => {
  mockTime += 0.1; // Increment by 0.1ms each call for predictable timing
  return mockTime;
});

Object.defineProperty(global, 'performance', {
  value: {
    now: mockPerformanceNow,
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: vi.fn(() => []),
    getEntriesByName: vi.fn(() => [])
  }
});

// Setup performance monitoring
beforeEach(() => {
  mockTime = 0;
  vi.clearAllMocks();
});

afterEach(() => {
  // Force garbage collection if available (for memory tests)
  if (global.gc) {
    global.gc();
  }
});

// Make performance utilities available globally for tests
global.performanceUtils = performanceUtils;