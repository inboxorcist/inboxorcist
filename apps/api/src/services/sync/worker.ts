/**
 * Metadata Sync Worker
 *
 * Processes sync jobs to fetch email metadata from Gmail and store in SQLite.
 * Implements Step 2 of the two-step sync algorithm.
 */

import { eq, and, sql } from 'drizzle-orm'
import { db, tables, dbType } from '../../db'
import type { Job, GmailAccount } from '../../db'
import {
  listAllMessageIds,
  fetchMessageDetails,
  fetchHistoryChanges,
  getCurrentHistoryId,
  getQuickStats,
} from '../gmail'
import {
  openEmailsDb,
  clearEmails,
  insertEmails,
  buildSenderAggregates,
  deleteEmailsByIds,
} from '../../lib/emails-db'
import { createGmailThrottle } from '../../lib/throttle'
import { isRetryableError } from '../../lib/retry'
import { registerHandler } from '../queue'
import type { SyncJobData } from '../queue/types'
import { logger } from '../../lib/logger'

// Batch size for SQLite inserts (matches Gmail page size for efficiency)
const SQLITE_BATCH_SIZE = 500

// How often to update progress in DB (every N messages)
const PROGRESS_UPDATE_INTERVAL = 500

/**
 * Get a job by ID
 */
async function getJob(jobId: string): Promise<Job | null> {
  const [job] = await db.select().from(tables.jobs).where(eq(tables.jobs.id, jobId)).limit(1)

  return job || null
}

/**
 * Get a Gmail account by ID
 */
async function getAccount(accountId: string): Promise<GmailAccount | null> {
  const [account] = await db
    .select()
    .from(tables.gmailAccounts)
    .where(eq(tables.gmailAccounts.id, accountId))
    .limit(1)

  return account || null
}

/**
 * Update job progress in the database
 */
async function updateJobProgress(
  jobId: string,
  processed: number,
  nextPageToken: string | null
): Promise<void> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  await db
    .update(tables.jobs)
    .set({
      processedMessages: processed,
      nextPageToken,
      updatedAt: now as Date,
    })
    .where(eq(tables.jobs.id, jobId))
}

/**
 * Update job status
 */
async function updateJobStatus(
  jobId: string,
  status: Job['status'],
  extra?: Partial<{
    startedAt: Date | string
    completedAt: Date | string
    lastError: string
    retryCount: number
  }>
): Promise<void> {
  // Cast to Date for Postgres types - at runtime, SQLite gets ISO string
  const now = (dbType === 'postgres' ? new Date() : new Date().toISOString()) as Date

  await db
    .update(tables.jobs)
    .set({
      status,
      updatedAt: now,
      ...(extra as Record<string, unknown>),
    })
    .where(eq(tables.jobs.id, jobId))
}

/**
 * Update account sync status
 */
async function updateAccountSyncStatus(
  accountId: string,
  syncStatus: GmailAccount['syncStatus'],
  extra?: Partial<{
    syncStartedAt: Date | string | null
    syncCompletedAt: Date | string | null
    syncError: string | null
  }>
): Promise<void> {
  // Cast to Date for Postgres types - at runtime, SQLite gets ISO string
  const now = (dbType === 'postgres' ? new Date() : new Date().toISOString()) as Date

  await db
    .update(tables.gmailAccounts)
    .set({
      syncStatus,
      updatedAt: now,
      ...(extra as Record<string, unknown>),
    })
    .where(eq(tables.gmailAccounts.id, accountId))
}

/**
 * Check if job has been cancelled
 */
async function isJobCancelled(jobId: string): Promise<boolean> {
  const job = await getJob(jobId)
  return job?.status === 'cancelled'
}

/**
 * Check if there's already a running sync job for this account (database-based lock)
 */
