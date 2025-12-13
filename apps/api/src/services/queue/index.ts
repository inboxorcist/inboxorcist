/**
 * Job Queue Factory
 *
 * Automatically selects the appropriate queue implementation:
 * - BullMQ when REDIS_URL is set (production)
 * - In-memory when no Redis (self-hosted, development)
 */

import { createMemoryQueue, MemoryQueue } from "./memory";
import { createBullMQQueue, BullMQQueue } from "./bullmq";
import type { Queue, QueueJobType, JobData, JobHandler, AddJobOptions } from "./types";

// Re-export types
export * from "./types";

// Singleton queue instance
let queueInstance: Queue | null = null;

/**
 * Get the queue type that will be used
 */
export function getQueueType(): "bullmq" | "memory" {
  return process.env.REDIS_URL ? "bullmq" : "memory";
}

/**
 * Get or create the queue instance
 */
export function getQueue(): Queue {
  if (queueInstance) {
    return queueInstance;
  }

  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    console.log("[Queue] Using BullMQ with Redis");
    queueInstance = createBullMQQueue(redisUrl);
  } else {
    console.log("[Queue] Using in-memory queue (no Redis configured)");
    queueInstance = createMemoryQueue({ maxConcurrency: 3 });
  }

  return queueInstance;
}

/**
 * Initialize the queue and start processing
 */
export function initializeQueue(): Queue {
  const queue = getQueue();

  // Start the memory queue processor if applicable
  if (queue instanceof MemoryQueue) {
    queue.start();
  }

  return queue;
}

/**
 * Close the queue and clean up resources
 */
export async function closeQueue(): Promise<void> {
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
    console.log("[Queue] Queue closed and cleaned up");
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
  const queue = getQueue();
  return queue.add(type, data, options);
}

/**
 * Register a job handler (convenience function)
 */
export function registerHandler(type: QueueJobType, handler: JobHandler): void {
  const queue = getQueue();
  queue.process(type, handler);
}

/**
 * Get queue status (convenience function)
 */
export async function getQueueStatus() {
  const queue = getQueue();
  return queue.getStatus();
}

// Export queue classes for direct use if needed
export { MemoryQueue, BullMQQueue };
