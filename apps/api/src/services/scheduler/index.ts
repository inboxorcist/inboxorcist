/**
 * Scheduler Service
 *
 * Handles periodic background tasks like delta sync.
 * Uses setInterval for simplicity (no external dependencies).
 */

import { eq, and, isNotNull } from 'drizzle-orm'
import { db, tables } from '../../db'
import type { GmailAccount } from '../../db'
import { processDeltaSync } from '../sync/worker'
import { logger } from '../../lib/logger'

// 30 minutes in milliseconds
const DELTA_SYNC_INTERVAL_MS = 30 * 60 * 1000

// Track the interval handle for cleanup
let deltaSyncIntervalId: ReturnType<typeof setInterval> | null = null

/**
 * Check if there's an active sync job for an account
 */
async function hasActiveSyncJob(accountId: string): Promise<boolean> {
  const [activeJob] = await db
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

  return !!activeJob
}

/**
 * Get all accounts eligible for delta sync
 * - syncStatus = 'completed' (has had a successful full sync)
 * - historyId is set (needed for delta sync)
 */
async function getEligibleAccounts(): Promise<GmailAccount[]> {
  const accounts = await db
    .select()
    .from(tables.gmailAccounts)
    .where(
      and(
        eq(tables.gmailAccounts.syncStatus, 'completed'),
        isNotNull(tables.gmailAccounts.historyId)
      )
    )

  return accounts
}

/**
 * Run delta sync for all eligible accounts
 * Handles errors gracefully - one account's failure won't affect others
 */
async function runPeriodicDeltaSync(): Promise<void> {
  logger.debug('[Scheduler] Starting periodic delta sync for all eligible accounts...')

  const accounts = await getEligibleAccounts()

  if (accounts.length === 0) {
    logger.debug('[Scheduler] No accounts eligible for delta sync')
    return
  }

  logger.debug(`[Scheduler] Found ${accounts.length} account(s) eligible for delta sync`)

  let successCount = 0
  let skipCount = 0
  let errorCount = 0

  for (const account of accounts) {
    try {
      // Skip if there's an active sync job
      if (await hasActiveSyncJob(account.id)) {
        logger.debug(`[Scheduler] Skipping account ${account.email} - active sync in progress`)
        skipCount++
        continue
      }

      logger.debug(`[Scheduler] Running delta sync for ${account.email}`)
      const result = await processDeltaSync(account.id)

      if (result) {
        logger.debug(
          `[Scheduler] Delta sync for ${account.email}: ${result.added} added, ${result.deleted} deleted, ${result.labelChanges} label changes`
        )
        successCount++
      } else {
        // Delta sync returned null - history expired or no historyId
        logger.warn(
          `[Scheduler] Delta sync for ${account.email} returned null - may need full sync`
        )
        skipCount++
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`[Scheduler] Delta sync failed for ${account.email}:`, errorMessage)
      errorCount++
      // Continue to next account - don't let one failure stop the others
    }
  }

  logger.debug(
    `[Scheduler] Periodic delta sync complete: ${successCount} success, ${skipCount} skipped, ${errorCount} errors`
  )
}

/**
 * Start the scheduler
 * Schedules periodic delta sync for all eligible accounts
 */
export function startScheduler(): void {
  if (deltaSyncIntervalId) {
    logger.warn('[Scheduler] Scheduler already running')
    return
  }

  logger.debug(
    `[Scheduler] Starting scheduler (delta sync every ${DELTA_SYNC_INTERVAL_MS / 60000} minutes)`
  )

  // Run immediately on startup, then periodically
  // Use setTimeout for the first run to not block server startup
  setTimeout(() => {
    runPeriodicDeltaSync().catch((error) => {
      logger.error('[Scheduler] Initial delta sync failed:', error)
    })
  }, 5000) // Wait 5 seconds after startup

  // Then run every DELTA_SYNC_INTERVAL_MS
  deltaSyncIntervalId = setInterval(() => {
    runPeriodicDeltaSync().catch((error) => {
      logger.error('[Scheduler] Periodic delta sync failed:', error)
    })
  }, DELTA_SYNC_INTERVAL_MS)

  logger.debug('[Scheduler] Scheduler started successfully')
}

/**
 * Stop the scheduler
 * Call this during graceful shutdown
 */
export function stopScheduler(): void {
  if (deltaSyncIntervalId) {
    clearInterval(deltaSyncIntervalId)
    deltaSyncIntervalId = null
    logger.debug('[Scheduler] Scheduler stopped')
  }
}

/**
 * Check if the scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return deltaSyncIntervalId !== null
}
