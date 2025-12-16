/**
 * Auto-Trigger Sync Service
 *
 * Triggers sync operations. Status updates are handled by worker.ts.
 * This service only:
 * 1. Fetches message count from Gmail
 * 2. Calls startMetadataSync which creates job and sets "syncing" status
 * 3. Handles errors by setting "error" status
 */

import { eq } from 'drizzle-orm'
import { db, tables, dbType } from '../../db'
import { getQuickStats } from '../gmail'
import { startMetadataSync } from './worker'
import { logger } from '../../lib/logger'

/**
 * Helper to update sync status on error
 */
async function markSyncError(accountId: string, error: string): Promise<void> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()
  await db
    .update(tables.gmailAccounts)
    .set({
      syncStatus: 'error',
      syncError: error,
      updatedAt: now as Date,
    })
    .where(eq(tables.gmailAccounts.id, accountId))
}

/**
 * Trigger post-OAuth sync flow
 *
 * 1. Fetch total message count from Gmail
 * 2. Start full metadata sync (which sets "syncing" status)
 *
 * This runs in the background after OAuth callback returns.
 * Errors are logged and status updated - does not re-throw.
 */
export async function triggerPostOAuthSync(accountId: string): Promise<void> {
  logger.info(`[AutoTrigger] Starting post-OAuth sync for account ${accountId}`)

  try {
    // Step 1: Fetch total message count
    logger.info(`[AutoTrigger] Fetching message count...`)
    const stats = await getQuickStats(accountId)
    logger.info(`[AutoTrigger] Found ${stats.total} emails.`)

    // Step 2: Start full metadata sync (sets "syncing" status internally)
    logger.info(`[AutoTrigger] Starting full metadata sync...`)
    const job = await startMetadataSync(accountId, stats.total)
    logger.info(`[AutoTrigger] Sync job ${job.id} queued for ${stats.total} emails`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`[AutoTrigger] Failed for account ${accountId}:`, message)

    // Update account with error status - don't re-throw since this runs in background
    await markSyncError(accountId, message)
  }
}

/**
 * Trigger full sync - fetches message count from Gmail API
 *
 * Used for manual sync triggers (not post-OAuth).
 * Has proper error handling - updates status on failure.
 */
export async function triggerFullSyncOnly(accountId: string): Promise<void> {
  logger.info(`[AutoTrigger] Starting full sync for account ${accountId}`)

  try {
    // Verify account exists
    const [account] = await db
      .select()
      .from(tables.gmailAccounts)
      .where(eq(tables.gmailAccounts.id, accountId))
      .limit(1)

    if (!account) {
      throw new Error('Account not found')
    }

    // Fetch message count from Gmail
    logger.info(`[AutoTrigger] Fetching message count...`)
    const stats = await getQuickStats(accountId)

    // Start sync (sets "syncing" status internally)
    const job = await startMetadataSync(accountId, stats.total)
    logger.info(`[AutoTrigger] Sync job ${job.id} started for ${stats.total} emails`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`[AutoTrigger] triggerFullSyncOnly failed for account ${accountId}:`, message)

    // Update account with error status
    await markSyncError(accountId, message)

    // Re-throw for manual triggers so caller knows it failed
    throw error
  }
}