async function hasRunningSync(accountId: string, excludeJobId?: string): Promise<boolean> {
  const runningJobs = await db
    .select({ id: tables.jobs.id })
    .from(tables.jobs)
    .where(
      and(
        eq(tables.jobs.gmailAccountId, accountId),
        eq(tables.jobs.type, 'sync'),
        eq(tables.jobs.status, 'running')
      )
    )
    .limit(1)

  // If we're checking for a specific job, exclude it from the check
  const firstJob = runningJobs[0]
  if (excludeJobId && runningJobs.length === 1 && firstJob?.id === excludeJobId) {
    return false
  }

  return runningJobs.length > 0
}

/**
 * Process a metadata sync job
 */
export async function processMetadataSync(data: SyncJobData): Promise<void> {
  const { jobId, accountId } = data

  logger.info(`[SyncWorker] Processing sync job ${jobId} for account ${accountId}`)

  const job = await getJob(jobId)
  if (!job) {
    logger.error(`[SyncWorker] Job ${jobId} not found`)
    return
  }

  // Skip if job is not pending (might have been cancelled or completed)
  if (job.status !== 'pending') {
    logger.info(`[SyncWorker] Job ${jobId} is ${job.status}, skipping`)
    return
  }

  // Check database for already running sync for this account
  if (await hasRunningSync(accountId)) {
    console.log(
      `[SyncWorker] Another sync already running for account ${accountId}, skipping job ${jobId}`
    )
    // Mark this job as cancelled since another one is running
    await updateJobStatus(jobId, 'cancelled', { lastError: 'Another sync already running' })
    return
  }

  const account = await getAccount(accountId)
  if (!account) {
    logger.error(`[SyncWorker] Account ${accountId} not found`)
    await updateJobStatus(jobId, 'failed', { lastError: 'Account not found' })
    return
  }

  try {
    // Determine if this is a fresh start or resume
    const isResume = (job.processedMessages || 0) > 0
    const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

    // Mark job as running with resume tracking if needed
    if (isResume) {
      // Resuming - set resumedAt and processedAtResume for accurate ETA
      await db
        .update(tables.jobs)
        .set({
          status: 'running',
          resumedAt: now as Date,
          processedAtResume: job.processedMessages || 0,
          updatedAt: now as Date,
        })
        .where(eq(tables.jobs.id, jobId))
    } else {
      // Fresh start
      await updateJobStatus(jobId, 'running', { startedAt: now as Date })
    }

    // Update syncStartedAt (syncStatus is already "syncing" from startMetadataSync)
    await db
      .update(tables.gmailAccounts)
      .set({
        syncStartedAt: now as Date,
        syncError: null,
        updatedAt: now as Date,
      })
      .where(eq(tables.gmailAccounts.id, accountId))

    // Initialize SQLite database for this account
    const emailsDb = openEmailsDb(accountId)

    // Clear existing data if starting fresh (no page token)
    if (!job.nextPageToken) {
      logger.info(`[SyncWorker] Clearing existing emails for fresh sync`)
      clearEmails(emailsDb)
    }

    const throttle = createGmailThrottle()

    let processedCount = job.processedMessages || 0

    // Iterate through all message pages
    // Note: listAllMessageIds and fetchMessageDetails now handle token refresh internally
    for await (const page of listAllMessageIds(accountId, {
      pageToken: job.nextPageToken || undefined,
      onPage: (num, total) => {
        logger.info(`[SyncWorker] Fetched page ${num}, total IDs: ${total}`)
      },
    })) {
      // Check for cancellation
      if (await isJobCancelled(jobId)) {
        logger.info(`[SyncWorker] Job ${jobId} was cancelled`)
        await updateAccountSyncStatus(accountId, 'idle')
        return
      }

      if (page.ids.length === 0) {
        continue
      }

      // Fetch message details for this page
      const emails = await fetchMessageDetails(
        accountId,
        page.ids,
        throttle,
        (processed, failed) => {
          if (failed > 0) {
            logger.warn(`[SyncWorker] ${failed} messages failed in batch`)
          }
        },
        job.totalMessages || undefined // Pass total for ETA calculation
      )

      // Insert emails in batches to SQLite
      for (let i = 0; i < emails.length; i += SQLITE_BATCH_SIZE) {
        const batch = emails.slice(i, i + SQLITE_BATCH_SIZE)
        insertEmails(emailsDb, batch)

        // Yield between SQLite batches
        await new Promise((resolve) => setImmediate(resolve))
      }

      processedCount += page.ids.length

      // Update progress periodically
      if (processedCount % PROGRESS_UPDATE_INTERVAL < page.ids.length) {
        await updateJobProgress(jobId, processedCount, page.nextPageToken)
        console.log(
          `[SyncWorker] Progress: ${processedCount}/${job.totalMessages} (${Math.round(
            (processedCount / (job.totalMessages || 1)) * 100
          )}%)`
        )
      }
    }

    // Build sender aggregates
    logger.info(`[SyncWorker] Building sender aggregates...`)
    buildSenderAggregates(emailsDb)

    // Get and store the current historyId for future delta syncs
    logger.info(`[SyncWorker] Fetching current historyId for delta sync...`)
    const currentHistoryId = await getCurrentHistoryId(accountId)
    logger.info(`[SyncWorker] Storing historyId: ${currentHistoryId}`)

    // Store historyId for future delta syncs
    await db
      .update(tables.gmailAccounts)
      .set({
        historyId: parseInt(currentHistoryId, 10) || null,
      })
      .where(eq(tables.gmailAccounts.id, accountId))

    logger.info(`[SyncWorker] Stored historyId for delta sync`)

    // Mark as completed
    const completedAt = dbType === 'postgres' ? new Date() : new Date().toISOString()
    await updateJobStatus(jobId, 'completed', {
      completedAt: completedAt as Date,
    })
    await updateJobProgress(jobId, processedCount, null)
    await updateAccountSyncStatus(accountId, 'completed', {
      syncCompletedAt: completedAt as Date | null,
    })

    logger.info(`[SyncWorker] Sync job ${jobId} completed. Processed ${processedCount} emails.`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`[SyncWorker] Sync job ${jobId} failed:`, errorMessage)

    await handleSyncError(jobId, accountId, error)
  }
}

