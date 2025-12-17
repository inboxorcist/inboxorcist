/**
 * Gmail API Routes
 *
 * Endpoints for stats, sync, and email operations
 * All routes require authentication and verify account ownership.
 */

import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { db, tables } from '../db'
import type { GmailAccount, Job } from '../db'
import { getQuickStats } from '../services/gmail'
import {
  startMetadataSync,
  resumeMetadataSync,
  cancelMetadataSync,
  calculateProgress,
  startDeltaSync,
} from '../services/sync'
import { openEmailsDb, getTopSenders, getEmailCount, calculateStats } from '../lib/emails-db'
import { auth, type AuthVariables } from '../middleware/auth'
import { verifyAccountOwnership } from '../middleware/ownership'
import { logger } from '../lib/logger'

const gmail = new Hono<{ Variables: AuthVariables }>()

// Apply auth middleware to all routes
gmail.use('*', auth())

// ============================================================================
// Helper: Get account with ownership verification
// ============================================================================

async function getAccountForUser(userId: string, accountId: string): Promise<GmailAccount | null> {
  return verifyAccountOwnership(userId, accountId)
}

async function getLatestSyncJob(accountId: string): Promise<Job | null> {
  const jobs = await db
    .select()
    .from(tables.jobs)
    .where(and(eq(tables.jobs.gmailAccountId, accountId), eq(tables.jobs.type, 'sync')))
    .orderBy(tables.jobs.createdAt)

  // Return the most recent one
  return jobs[jobs.length - 1] ?? null
}

// ============================================================================
// Stats Endpoints (Step 1)
// ============================================================================

/**
 * GET /api/gmail/accounts/:id/stats
 * Get stats for a Gmail account (calculated from emails database)
 *
 * Stats are calculated on-demand from the local emails database.
 * During sync, returns partial stats based on data synced so far.
 */
gmail.get('/accounts/:id/stats', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    // Calculate stats from whatever data has been synced so far
    // This works during sync (partial stats) and after sync (complete stats)
    const stats = calculateStats(accountId)

    return c.json({
      stats,
      syncStatus: account.syncStatus,
      syncStartedAt: account.syncStartedAt,
      syncCompletedAt: account.syncCompletedAt,
    })
  } catch (error) {
    logger.error('[Gmail] Error fetching stats:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to fetch stats: ${message}` }, 500)
  }
})

// ============================================================================
// Sync Endpoints (Step 2)
// ============================================================================

/**
 * POST /api/gmail/accounts/:id/sync
 * Start a full metadata sync
 */
gmail.post('/accounts/:id/sync', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    // Fetch message count from Gmail
    logger.debug(`[Gmail] Fetching message count before sync for account ${accountId}`)
    const stats = await getQuickStats(accountId)
    const totalMessages = stats.total

    // Start sync job
    const job = await startMetadataSync(accountId, totalMessages)

    return c.json({
      jobId: job.id,
      status: job.status,
      totalMessages,
      message: 'Sync started',
    })
  } catch (error) {
    logger.error('[Gmail] Error starting sync:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to start sync: ${message}` }, 500)
  }
})

/**
 * GET /api/gmail/accounts/:id/sync
 * Get sync progress
 */
gmail.get('/accounts/:id/sync', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const job = await getLatestSyncJob(accountId)

    if (!job) {
      return c.json({
        status: 'no_sync',
        syncStatus: account.syncStatus,
        message: 'No sync job found',
      })
    }

    const progress = calculateProgress(job)

    return c.json({
      jobId: job.id,
      ...progress,
      syncStatus: account.syncStatus,
    })
  } catch (error) {
    logger.error('[Gmail] Error getting sync progress:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to get sync progress: ${message}` }, 500)
  }
})

/**
 * DELETE /api/gmail/accounts/:id/sync
 * Cancel active sync
 */
