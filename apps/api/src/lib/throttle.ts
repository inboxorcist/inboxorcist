/**
 * Latency-aware adaptive rate limiting for Gmail API
 *
 * Problem: Gmail API has a 250 quota units/second limit (50 msg/sec for messages.get).
 * With 20 concurrent requests and varying Google response latency:
 * - If latency is 400ms: 20/0.4 = 50 msg/sec (at limit)
 * - If latency is 300ms: 20/0.3 = 67 msg/sec (over limit!)
 *
 * Solution: Track response latency and dynamically adjust delay to maintain
 * a target rate of 45-48 msg/sec, leaving buffer under the 50 msg/sec hard limit.
 *
 * Algorithm:
 * - Target rate: 47 msg/sec (leaves ~6% buffer)
 * - With CONCURRENCY requests and observed latency L:
 *   - Current rate = CONCURRENCY * 1000 / (L + delay)
 *   - To achieve target: delay = (CONCURRENCY * 1000 / target) - L
 * - Uses exponential moving average for latency smoothing
 * - Backs off hard on rate limit errors (429)
 */

export interface ThrottleOptions {
  /** Minimum delay between batches (ms) */
  minDelay?: number
  /** Initial delay before latency data is available (ms) */
  initialDelay?: number
  /** Maximum delay (ms) */
  maxDelay?: number
  /** Number of concurrent requests per batch */
  concurrency?: number
  /** Target messages per second (should be below 50) */
  targetRate?: number
  /** Minimum target rate when backing off */
  minTargetRate?: number
  /** Smoothing factor for EMA (0-1, higher = more weight to recent) */
  latencySmoothing?: number
}

export class AdaptiveThrottle {
  private minDelay: number
  private initialDelay: number
  private maxDelay: number
  private concurrency: number
  private targetRate: number
  private minTargetRate: number
  private latencySmoothing: number

  // State
  private currentDelay: number
  private avgLatency: number | null = null
  private backoffUntil = 0
  private rateLimitCount = 0
  private lastRateLimitTime = 0

  // Stats for debugging
  private batchCount = 0
  private totalMessages = 0

  constructor(options: ThrottleOptions = {}) {
    this.minDelay = options.minDelay ?? 0
    this.initialDelay = options.initialDelay ?? 100
    this.maxDelay = options.maxDelay ?? 60000
    this.concurrency = options.concurrency ?? 20
    this.targetRate = options.targetRate ?? 47 // Target 47 msg/sec (buffer under 50)
    this.minTargetRate = options.minTargetRate ?? 30 // Don't go below 30 msg/sec
    this.latencySmoothing = options.latencySmoothing ?? 0.3

    this.currentDelay = this.initialDelay
  }

  /**
   * Wait before making the next request batch
   */
  async wait(): Promise<void> {
    const now = Date.now()

    if (this.backoffUntil > now) {
      // We're in backoff period from a rate limit
      const waitTime = this.backoffUntil - now
      await this.sleep(waitTime)
      return
    }

    if (this.currentDelay > 0) {
      await this.sleep(this.currentDelay)
    }
  }

  /**
   * Record a completed batch with latency information
   *
   * This is the key method that adjusts throttling based on actual performance.
   *
   * @param latencyMs - Time taken for the batch request to complete
   * @param successCount - Number of successful messages in the batch
   */
  onBatchComplete(latencyMs: number, successCount: number): void {
    this.batchCount++
    this.totalMessages += successCount

    // Update exponential moving average of latency
    if (this.avgLatency === null) {
      this.avgLatency = latencyMs
    } else {
      this.avgLatency =
        this.latencySmoothing * latencyMs + (1 - this.latencySmoothing) * this.avgLatency
    }

    // Calculate required delay to achieve target rate
    // Formula: targetRate = concurrency * 1000 / (latency + delay)
    // Solving for delay: delay = (concurrency * 1000 / targetRate) - latency
    const targetCycleTime = (this.concurrency * 1000) / this.getEffectiveTargetRate()
    const requiredDelay = targetCycleTime - this.avgLatency

    // Apply delay with bounds
    this.currentDelay = Math.max(this.minDelay, Math.min(this.maxDelay, Math.round(requiredDelay)))

    // Gradually recover target rate after rate limit events
    this.recoverTargetRate()
  }

