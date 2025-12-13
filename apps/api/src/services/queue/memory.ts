/**
 * In-Memory Job Queue
 *
 * Simple queue implementation for self-hosted deployments without Redis.
 * Jobs are lost on restart but can be resumed from database state.
 */

import { nanoid } from "../../lib/id";
import type {
  Queue,
  QueueJobType,
  JobData,
  JobHandler,
  AddJobOptions,
  QueueStatus,
} from "./types";

interface QueuedJob {
  id: string;
  type: QueueJobType;
  data: JobData;
  options: AddJobOptions;
  addedAt: number;
  scheduledFor: number;
  status: "waiting" | "active" | "completed" | "failed";
  error?: string;
}

/**
 * In-memory queue implementation
 */
export class MemoryQueue implements Queue {
  private jobs = new Map<string, QueuedJob>();
  private handlers = new Map<QueueJobType, JobHandler>();
  private processing = false;
  private paused = false;
  private maxConcurrency: number;
  private activeCount = 0;
  private processInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: { maxConcurrency?: number } = {}) {
    this.maxConcurrency = options.maxConcurrency ?? 3;
  }

  /**
   * Start the queue processor
   */
  start(): void {
    if (this.processInterval) return;

    console.log("[MemoryQueue] Starting queue processor");

    // Process jobs every 100ms
    this.processInterval = setInterval(() => {
      this.processNext();
    }, 100);
  }

  /**
   * Add a job to the queue
   */
  async add(
    type: QueueJobType,
    data: JobData,
    options: AddJobOptions = {}
  ): Promise<string> {
    const id = nanoid();
    const now = Date.now();

    const job: QueuedJob = {
      id,
      type,
      data,
      options,
      addedAt: now,
      scheduledFor: now + (options.delay || 0),
      status: "waiting",
    };

    this.jobs.set(id, job);
    console.log(`[MemoryQueue] Added job ${id} of type ${type}`);

    // Ensure processor is running
    this.start();

    return id;
  }

  /**
   * Register a handler for a job type
   */
  process(type: QueueJobType, handler: JobHandler): void {
    this.handlers.set(type, handler);
    console.log(`[MemoryQueue] Registered handler for ${type}`);
  }

  /**
   * Process the next available job
   */
  private async processNext(): Promise<void> {
    if (this.paused) return;
    if (this.activeCount >= this.maxConcurrency) return;

    const now = Date.now();

    // Find the next waiting job that's ready to run
    let nextJob: QueuedJob | null = null;

    for (const job of this.jobs.values()) {
      if (job.status === "waiting" && job.scheduledFor <= now) {
        if (!nextJob || job.scheduledFor < nextJob.scheduledFor) {
          nextJob = job;
        }
      }
    }

    if (!nextJob) return;

    const handler = this.handlers.get(nextJob.type);
    if (!handler) {
      console.warn(`[MemoryQueue] No handler for job type ${nextJob.type}`);
      return;
    }

    // Mark as active
    nextJob.status = "active";
    this.activeCount++;

    console.log(`[MemoryQueue] Processing job ${nextJob.id} (${nextJob.type})`);

    try {
      await handler(nextJob.data);
      nextJob.status = "completed";
      console.log(`[MemoryQueue] Job ${nextJob.id} completed`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      nextJob.status = "failed";
      nextJob.error = errorMessage;
      console.error(`[MemoryQueue] Job ${nextJob.id} failed:`, errorMessage);

      // Handle retries
      const attempts = nextJob.options.attempts || 0;
      if (attempts > 0) {
        const retryDelay = this.calculateRetryDelay(nextJob.options);
        console.log(`[MemoryQueue] Scheduling retry for job ${nextJob.id} in ${retryDelay}ms`);

        // Re-queue with reduced attempts
        await this.add(nextJob.type, nextJob.data, {
          ...nextJob.options,
          delay: retryDelay,
          attempts: attempts - 1,
        });
      }
    } finally {
      this.activeCount--;
    }
  }

  /**
   * Calculate retry delay based on backoff configuration
   */
  private calculateRetryDelay(options: AddJobOptions): number {
    const backoff = options.backoff || { type: "exponential", delay: 1000 };

    if (backoff.type === "fixed") {
      return backoff.delay;
    }

    // Exponential backoff with jitter
    const baseDelay = backoff.delay;
    const attempts = options.attempts || 1;
    const maxAttempts = 5; // Assume max 5 attempts for calculation
    const attemptNumber = maxAttempts - attempts;

    let delay = baseDelay * Math.pow(2, attemptNumber);
    delay = Math.min(delay, 60000); // Cap at 60 seconds

    // Add jitter (0.75x to 1.25x)
    const jitter = 0.75 + Math.random() * 0.5;
    return Math.floor(delay * jitter);
  }

  /**
   * Get queue status
   */
  async getStatus(): Promise<QueueStatus> {
    let waiting = 0;
    let active = 0;
    let completed = 0;
    let failed = 0;

    for (const job of this.jobs.values()) {
      switch (job.status) {
        case "waiting":
          waiting++;
          break;
        case "active":
          active++;
          break;
        case "completed":
          completed++;
          break;
        case "failed":
          failed++;
          break;
      }
    }

    return {
      type: "memory",
      waiting,
      active,
      completed,
      failed,
    };
  }

  /**
   * Pause job processing
   */
  async pause(): Promise<void> {
    this.paused = true;
    console.log("[MemoryQueue] Queue paused");
  }

  /**
   * Resume job processing
   */
  async resume(): Promise<void> {
    this.paused = false;
    console.log("[MemoryQueue] Queue resumed");
  }

  /**
   * Close the queue
   */
  async close(): Promise<void> {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
    console.log("[MemoryQueue] Queue closed");
  }

  /**
   * Remove a job from the queue
   */
  async remove(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    // Only remove if not active
    if (job.status === "active") {
      console.warn(`[MemoryQueue] Cannot remove active job ${jobId}`);
      return false;
    }

    this.jobs.delete(jobId);
    console.log(`[MemoryQueue] Removed job ${jobId}`);
    return true;
  }

  /**
   * Get a specific job by ID
   */
  getJob(jobId: string): QueuedJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs of a specific type
   */
  getJobsByType(type: QueueJobType): QueuedJob[] {
    const result: QueuedJob[] = [];
    for (const job of this.jobs.values()) {
      if (job.type === type) {
        result.push(job);
      }
    }
    return result;
  }

  /**
   * Clean up completed/failed jobs older than maxAge
   */
  cleanup(maxAgeMs: number = 3600000): number {
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;

    for (const [id, job] of this.jobs) {
      if (
        (job.status === "completed" || job.status === "failed") &&
        job.addedAt < cutoff
      ) {
        this.jobs.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[MemoryQueue] Cleaned up ${removed} old jobs`);
    }

    return removed;
  }
}

/**
 * Create a memory queue instance
 */
export function createMemoryQueue(
  options: { maxConcurrency?: number } = {}
): MemoryQueue {
  return new MemoryQueue(options);
}