gmail.delete('/accounts/:id/sync', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const cancelled = await cancelMetadataSync(accountId)

    if (!cancelled) {
      return c.json({
        success: false,
        message: 'No active sync to cancel',
      })
    }

    return c.json({
      success: true,
      message: 'Sync cancelled',
    })
  } catch (error) {
    logger.error('[Gmail] Error cancelling sync:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to cancel sync: ${message}` }, 500)
  }
})

/**
 * POST /api/gmail/accounts/:id/sync/delta
 * Run a delta (incremental) sync
 *
 * Uses Gmail's History API to sync only changes since last sync.
 * Falls back to full sync if no previous sync exists or history expired.
 */
gmail.post('/accounts/:id/sync/delta', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    // Check if we have a completed sync (historyId stored)
    if (!account.historyId) {
      return c.json(
        {
          error: 'No previous sync found',
          message: 'A full sync must complete first before delta sync can be used',
          suggestion: 'Use POST /sync to start a full sync',
        },
        400
      )
    }

    const result = await startDeltaSync(accountId)

    if (result.type === 'delta') {
      return c.json({
        type: 'delta',
        success: true,
        added: result.result.added,
        deleted: result.result.deleted,
        labelChanges: result.result.labelChanges,
        message: `Delta sync complete: ${result.result.added} added, ${result.result.deleted} deleted, ${result.result.labelChanges} label changes`,
      })
    } else {
      // Fell back to full sync
      return c.json({
        type: 'full',
        success: true,
        jobId: result.job.id,
        status: result.job.status,
        message: 'History expired, started full sync instead',
      })
    }
  } catch (error) {
    logger.error('[Gmail] Error running delta sync:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to run delta sync: ${message}` }, 500)
  }
})

/**
 * POST /api/gmail/accounts/:id/sync/resume
 * Resume a failed or paused sync
 */
gmail.post('/accounts/:id/sync/resume', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const job = await resumeMetadataSync(accountId)

    if (!job) {
      return c.json(
        {
          success: false,
          message: 'No sync job to resume',
        },
        400
      )
    }

    return c.json({
      jobId: job.id,
      status: 'pending',
      message: 'Sync resumed',
      processedMessages: job.processedMessages,
      totalMessages: job.totalMessages,
    })
  } catch (error) {
    logger.error('[Gmail] Error resuming sync:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to resume sync: ${message}` }, 500)
  }
})

// ============================================================================
// Data Endpoints (after sync complete)
// ============================================================================

/**
 * GET /api/gmail/accounts/:id/senders
 * Get top senders (requires completed sync)
 */
gmail.get('/accounts/:id/senders', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')
  const limit = parseInt(c.req.query('limit') || '50')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    if (account.syncStatus !== 'completed') {
      return c.json(
        {
          error: 'Sync not complete',
          syncStatus: account.syncStatus,
          message: 'Full sync must complete before viewing senders',
        },
        400
      )
    }

    const emailsDb = openEmailsDb(accountId)
    const senders = getTopSenders(emailsDb, limit)
    const totalEmails = getEmailCount(emailsDb)

    return c.json({
      senders,
      totalEmails,
      limit,
    })
  } catch (error) {
    logger.error('[Gmail] Error fetching senders:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to fetch senders: ${message}` }, 500)
  }
})

/**
 * GET /api/gmail/accounts/:id/summary
 * Get account summary (stats + sync status + senders if available)
 */
gmail.get('/accounts/:id/summary', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const job = await getLatestSyncJob(accountId)
    const syncProgress = job ? calculateProgress(job) : null

    // Calculate stats from whatever data has been synced so far
    let stats = null
    let topSenders = null
    try {
      stats = calculateStats(accountId)
      const emailsDb = openEmailsDb(accountId)
      topSenders = getTopSenders(emailsDb, 10)
    } catch {
      // Ignore errors, stats/senders just won't be available
    }

    return c.json({
      account: {
        id: account.id,
        email: account.email,
        syncStatus: account.syncStatus,
      },
      stats,
      sync: syncProgress,
      topSenders,
    })
  } catch (error) {
    logger.error('[Gmail] Error fetching summary:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to fetch summary: ${message}` }, 500)
  }
})

export default gmail
