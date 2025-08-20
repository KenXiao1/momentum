/**
 * Console Migration Helper
 * 
 * This file provides development-time utilities to help migrate from direct console usage
 * to the proper logging system. In production, these functions will be no-ops to ensure
 * no performance impact.
 */

import { logger } from './logger';

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Development-only console wrapper that automatically routes to logger
 * In production, these become no-ops for performance
 */
export const devConsole = {
  log: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      logger.debug('DEV', message, args.length > 0 ? { args } : undefined);
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      logger.warn('DEV', message, args.length > 0 ? { args } : undefined);
    }
  },
  
  error: (message: string, ...args: any[]) => {
    logger.error('DEV', message, args.length > 0 ? { args } : undefined);
  },
  
  debug: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      logger.debug('DEV', message, args.length > 0 ? { args } : undefined);
    }
  }
};

/**
 * Conditional development logging function
 * Use this for temporary debug logs that should never reach production
 */
export const devLog = (message: string, context?: Record<string, any>) => {
  if (isDevelopment) {
    logger.debug('DEV-TEMP', message, context);
  }
};

/**
 * Performance-aware logging for hot paths
 * Only logs in development, and only if debug level is enabled
 */
export const perfLog = (operation: string, data?: any) => {
  if (isDevelopment && logger.getLogs().length === 0) { // Quick check to avoid overhead
    logger.debug('PERF', operation, data ? { data } : undefined);
  }
};