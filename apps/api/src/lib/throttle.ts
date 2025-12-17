/**
 * Adaptive rate limiting for Gmail API
 *
 * Adjusts delay based on success/failure patterns:
 * - Decreases delay after consecutive successes
 * - Increases delay and backs off on rate limits
 */

export interface ThrottleOptions {
  minDelay?: number
  initialDelay?: number
  maxDelay?: number
  successThreshold?: number
  delayReduction?: number
  delayIncrease?: number
}

export class AdaptiveThrottle {
  private minDelay: number
  private currentDelay: number
  private maxDelay: number
  private successThreshold: number
  private delayReduction: number
  private delayIncrease: number

  private successCount = 0
  private backoffUntil = 0

  constructor(options: ThrottleOptions = {}) {
    this.minDelay = options.minDelay ?? 50
    this.currentDelay = options.initialDelay ?? 100
    this.maxDelay = options.maxDelay ?? 5000
    this.successThreshold = options.successThreshold ?? 5
    this.delayReduction = options.delayReduction ?? 0.9
    this.delayIncrease = options.delayIncrease ?? 2
  }

  /**
   * Wait before making the next request
   */
  async wait(): Promise<void> {
    const now = Date.now()

    if (this.backoffUntil > now) {
      // We're in backoff period, wait until it's over
      const waitTime = this.backoffUntil - now
      await this.sleep(waitTime)
    } else if (this.currentDelay > 0) {
      // Normal delay between requests
      await this.sleep(this.currentDelay)
    }
  }

  /**
   * Record a successful request
   * After enough successes, reduce the delay
   */
  onSuccess(): void {
    this.successCount++

    if (this.successCount >= this.successThreshold) {
      // Reduce delay after streak of successes
      this.currentDelay = Math.max(
        this.minDelay,
        Math.floor(this.currentDelay * this.delayReduction)
      )
      this.successCount = 0
    }
  }

  /**
   * Record a rate limit error
   * @param retryAfter - Optional retry-after value in milliseconds
   */
  onRateLimit(retryAfter?: number): void {
    this.successCount = 0

    // Set backoff period
    const backoffDuration = retryAfter ?? 60000 // Default 60 seconds
    this.backoffUntil = Date.now() + backoffDuration

    // Increase base delay for future requests
    this.currentDelay = Math.min(this.maxDelay, Math.floor(this.currentDelay * this.delayIncrease))
  }

  /**
   * Record a general error (non-rate-limit)
   * Slightly increase delay to be cautious
   */
  onError(): void {
    this.successCount = 0
    // Slight increase on errors
    this.currentDelay = Math.min(this.maxDelay, Math.floor(this.currentDelay * 1.2))
  }

  /**
   * Reset throttle to initial state
   */
  reset(): void {
    this.successCount = 0
    this.backoffUntil = 0
    this.currentDelay = 100
  }

  /**
   * Get current delay value (for debugging/logging)
   */
  getCurrentDelay(): number {
    return this.currentDelay
  }

  /**
   * Check if we're currently in a backoff period
   */
  isInBackoff(): boolean {
    return this.backoffUntil > Date.now()
  }

  /**
   * Get time remaining in backoff period (ms)
   */
  getBackoffRemaining(): number {
    const remaining = this.backoffUntil - Date.now()
    return Math.max(0, remaining)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * Create a throttle instance for Gmail API
 *
 * Gmail API limits:
 * - 250 quota units/second per user (15K/min)
 * - messages.get = 5 units
 * - Max ~50 requests/second theoretical
 *
 * With CONCURRENCY=15 and initialDelay=150ms:
 * - 15 requests every 150ms = 100 requests/second = 500 units/second
 * - This is 2x the per-second limit but burst is allowed, stays under per-minute
 */
export function createGmailThrottle(): AdaptiveThrottle {
  return new AdaptiveThrottle({
    minDelay: 50, // Floor: ~44 msg/sec max with 20 concurrent
    initialDelay: 75, // Start: ~42 msg/sec with 20 concurrent
    maxDelay: 60000, // Max 60 second delay when rate limited
    successThreshold: 20, // Speed up after full batch (matches CONCURRENCY)
    delayReduction: 0.9, // Reduce by 10% on success streak
    delayIncrease: 2, // Double delay on rate limit
  })
}
