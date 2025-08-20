/**
 * Performance-aware logger utility that eliminates console logging in production
 * while providing detailed debugging information in development.
 */

// Development mode flag for performance checks
const isDev = process.env.NODE_ENV === 'development';

/**
 * Performance logger that only logs in development mode
 */
export const performanceLogger = {
  /**
   * Log general information (only in development)
   */
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Log warnings (only in development)
   */
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },

  /**
   * Log errors (always logged for critical issues)
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Log performance-related information with timing
   */
  perf: (label: string, fn: () => void) => {
    if (isDev) {
      const start = performance.now();
      fn();
      const end = performance.now();
      console.log(`[PERF] ${label}: ${(end - start).toFixed(2)}ms`);
    } else {
      fn();
    }
  },

  /**
   * Time a function execution and log the result (development only)
   */
  time: <T>(label: string, fn: () => T): T => {
    if (isDev) {
      console.time(label);
      const result = fn();
      console.timeEnd(label);
      return result;
    } else {
      return fn();
    }
  },

  /**
   * Group related logs together (development only)
   */
  group: (label: string, fn: () => void) => {
    if (isDev) {
      console.group(label);
      fn();
      console.groupEnd();
    } else {
      fn();
    }
  },

  /**
   * Debug-level logging for detailed troubleshooting (development only)
   */
  debug: (...args: any[]) => {
    if (isDev) {
      console.debug(...args);
    }
  },

  /**
   * Trace function calls and performance (development only)
   */
  trace: (label: string, ...args: any[]) => {
    if (isDev) {
      console.trace(label, ...args);
    }
  },
};