/**
 * Job Queue
 *
 * In-memory job queue for background processing.
 * Handles email sync and deletion jobs with retry support.
 */

import { createMemoryQueue, MemoryQueue } from './memory'
import type { Queue, QueueJobType, JobData, JobHandler, AddJobOptions } from './types'
import { logger } from '../../lib/logger'

// Re-export types
export * from './types'

// Queue type for display purposes
export const queueType = 'in-memory'

// Singleton queue instance
let queueInstance: Queue | null = null

/**
 * Get or create the queue instance
 */
export function getQueue(): Queue {
  if (queueInstance) {
    return queueInstance
  }

  logger.debug('[Queue] Using in-memory queue')
  queueInstance = createMemoryQueue({ maxConcurrency: 3 })

  return queueInstance
}

/**
 * Initialize the queue and start processing
 */
export function initializeQueue(): Queue {
  const queue = getQueue()

  // Start the memory queue processor
  if (queue instanceof MemoryQueue) {
    queue.start()
  }

  return queue
}

/**
 * Close the queue and clean up resources
 */
export async function closeQueue(): Promise<void> {
  if (queueInstance) {
    await queueInstance.close()
    queueInstance = null
    logger.debug('[Queue] Queue closed and cleaned up')
  }
}

/**
 * Add a job to the queue (convenience function)
 */
export async function addJob(
  type: QueueJobType,
  data: JobData,
  options?: AddJobOptions
): Promise<string> {
  const queue = getQueue()
  return queue.add(type, data, options)
}

/**
 * Register a job handler (convenience function)
 */
export function registerHandler(type: QueueJobType, handler: JobHandler): void {
  const queue = getQueue()
  queue.process(type, handler)
}

/**
 * Get queue status (convenience function)
 */
export async function getQueueStatus() {
  const queue = getQueue()
  return queue.getStatus()
}

// Export queue class for direct use if needed
export { MemoryQueue }