/**
 * Handle sync errors with retry logic
 */
async function handleSyncError(jobId: string, accountId: string, error: unknown): Promise<void> {
  const job = await getJob(jobId)
  if (!job) return

  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorObj = error as { code?: number; status?: number }

  // Check for auth errors (non-retryable, user action needed)
  if (errorObj.code === 401 || errorObj.status === 401) {
    logger.info(`[SyncWorker] Auth expired for job ${jobId}, marking as failed`)
    await updateJobStatus(jobId, 'failed', {
      lastError: 'Authentication expired. Please reconnect your Gmail account.',
    })
    await updateAccountSyncStatus(accountId, 'error', {
      syncError: 'Authentication expired',
    })
    return
  }

  // Check for permission errors (non-retryable)
  if (errorObj.code === 403 || errorObj.status === 403) {
    logger.info(`[SyncWorker] Permission denied for job ${jobId}`)
    await updateJobStatus(jobId, 'failed', {
      lastError: 'Permission denied. Please check your Gmail permissions.',
    })
    await updateAccountSyncStatus(accountId, 'error', {
      syncError: 'Permission denied',
    })
    return
  }

  // Retryable errors
  const retryCount = (job.retryCount || 0) + 1
  const maxRetries = 3

  if (isRetryableError(error) && retryCount <= maxRetries) {
    // Calculate delay: 2^retryCount minutes (2, 4, 8 minutes)
    const delayMinutes = Math.pow(2, retryCount)
    console.log(
      `[SyncWorker] Will retry job ${jobId} in ${delayMinutes} minutes (attempt ${retryCount}/${maxRetries})`
    )

    await updateJobStatus(jobId, 'pending', {
      lastError: errorMessage,
      retryCount,
    })

    // Re-queue with delay (the queue will handle this)
    // Note: The queue system will pick this up on next poll
    return
  }

  // Permanent failure
  logger.info(`[SyncWorker] Job ${jobId} permanently failed after ${retryCount} retries`)
  await updateJobStatus(jobId, 'failed', {
    lastError: errorMessage,
    retryCount,
  })
  await updateAccountSyncStatus(accountId, 'error', {
    syncError: errorMessage,
  })
}

