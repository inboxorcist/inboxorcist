import { isDevelopment } from './startup'

/**
 * Simple logger with environment-aware log levels.
 *
 * Log levels:
 * - debug: Only shown in development (verbose/debugging info)
 * - info: Always shown (essential production info)
 * - warn: Always shown
 * - error: Always shown
 */

export const logger = {
  /** Debug logs - only shown in development */
  debug: (...args: unknown[]) => {
    if (isDevelopment()) console.log(...args)
  },

  /** Info logs - always shown (essential production info) */
  info: (...args: unknown[]) => {
    console.log(...args)
  },

  /** Warning logs - always shown */
  warn: (...args: unknown[]) => {
    console.warn(...args)
  },

  /** Error logs - always shown */
  error: (...args: unknown[]) => {
    console.error(...args)
  },
}
