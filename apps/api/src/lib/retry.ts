/**
 * Retry utility with exponential backoff and jitter
 */

export interface RetryOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  onRetry?: (error: Error, attempt: number, delay: number) => void
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const err = error as { code?: number | string; status?: number; message?: string }

  // Rate limit - always retry
  if (err.code === 429 || err.status === 429) {
    return true
  }

  // Server errors (5xx) - retry
  if (typeof err.status === 'number' && err.status >= 500) {
    return true
  }
  if (typeof err.code === 'number' && err.code >= 500) {
    return true
  }

  // Network errors - retry
  const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN']
  if (typeof err.code === 'string' && networkErrors.includes(err.code)) {
    return true
  }

  // Google API specific - check message
  if (err.message?.includes('ECONNRESET') || err.message?.includes('ETIMEDOUT')) {
    return true
  }

  // Auth errors - don't retry (user action needed)
  if (err.code === 401 || err.status === 401) {
    return false
  }

  // Permission errors - don't retry
  if (err.code === 403 || err.status === 403) {
    return false
  }

  // Bad request - don't retry
  if (err.code === 400 || err.status === 400) {
    return false
  }

  // Default: don't retry unknown errors
  return false
}

/**
 * Get retry-after value from error (in milliseconds)
 */
export function getRetryAfter(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null
  }

  const err = error as {
    response?: { headers?: { get?: (key: string) => string | null } }
    headers?: { 'retry-after'?: string }
  }

  // Check response headers
  const retryAfter = err.response?.headers?.get?.('retry-after') || err.headers?.['retry-after']

  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10)
    if (!isNaN(seconds)) {
      return seconds * 1000
    }
  }

  return null
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  retryAfter: number | null
): number {
  // If server specified retry-after, use it
  if (retryAfter !== null) {
    return Math.min(retryAfter, maxDelay)
  }

  // Exponential backoff: baseDelay * 2^attempt
  let delay = baseDelay * Math.pow(2, attempt)

  // Cap at maxDelay
  delay = Math.min(delay, maxDelay)

  // Add jitter (0.75x to 1.25x)
  const jitter = 0.75 + Math.random() * 0.5
  delay = Math.floor(delay * jitter)

  return delay
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Execute a function with retry logic
 *
 * @example
 * const result = await withRetry(
 *   () => gmail.users.messages.get({ userId: 'me', id: messageId }),
 *   { maxRetries: 3, baseDelay: 1000 }
 * );
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxRetries = 5, baseDelay = 1000, maxDelay = 60000, onRetry } = options

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry if it's the last attempt or error is not retryable
      if (attempt === maxRetries || !isRetryableError(error)) {
        throw lastError
      }

      // Calculate delay
      const retryAfter = getRetryAfter(error)
      const delay = calculateDelay(attempt, baseDelay, maxDelay, retryAfter)

      // Notify callback
      if (onRetry) {
        onRetry(lastError, attempt + 1, delay)
      }

      // Wait before retrying
      await sleep(delay)
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Retry failed')
}

/**
 * Create a retry wrapper with preset options
 */
export function createRetry(defaultOptions: RetryOptions) {
  return <T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> => {
    return withRetry(fn, { ...defaultOptions, ...options })
  }
}
