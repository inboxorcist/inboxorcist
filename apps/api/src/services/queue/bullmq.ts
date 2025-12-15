/**
 * BullMQ Job Queue
 *
 * Redis-backed queue for production deployments.
 * Provides persistence, scalability, and advanced features.
 *
 * Only used when REDIS_URL environment variable is set.
 */

import type {
  Queue as QueueInterface,
  QueueJobType,
  JobData,
  JobHandler,
  AddJobOptions,
  QueueStatus,
} from './types'

// Dynamic imports to avoid loading BullMQ when not needed
import type { Job as BullMQJob } from 'bullmq'
let Queue: typeof import('bullmq').Queue
let Worker: typeof import('bullmq').Worker

/**
 * BullMQ queue implementation
 */
export class BullMQQueue implements QueueInterface {
  private queue: InstanceType<typeof Queue> | null = null
  private workers = new Map<QueueJobType, InstanceType<typeof Worker>>()
  private redisUrl: string
  private queueName: string

  constructor(redisUrl: string, queueName = 'inboxorcist') {
    this.redisUrl = redisUrl
    this.queueName = queueName
  }

  /**
   * Initialize the queue (lazy initialization)
   */
  private async ensureInitialized(): Promise<InstanceType<typeof Queue>> {
    if (this.queue) return this.queue

    // Dynamic import of BullMQ
    const bullmq = await import('bullmq')
    Queue = bullmq.Queue
    Worker = bullmq.Worker

    const connection = this.parseRedisUrl(this.redisUrl)

    this.queue = new Queue(this.queueName, { connection })
    console.log(`[BullMQ] Queue "${this.queueName}" initialized`)

    return this.queue
  }

  /**
   * Parse Redis URL into connection options
   */
  private parseRedisUrl(url: string): { host: string; port: number; password?: string } {
    try {
      const parsed = new URL(url)
      return {
        host: parsed.hostname,
        port: parseInt(parsed.port || '6379', 10),
        password: parsed.password || undefined,
      }
    } catch {
      // Fallback for simple host:port format
      const [host, port] = url.split(':')
      return {
        host: host || 'localhost',
        port: parseInt(port || '6379', 10),
      }
    }
  }

  /**
   * Add a job to the queue
   */
  async add(type: QueueJobType, data: JobData, options: AddJobOptions = {}): Promise<string> {
    const queue = await this.ensureInitialized()

    const job = await queue.add(type, data, {
      delay: options.delay,
      priority: options.priority,
      attempts: options.attempts || 3,
      backoff: options.backoff
        ? {
            type: options.backoff.type,
            delay: options.backoff.delay,
          }
        : {
            type: 'exponential',
            delay: 1000,
          },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 1000, // Keep at most 1000 completed jobs
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    })

    console.log(`[BullMQ] Added job ${job.id} of type ${type}`)
    return job.id!
  }

  /**
   * Register a handler for a job type
   */
  process(type: QueueJobType, handler: JobHandler): void {
    // Use setImmediate to allow async initialization
    setImmediate(async () => {
      await this.ensureInitialized()

      const connection = this.parseRedisUrl(this.redisUrl)

      const worker = new Worker(
        this.queueName,
        async (job: BullMQJob) => {
          if (job.name === type) {
            console.log(`[BullMQ] Processing job ${job.id} (${type})`)
            await handler(job.data as JobData)
            console.log(`[BullMQ] Job ${job.id} completed`)
          }
        },
        {
          connection,
          concurrency: 3, // Process up to 3 jobs concurrently
        }
      )

      worker.on('failed', (job: BullMQJob | undefined, error: Error) => {
        if (job?.name === type) {
          console.error(`[BullMQ] Job ${job.id} failed:`, error.message)
        }
      })

      worker.on('error', (error: Error) => {
        console.error(`[BullMQ] Worker error:`, error.message)
      })

      this.workers.set(type, worker)
      console.log(`[BullMQ] Registered handler for ${type}`)
    })
  }

  /**
   * Get queue status
   */
  async getStatus(): Promise<QueueStatus> {
    const queue = await this.ensureInitialized()

    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ])

    return {
      type: 'bullmq',
      waiting,
      active,
      completed,
      failed,
    }
  }

  /**
   * Pause job processing
   */
  async pause(): Promise<void> {
    const queue = await this.ensureInitialized()
    await queue.pause()
    console.log('[BullMQ] Queue paused')
  }

  /**
   * Resume job processing
   */
  async resume(): Promise<void> {
    const queue = await this.ensureInitialized()
    await queue.resume()
    console.log('[BullMQ] Queue resumed')
  }

  /**
   * Close the queue and workers
   */
  async close(): Promise<void> {
    // Close all workers
    for (const [type, worker] of this.workers) {
      await worker.close()
      console.log(`[BullMQ] Worker for ${type} closed`)
    }
    this.workers.clear()

    // Close queue
    if (this.queue) {
      await this.queue.close()
      this.queue = null
      console.log('[BullMQ] Queue closed')
    }
  }

  /**
   * Remove a job from the queue
   */
  async remove(jobId: string): Promise<boolean> {
    const queue = await this.ensureInitialized()

    const job = await queue.getJob(jobId)
    if (!job) return false

    const state = await job.getState()
    if (state === 'active') {
      console.warn(`[BullMQ] Cannot remove active job ${jobId}`)
      return false
    }

    await job.remove()
    console.log(`[BullMQ] Removed job ${jobId}`)
    return true
  }
}

/**
 * Create a BullMQ queue instance
 */
export function createBullMQQueue(redisUrl: string, queueName?: string): BullMQQueue {
  return new BullMQQueue(redisUrl, queueName)
}
