/**
 * Job Queue Types
 *
 * Abstract interface for job queue implementations.
 * Supports both in-memory (self-hosted) and BullMQ (Redis) backends.
 */

/**
 * Job data for metadata sync operations
 */
export interface SyncJobData {
  jobId: string
  accountId: string
}

/**
 * Job data for deletion operations
 */
export interface DeleteJobData {
  jobId: string
  accountId: string
  messageIds?: string[]
  query?: string
}

/**
 * Union of all job data types
 */
export type JobData = SyncJobData | DeleteJobData

/**
 * Job types supported by the queue
 */
export type QueueJobType = 'metadata_sync' | 'delete' | 'trash'

/**
 * Options for adding a job to the queue
 */
export interface AddJobOptions {
  /** Delay before job starts (in milliseconds) */
  delay?: number
  /** Job priority (lower = higher priority) */
  priority?: number
  /** Number of retry attempts on failure */
  attempts?: number
  /** Backoff configuration for retries */
  backoff?: {
    type: 'exponential' | 'fixed'
    delay: number
  }
}

/**
 * Job handler function signature
 */
export type JobHandler<T extends JobData = JobData> = (data: T) => Promise<void>

/**
 * Queue status information
 */
export interface QueueStatus {
  /** Queue implementation type */
  type: 'memory' | 'bullmq'
  /** Number of waiting jobs */
  waiting: number
  /** Number of active jobs */
  active: number
  /** Number of completed jobs */
  completed: number
  /** Number of failed jobs */
  failed: number
}

/**
 * Queue interface
 *
 * Abstract interface that both in-memory and BullMQ implementations conform to.
 */
export interface Queue {
  /**
   * Add a job to the queue
   * @param type - The job type
   * @param data - Job data payload
   * @param options - Optional job configuration
   * @returns The job ID
   */
  add(type: QueueJobType, data: JobData, options?: AddJobOptions): Promise<string>

  /**
   * Register a handler for a job type
   * @param type - The job type to handle
   * @param handler - The handler function
   */
  process(type: QueueJobType, handler: JobHandler): void

  /**
   * Get queue status
   */
  getStatus(): Promise<QueueStatus>

  /**
   * Pause the queue (stop processing new jobs)
   */
  pause(): Promise<void>

  /**
   * Resume the queue
   */
  resume(): Promise<void>

  /**
   * Close the queue and clean up resources
   */
  close(): Promise<void>

  /**
   * Remove a job from the queue
   * @param jobId - The job ID to remove
   */
  remove(jobId: string): Promise<boolean>
}

/**
 * Queue events that can be subscribed to
 */
export interface QueueEvents {
  /** Emitted when a job completes successfully */
  completed: (jobId: string, result: unknown) => void
  /** Emitted when a job fails */
  failed: (jobId: string, error: Error) => void
  /** Emitted when a job starts processing */
  active: (jobId: string) => void
  /** Emitted when a job is added */
  added: (jobId: string) => void
}
