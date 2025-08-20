/**
 * Comprehensive logging system for Momentum application
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  context?: Record<string, any>;
  error?: Error;
}

class Logger {
  private logLevel: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private isProduction = process.env.NODE_ENV === 'production';

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
    context?: Record<string, any>,
    error?: Error
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
    const contextStr = entry.context ? ` | Context: ${JSON.stringify(entry.context)}` : '';
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

  debug(category: string, message: string, context?: Record<string, any>) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.addLog(this.createLogEntry(LogLevel.DEBUG, category, message, context));
    }
  }

  info(category: string, message: string, context?: Record<string, any>) {
    if (this.shouldLog(LogLevel.INFO)) {
      this.addLog(this.createLogEntry(LogLevel.INFO, category, message, context));
    }
  }

  warn(category: string, message: string, context?: Record<string, any>, error?: Error) {
    if (this.shouldLog(LogLevel.WARN)) {
      this.addLog(this.createLogEntry(LogLevel.WARN, category, message, context, error));
    }
  }

  error(category: string, message: string, context?: Record<string, any>, error?: Error) {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.addLog(this.createLogEntry(LogLevel.ERROR, category, message, context, error));
    }
  }

  // Specialized logging methods for common operations
  dbOperation(operation: string, success: boolean, context?: Record<string, any>, error?: Error) {
    const message = `Database operation ${operation} ${success ? 'success' : 'failed'}`;
    if (success) {
      this.info('DATABASE', message, context);
    } else {
      this.error('DATABASE', message, context, error);
    }
  }

  chainOperation(operation: string, chainId: string, success: boolean, context?: Record<string, any>, error?: Error) {
    const message = `Chain operation ${operation} (${chainId}) ${success ? 'success' : 'failed'}`;
    if (success) {
      this.info('CHAIN', message, context);
    } else {
      this.error('CHAIN', message, context, error);
    }
  }

  userAction(action: string, context?: Record<string, any>) {
    this.info('USER', `User action: ${action}`, context);
  }

  performance(operation: string, duration: number, context?: Record<string, any>) {
    this.debug('PERFORMANCE', `${operation} took ${duration}ms`, context);
  }

  // Get logs for debugging
  getLogs(level?: LogLevel, category?: string, limit?: number): LogEntry[] {
    let filteredLogs = this.logs;

    if (level !== undefined) {
      filteredLogs = filteredLogs.filter(log => log.level >= level);
    }

    if (category) {
      filteredLogs = filteredLogs.filter(log => log.category === category);
    }

    if (limit) {
      filteredLogs = filteredLogs.slice(-limit);
    }

    return filteredLogs;
  }

  // Export logs for debugging
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
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
if (process.env.NODE_ENV === 'development') {
  logger.setLogLevel(LogLevel.DEBUG);
} else if (process.env.NODE_ENV === 'production') {
  // In production, only log warnings and errors to reduce noise
  logger.setLogLevel(LogLevel.WARN);
} else {
  // Default for other environments (staging, test, etc.)
  logger.setLogLevel(LogLevel.INFO);
}

// Performance measurement utility
export const measurePerformance = async <T>(
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    logger.performance(operation, duration, context);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.error('PERFORMANCE', `${operation} failed`, { ...context, duration }, error as Error);
    throw error;
  }
};