/**
 * Comprehensive logging system for Momentum application
 */

import { isDev, isProd } from './env';
import { recordDiagnosticError } from './diagnostics';

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

function isObjectLike(value: unknown): value is object {
  return value !== null && typeof value === 'object';
}

function safeStringify(value: unknown, space?: number): string {
  const seen = new WeakSet<object>();
  const replacer = (_key: string, val: unknown): unknown => {
    if (typeof val === 'bigint') {
      return val.toString();
    }
    if (typeof val === 'function') {
      const nameSuffix = val.name ? `: ${val.name}` : '';
      return `[Function${nameSuffix}]`;
    }
    if (typeof val === 'symbol') {
      return val.toString();
    }
    if (val instanceof Error) {
      return { name: val.name, message: val.message, stack: val.stack };
    }
    if (typeof HTMLElement !== 'undefined' && val instanceof HTMLElement) {
      return { tagName: val.tagName, id: val.id, className: val.className };
    }
    if (isObjectLike(val)) {
      if (seen.has(val)) {
        return '[Circular]';
      }
      seen.add(val);
    }
    return val;
  };

  try {
    return JSON.stringify(value, replacer, space);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `[Unserializable: ${message}]`;
  }
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

class Logger {
  private logLevel: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private isProduction = isProd;

  setLogLevel(level: LogLevel) {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private shouldLogToConsole(level: LogLevel): boolean {
    // In production, only log to console for errors and warnings
    // This reduces console noise in production while preserving important information
    if (this.isProduction) {
      return level >= LogLevel.WARN;
    }
    return this.shouldLog(level);
  }

  private createLogEntry(
    level: LogLevel,
    category: string,
    message: string,
    context?: Record<string, unknown>,
    error?: Error,
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      context,
      error,
    };
  }

  private addLog(entry: LogEntry) {
    if (this.isProduction && entry.level >= LogLevel.WARN) {
      recordDiagnosticError(
        entry.category,
        entry.error ?? entry.message,
        entry.level === LogLevel.ERROR ? 'error' : 'warning',
      );
    }
    this.logs.push(entry);

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Only output to console based on production settings
    if (!this.shouldLogToConsole(entry.level)) {
      return;
    }

    // Console output with appropriate method
    const contextStr = entry.context
      ? ` | Context: ${safeStringify(entry.context)}`
      : '';
    const errorStr = entry.error ? ` | Error: ${entry.error.message}` : '';
    const fullMessage = `[${entry.category}] ${entry.message}${contextStr}${errorStr}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(fullMessage);
        break;
      case LogLevel.INFO:
        console.info(fullMessage);
        break;
      case LogLevel.WARN:
        console.warn(fullMessage);
        break;
      case LogLevel.ERROR:
        console.error(fullMessage);
        break;
    }
  }

  debug(category: string, message: string, context?: Record<string, unknown>) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.addLog(
        this.createLogEntry(LogLevel.DEBUG, category, message, context),
      );
    }
  }

  info(category: string, message: string, context?: Record<string, unknown>) {
    if (this.shouldLog(LogLevel.INFO)) {
      this.addLog(
        this.createLogEntry(LogLevel.INFO, category, message, context),
      );
    }
  }

  warn(
    category: string,
    message: string,
    context?: Record<string, unknown>,
    error?: Error,
  ) {
    if (this.shouldLog(LogLevel.WARN)) {
      this.addLog(
        this.createLogEntry(LogLevel.WARN, category, message, context, error),
      );
    }
  }

  error(
    category: string,
    message: string,
    context?: Record<string, unknown>,
    error?: Error,
  ) {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.addLog(
        this.createLogEntry(LogLevel.ERROR, category, message, context, error),
      );
    }
  }

  // Specialized logging methods for common operations
  dbOperation(
    operation: string,
    success: boolean,
    context?: Record<string, unknown>,
    error?: Error,
  ) {
    const message = `Database operation ${operation} ${success ? 'success' : 'failed'}`;
    if (success) {
      this.info('DATABASE', message, context);
    } else {
      this.error('DATABASE', message, context, error);
    }
  }

  chainOperation(
    operation: string,
    chainId: string,
    success: boolean,
    context?: Record<string, unknown>,
    error?: Error,
  ) {
    const message = `Chain operation ${operation} (${chainId}) ${success ? 'success' : 'failed'}`;
    if (success) {
      this.info('CHAIN', message, context);
    } else {
      this.error('CHAIN', message, context, error);
    }
  }

  userAction(action: string, context?: Record<string, unknown>) {
    this.info('USER', `User action: ${action}`, context);
  }

  performance(
    operation: string,
    duration: number,
    context?: Record<string, unknown>,
  ) {
    this.debug('PERFORMANCE', `${operation} took ${duration}ms`, context);
  }

  // Get logs for debugging
  getLogs(level?: LogLevel, category?: string, limit?: number): LogEntry[] {
    let filteredLogs = this.logs;

    if (level !== undefined) {
      filteredLogs = filteredLogs.filter((log) => log.level >= level);
    }

    if (category) {
      filteredLogs = filteredLogs.filter((log) => log.category === category);
    }

    if (limit) {
      filteredLogs = filteredLogs.slice(-limit);
    }

    return filteredLogs;
  }

  // Export logs for debugging
  exportLogs(): string {
    return safeStringify(this.logs, 2);
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
    this.info('SYSTEM', 'Logs cleared');
  }
}

// Create singleton instance
export const logger = new Logger();

// Set log level based on environment
if (isDev) {
  logger.setLogLevel(LogLevel.DEBUG);
} else if (isProd) {
  // In production, only log warnings and errors to reduce noise
  logger.setLogLevel(LogLevel.WARN);
} else {
  // Default for other environments (staging, test, etc.)
  logger.setLogLevel(LogLevel.INFO);
}

// Performance measurement utility