// ============================================================================
// Delta Sync (Incremental)
// ============================================================================

/**
 * Process a delta (incremental) sync using Gmail's History API
 *
 * This syncs only changes since the last sync, making it much faster than full sync.
 * Falls back to full sync if history is expired or no previous sync exists.
 *
 * @param accountId - Gmail account ID
 * @returns Object with sync results or null if full sync is needed
 */
export async function processDeltaSync(accountId: string): Promise<{
  added: number
  deleted: number
  newHistoryId: string
} | null> {
  logger.info(`[SyncWorker] Starting delta sync for account ${accountId}`)

  // Get the stored historyId
  const account = await getAccount(accountId)
  if (!account) {
    logger.error(`[SyncWorker] Account ${accountId} not found`)
    return null
  }

  const storedHistoryId = account.historyId?.toString()
  if (!storedHistoryId || storedHistoryId === '0') {
    logger.info(`[SyncWorker] No historyId stored, full sync required`)
    return null
  }

  try {
    // Fetch changes since last sync
    const changes = await fetchHistoryChanges(accountId, storedHistoryId)

    if (changes.messagesAdded.length === 0 && changes.messagesDeleted.length === 0) {
      logger.info(`[SyncWorker] No changes since last sync`)

      // Update historyId even if no changes (it may have advanced)
      await db
        .update(tables.gmailAccounts)
        .set({
          historyId: parseInt(changes.newHistoryId, 10) || null,
        })
        .where(eq(tables.gmailAccounts.id, accountId))

      return {
        added: 0,
        deleted: 0,
        newHistoryId: changes.newHistoryId,
      }
    }

    // Open the emails database
    const emailsDb = openEmailsDb(accountId)
    const throttle = createGmailThrottle()

    // Process deletions first (remove from SQLite)
    if (changes.messagesDeleted.length > 0) {
      logger.info(`[SyncWorker] Deleting ${changes.messagesDeleted.length} messages from local db`)
      deleteEmailsByIds(emailsDb, changes.messagesDeleted)
    }

    // Process additions (fetch details and insert)
    let addedCount = 0
    if (changes.messagesAdded.length > 0) {
      logger.info(`[SyncWorker] Fetching ${changes.messagesAdded.length} new messages`)

      const messageIds = changes.messagesAdded.map((id) => ({ id }))
      const emails = await fetchMessageDetails(
        accountId,
        messageIds,
        throttle,
        (processed, failed) => {
          if (processed % 100 === 0) {
            logger.info(`[SyncWorker] Delta sync progress: ${processed}/${messageIds.length}`)
          }
          if (failed > 0) {
            logger.warn(`[SyncWorker] ${failed} messages failed in delta sync batch`)
          }
        }
      )

      // Insert in batches
      const BATCH_SIZE = 100
      for (let i = 0; i < emails.length; i += BATCH_SIZE) {
        const batch = emails.slice(i, i + BATCH_SIZE)
        insertEmails(emailsDb, batch)
      }

      addedCount = emails.length
    }

    // Rebuild sender aggregates after changes
    logger.info(`[SyncWorker] Rebuilding sender aggregates after delta sync`)
    buildSenderAggregates(emailsDb)

    // Update historyId
    await db
      .update(tables.gmailAccounts)
      .set({
        historyId: parseInt(changes.newHistoryId, 10) || null,
      })
      .where(eq(tables.gmailAccounts.id, accountId))

    console.log(
      `[SyncWorker] Delta sync complete: ${addedCount} added, ${changes.messagesDeleted.length} deleted`
    )

    return {
      added: addedCount,
      deleted: changes.messagesDeleted.length,
      newHistoryId: changes.newHistoryId,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // History expired - need full sync
    if (errorMessage === 'HISTORY_EXPIRED') {
      logger.info(`[SyncWorker] History expired, clearing historyId for full sync`)
      await db
        .update(tables.gmailAccounts)
        .set({
          historyId: null,
        })
        .where(eq(tables.gmailAccounts.id, accountId))
      return null
    }

    throw error
  }
}

/**
 * Start a delta sync (or fall back to full sync if needed)
 *
 * This is the main entry point for incremental sync.
 * It will try delta sync first, and if that fails (no historyId or expired),
 * it will trigger a full sync instead.
 *
 * @param accountId - Gmail account ID
 * @returns Job object (either existing delta sync result or new full sync job)
 */
export async function startDeltaSync(
  accountId: string
): Promise<
  { type: 'delta'; result: { added: number; deleted: number } } | { type: 'full'; job: Job }
> {
  const account = await getAccount(accountId)
  if (!account) {
    throw new Error(`Account ${accountId} not found`)
  }

  // Try delta sync first
  const deltaResult = await processDeltaSync(accountId)

  if (deltaResult !== null) {
    return {
      type: 'delta',
      result: {
        added: deltaResult.added,
        deleted: deltaResult.deleted,
      },
    }
  }

  // Fall back to full sync - fetch message count from Gmail
  logger.info(`[SyncWorker] Falling back to full sync for account ${accountId}`)
  const stats = await getQuickStats(accountId)
  const job = await startMetadataSync(accountId, stats.total)

  return {
    type: 'full',
    job,
  }
}

// ============================================================================
// Full Sync Job Management
// ============================================================================

/**
 * Start a new metadata sync job
 */
export async function startMetadataSync(accountId: string, totalMessages: number): Promise<Job> {
  // Get the account to retrieve userId
  const [account] = await db
    .select()
    .from(tables.gmailAccounts)
    .where(eq(tables.gmailAccounts.id, accountId))
    .limit(1)

  if (!account) {
    throw new Error(`Account ${accountId} not found`)
  }

  // Check for existing active sync
  const existingJobs = await db
    .select()
    .from(tables.jobs)
    .where(and(eq(tables.jobs.gmailAccountId, accountId), eq(tables.jobs.type, 'sync')))
    .orderBy(tables.jobs.createdAt)

  // Find any running or pending sync
  const activeJob = existingJobs.find((j: Job) => j.status === 'running' || j.status === 'pending')

  if (activeJob) {
    console.log(
      `[SyncWorker] Active sync job ${activeJob.id} already exists for account ${accountId}`
    )
    return activeJob
  }

  // Create new job
  const [newJob] = await db
    .insert(tables.jobs)
    .values({
      userId: account.userId,
      gmailAccountId: accountId,
      type: 'sync',
      status: 'pending',
      totalMessages,
      processedMessages: 0,
    })
    .returning()

  if (!newJob) {
    throw new Error('Failed to create sync job')
  }

  logger.info(`[SyncWorker] Created sync job ${newJob.id} for account ${accountId}`)

  // Update account status
  await updateAccountSyncStatus(accountId, 'syncing')

  // Add to queue
  const { addJob } = await import('../queue')
  await addJob('metadata_sync', {
    jobId: newJob.id,
    accountId,
  })

  return newJob
}

/**
 * Resume a failed or paused sync job
 */
export async function resumeMetadataSync(accountId: string): Promise<Job | null> {
  // Find the most recent failed or paused sync job
  const [job] = await db
    .select()
    .from(tables.jobs)
    .where(and(eq(tables.jobs.gmailAccountId, accountId), eq(tables.jobs.type, 'sync')))
    .orderBy(tables.jobs.createdAt)
    .limit(1)

  if (!job) {
    logger.info(`[SyncWorker] No sync job found to resume for account ${accountId}`)
    return null
  }

  if (job.status !== 'failed' && job.status !== 'paused') {
    logger.info(`[SyncWorker] Job ${job.id} is not resumable (status: ${job.status})`)
    return null
  }

  logger.info(`[SyncWorker] Resuming sync job ${job.id} from ${job.processedMessages} messages`)

  // Update job status
  await updateJobStatus(job.id, 'pending')
  await updateAccountSyncStatus(accountId, 'syncing')

  // Add to queue
  const { addJob } = await import('../queue')
  await addJob('metadata_sync', {
    jobId: job.id,
    accountId,
  })

  return job
}

/**
 * Cancel an active sync job
 */
export async function cancelMetadataSync(accountId: string): Promise<boolean> {
  // Find active sync job
  const jobs = await db
    .select()
    .from(tables.jobs)
    .where(and(eq(tables.jobs.gmailAccountId, accountId), eq(tables.jobs.type, 'sync')))

  const activeJob = jobs.find((j: Job) => j.status === 'running' || j.status === 'pending')

  if (!activeJob) {
    logger.info(`[SyncWorker] No active sync job found for account ${accountId}`)
    return false
  }

  logger.info(`[SyncWorker] Cancelling sync job ${activeJob.id}`)

  await updateJobStatus(activeJob.id, 'cancelled')
  await updateAccountSyncStatus(accountId, 'idle')

  return true
}

/**
 * Register the sync worker with the queue
 */
export function registerSyncWorker(): void {
  registerHandler('metadata_sync', async (data) => {
    await processMetadataSync(data as SyncJobData)
  })

  logger.info('[SyncWorker] Metadata sync worker registered')
}

/**
 * Resume interrupted sync jobs on server startup
 *
 * Finds jobs that were running, pending, or failed (with retries left) when server stopped
 * and re-queues them to continue from where they left off.
 *
 * Only resumes the most recent job per account; cancels duplicates.
 */
export async function resumeInterruptedJobs(): Promise<number> {
  logger.info('[SyncWorker] Checking for interrupted sync jobs...')

  const MAX_RETRIES = 3

  // Find jobs that were running, pending, or failed (with retries remaining), ordered by created_at DESC
  const interruptedJobs = await db
    .select()
    .from(tables.jobs)
    .where(
      and(
        eq(tables.jobs.type, 'sync'),
        sql`(${tables.jobs.status} IN ('running', 'pending') OR (${tables.jobs.status} = 'failed' AND COALESCE(${tables.jobs.retryCount}, 0) < ${MAX_RETRIES}))`
      )
    )
    .orderBy(sql`${tables.jobs.createdAt} DESC`)

  if (interruptedJobs.length === 0) {
    logger.info('[SyncWorker] No interrupted jobs found')
    return 0
  }

  logger.info(`[SyncWorker] Found ${interruptedJobs.length} interrupted job(s)`)

  // Group by account - only keep the most recent job per account
  const jobsByAccount = new Map<string, (typeof interruptedJobs)[0]>()
  const duplicateJobs: string[] = []

  for (const job of interruptedJobs) {
    if (!jobsByAccount.has(job.gmailAccountId)) {
      jobsByAccount.set(job.gmailAccountId, job)
    } else {
      // This is a duplicate - mark for cancellation
      duplicateJobs.push(job.id)
    }
  }

  // Cancel duplicate jobs
  if (duplicateJobs.length > 0) {
    logger.info(`[SyncWorker] Cancelling ${duplicateJobs.length} duplicate job(s)`)
    for (const jobId of duplicateJobs) {
      await db.update(tables.jobs).set({ status: 'cancelled' }).where(eq(tables.jobs.id, jobId))
    }
  }

  const { addJob } = await import('../queue')
  let resumed = 0

  for (const [accountId, job] of jobsByAccount) {
    // Reset running or failed jobs to pending (they were interrupted or need retry)
    if (job.status === 'running' || job.status === 'failed') {
      const retryCount = (job.retryCount || 0) + (job.status === 'failed' ? 1 : 0)
      await db
        .update(tables.jobs)
        .set({
          status: 'pending',
          retryCount,
        })
        .where(eq(tables.jobs.id, job.id))

      logger.info(`[SyncWorker] Reset ${job.status} job ${job.id} to pending (retry ${retryCount})`)
    }

    // Re-queue the job
    await addJob('metadata_sync', {
      jobId: job.id,
      accountId,
    })

    console.log(
      `[SyncWorker] Re-queued job ${job.id} (was at ${job.processedMessages}/${job.totalMessages})`
    )
    resumed++
  }

  return resumed
}
