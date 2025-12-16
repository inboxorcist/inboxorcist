/**
 * Simple logger that suppresses debug/info logs in production mode.
 * Only errors and warnings are always shown.
 *
 * Production mode is detected by:
 * 1. Running as a compiled binary (import.meta.dir starts with /$bunfs/)
 * 2. NODE_ENV === 'production'
 */

// Detect compiled binary - this is the reliable way to detect production for binaries
const isCompiledBinary = import.meta.dir.startsWith('/$bunfs/')

// Check if we're in production mode
const isProduction = () => isCompiledBinary || process.env.NODE_ENV === 'production'

export const logger = {
  /** Debug logs - only shown in development */
  debug: (...args: unknown[]) => {
    if (!isProduction()) console.log(...args)
  },

  /** Info logs - only shown in development */
  info: (...args: unknown[]) => {
    if (!isProduction()) console.log(...args)
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