  /**
   * Record a successful individual request (for backwards compatibility)
   * Prefer using onBatchComplete for better accuracy
   */
  onSuccess(): void {
    // No-op for backwards compatibility - real logic is in onBatchComplete
  }

  /**
   * Record a rate limit error (429)
   * @param retryAfter - Optional retry-after value in milliseconds
   */
  onRateLimit(retryAfter?: number): void {
    this.rateLimitCount++
    this.lastRateLimitTime = Date.now()

    // Set backoff period
    const backoffDuration = retryAfter ?? 60000
    this.backoffUntil = Date.now() + backoffDuration

    // Reduce target rate on repeated rate limits
    // Each rate limit reduces target by 5 msg/sec, down to minTargetRate
    const reductionPerRateLimit = 5
    const newTarget = this.targetRate - reductionPerRateLimit * this.rateLimitCount
    this.targetRate = Math.max(this.minTargetRate, newTarget)

    // Also increase current delay significantly
    this.currentDelay = Math.min(this.maxDelay, this.currentDelay * 2 + 100)
  }

  /**
   * Record a general error (non-rate-limit)
   */
  onError(): void {
    // Slight increase on errors
    this.currentDelay = Math.min(this.maxDelay, Math.round(this.currentDelay * 1.2))
  }

  /**
   * Reset throttle to initial state
   */
  reset(): void {
    this.currentDelay = this.initialDelay
    this.avgLatency = null
    this.backoffUntil = 0
    this.rateLimitCount = 0
    this.lastRateLimitTime = 0
    this.targetRate = 47
    this.batchCount = 0
    this.totalMessages = 0
  }

  /**
   * Get current delay value (for debugging/logging)
   */
  getCurrentDelay(): number {
    return this.currentDelay
  }

  /**
   * Get average latency (for debugging/logging)
   */
  getAvgLatency(): number | null {
    return this.avgLatency
  }

  /**
   * Get current target rate (for debugging/logging)
   */
  getTargetRate(): number {
    return this.getEffectiveTargetRate()
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

  /**
   * Get statistics for debugging
   */
  getStats(): {
    batchCount: number
    totalMessages: number
    avgLatency: number | null
    currentDelay: number
    targetRate: number
    rateLimitCount: number
  } {
    return {
      batchCount: this.batchCount,
      totalMessages: this.totalMessages,
      avgLatency: this.avgLatency,
      currentDelay: this.currentDelay,
      targetRate: this.getEffectiveTargetRate(),
      rateLimitCount: this.rateLimitCount,
    }
  }

  /**
   * Get effective target rate (may be reduced after rate limits)
   */
  private getEffectiveTargetRate(): number {
    return this.targetRate
  }

  /**
   * Gradually recover target rate after rate limit events
   * Increases by 1 msg/sec every 30 seconds without rate limits
   */
  private recoverTargetRate(): void {
    if (this.rateLimitCount === 0) return

    const timeSinceRateLimit = Date.now() - this.lastRateLimitTime
    const recoveryPeriod = 30000 // 30 seconds
    const maxTargetRate = 47 // Default target

    if (timeSinceRateLimit > recoveryPeriod) {
      // Recover 1 msg/sec for each recovery period elapsed
      const periodsElapsed = Math.floor(timeSinceRateLimit / recoveryPeriod)
      this.targetRate = Math.min(maxTargetRate, this.targetRate + periodsElapsed)

      if (this.targetRate >= maxTargetRate) {
        this.rateLimitCount = 0 // Fully recovered
      }
    }
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
 * - Max 50 requests/second theoretical
 *
 * This throttle uses latency-aware rate limiting:
 * - Tracks response latency from Google
 * - Dynamically adjusts delay to maintain ~47 msg/sec
 * - Backs off aggressively on rate limit errors
 * - Gradually recovers after successful periods
 */
export function createGmailThrottle(): AdaptiveThrottle {
  return new AdaptiveThrottle({
    minDelay: 0, // Allow zero delay when latency is high enough
    initialDelay: 100, // Conservative start until we have latency data
    maxDelay: 60000, // Max 60 second delay when rate limited
    concurrency: 20, // Matches CONCURRENCY in fetchMessageDetails
    targetRate: 47, // Target 47 msg/sec (6% buffer under 50 limit)
    minTargetRate: 30, // Don't go below 30 msg/sec even after rate limits
    latencySmoothing: 0.3, // EMA smoothing factor
  })
}
