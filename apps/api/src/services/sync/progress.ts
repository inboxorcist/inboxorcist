/**
 * Sync Progress Calculator
 *
 * Calculates progress, ETA, and phase messages for sync jobs.
 */

import type { Job } from '../../db'

/**
 * Progress information for a sync job
 */
export interface SyncProgress {
  /** Job status */
  status: Job['status']
  /** Number of messages processed */
  processed: number
  /** Total messages to process */
  total: number
  /** Progress percentage (0-100) */
  percentage: number
  /** Estimated time remaining (human readable) */
  eta: string | null
  /** Detailed status message */
  message: string
  /** Current sync rate (messages per second) */
  rate: number | null
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 0) return 'calculating...'

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  return `${seconds}s`
}

/**
 * Get detailed status message
 */
function getStatusMessage(
  status: Job['status'],
  processed: number,
  total: number,
  error?: string | null
): string {
  switch (status) {
    case 'pending':
      return 'Waiting to start...'
    case 'running':
      return `Processing ${processed.toLocaleString()} of ${total.toLocaleString()} emails`
    case 'completed':
      return `Successfully synced ${total.toLocaleString()} emails`
    case 'failed':
      return error || 'Sync failed'
    case 'cancelled':
      return 'Sync was cancelled'
    case 'paused':
      return `Paused at ${processed.toLocaleString()} of ${total.toLocaleString()} emails`
    default:
      return 'Unknown status'
  }
}

/**
 * Calculate sync progress from a job record
 */
export function calculateProgress(job: Job): SyncProgress {
  const processed = job.processedMessages || 0
  const total = job.totalMessages || 1 // Avoid division by zero
  const percentage = Math.min(100, Math.round((processed / total) * 100))

  // Calculate ETA and rate
  let eta: string | null = null
  let rate: number | null = null

  if (job.status === 'running' && processed > 0) {
    // Use resumedAt and processedAtResume if job was resumed, otherwise use startedAt
    const wasResumed = job.resumedAt && (job.processedAtResume ?? 0) > 0

    let referenceTime: number
    let baselineProcessed: number

    if (wasResumed) {
      // Job was resumed - calculate rate based on messages processed since resume
      referenceTime =
        typeof job.resumedAt === 'string'
          ? new Date(job.resumedAt).getTime()
          : job.resumedAt!.getTime()
      baselineProcessed = job.processedAtResume ?? 0
    } else if (job.startedAt) {
      // Fresh job - calculate rate from the beginning
      referenceTime =
        typeof job.startedAt === 'string'
          ? new Date(job.startedAt).getTime()
          : job.startedAt.getTime()
      baselineProcessed = 0
    } else {
      referenceTime = Date.now()
      baselineProcessed = 0
    }

    const elapsed = Date.now() - referenceTime
    const processedSinceReference = processed - baselineProcessed

    if (elapsed > 0 && processedSinceReference > 0) {
      const ratePerMs = processedSinceReference / elapsed // messages per ms
      rate = Math.round(ratePerMs * 1000) // messages per second
      const remaining = total - processed

      if (ratePerMs > 0) {
        const estimatedRemaining = remaining / ratePerMs
        eta = formatDuration(estimatedRemaining)
      }
    }
  }

  return {
    status: job.status,
    processed,
    total,
    percentage,
    eta,
    message: getStatusMessage(job.status, processed, total, job.lastError),
    rate,
  }
}

/**
 * Calculate progress for display (simplified version)
 */
export function getProgressDisplay(job: Job): {
  percentage: number
  message: string
  eta: string | null
} {
  const progress = calculateProgress(job)

  return {
    percentage: progress.percentage,
    message: progress.message,
    eta: progress.eta,
  }
}
