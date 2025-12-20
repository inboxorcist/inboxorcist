/**
 * Explorer API Routes
 *
 * Endpoints for browsing emails with filters and bulk operations
 * All routes require authentication and verify account ownership.
 */

import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { db, tables, type MailAccount } from '../db'
import {
  queryEmails,
  countFilteredEmails,
  sumFilteredEmailsSize,
  getMessageIdsByFilters,
  markEmailsAsTrashed,
  archiveAndDeleteEmails,
  getSenderSuggestions,
  getDistinctCategories,
  getSendersWithUnsubscribe,
  type ExplorerFilters,
  type SubscriptionFilters,
} from '../services/emails'
import { trashMessages, batchDeleteMessages, getGmailClient } from '../services/gmail'
import { createGmailThrottle } from '../lib/throttle'
import { auth, type AuthVariables } from '../middleware/auth'
import { verifyAccountOwnership } from '../middleware/ownership'
import { logger } from '../lib/logger'

const explorer = new Hono<{ Variables: AuthVariables }>()

// Apply auth middleware to all routes
explorer.use('*', auth())

// ============================================================================
// Helper: Get account with ownership verification
// ============================================================================

async function getAccountForUser(userId: string, accountId: string): Promise<MailAccount | null> {
  return verifyAccountOwnership(userId, accountId)
}

// ============================================================================
// Helper: Parse query params to filters
// ============================================================================

function parseFilters(query: Record<string, string | undefined>): ExplorerFilters {
  const filters: ExplorerFilters = {}

  if (query.sender) {
    filters.sender = query.sender
  }

  if (query.senderDomain) {
    filters.senderDomain = query.senderDomain
  }

  if (query.category) {
    filters.category = query.category
  }

  if (query.dateFrom) {
    const parsed = parseInt(query.dateFrom, 10)
    if (!isNaN(parsed)) {
      filters.dateFrom = parsed
    }
  }

  if (query.dateTo) {
    const parsed = parseInt(query.dateTo, 10)
    if (!isNaN(parsed)) {
      filters.dateTo = parsed
    }
  }

  if (query.sizeMin) {
    const parsed = parseInt(query.sizeMin, 10)
    if (!isNaN(parsed)) {
      filters.sizeMin = parsed
    }
  }

  if (query.sizeMax) {
    const parsed = parseInt(query.sizeMax, 10)
    if (!isNaN(parsed)) {
      filters.sizeMax = parsed
    }
  }

  if (query.isUnread !== undefined) {
    filters.isUnread = query.isUnread === 'true'
  }

  if (query.isStarred !== undefined) {
    filters.isStarred = query.isStarred === 'true'
  }

  if (query.hasAttachments !== undefined) {
    filters.hasAttachments = query.hasAttachments === 'true'
  }

  if (query.isTrash !== undefined) {
    filters.isTrash = query.isTrash === 'true'
  }

  if (query.isSpam !== undefined) {
    filters.isSpam = query.isSpam === 'true'
  }

  if (query.isImportant !== undefined) {
    filters.isImportant = query.isImportant === 'true'
  }

  if (query.isArchived !== undefined) {
    filters.isArchived = query.isArchived === 'true'
  }

  if (query.isSent !== undefined) {
    filters.isSent = query.isSent === 'true'
  }

  if (query.labelIds) {
    filters.labelIds = query.labelIds
  }

  if (query.search) {
    filters.search = query.search
  }

  if (query.sortBy && ['date', 'size', 'sender'].includes(query.sortBy)) {
    filters.sortBy = query.sortBy as 'date' | 'size' | 'sender'
  }

  if (query.sortOrder && ['asc', 'desc'].includes(query.sortOrder)) {
    filters.sortOrder = query.sortOrder as 'asc' | 'desc'
  }

  return filters
}

// ============================================================================
// Email Query Endpoints
// ============================================================================

/**
 * GET /api/explorer/accounts/:id/emails
 * Query emails with filters and pagination
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Page size (default: 50, max: 100 for browse, 5000 for cleanup)
 * - mode: "browse" (default) or "cleanup" - affects max limit
 * - ... filter params
 */
explorer.get('/accounts/:id/emails', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

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
          message: 'Full sync must complete before browsing emails',
        },
        400
      )
    }

    // Parse mode (browse or cleanup)
    const mode = c.req.query('mode') === 'cleanup' ? 'cleanup' : 'browse'
    const maxLimit = mode === 'cleanup' ? 5000 : 100

    // Parse pagination
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
    const limit = Math.min(maxLimit, Math.max(1, parseInt(c.req.query('limit') || '50', 10)))

    // Parse filters
    const filters = parseFilters(c.req.query() as Record<string, string | undefined>)

    // Query emails
    const emails = await queryEmails(accountId, filters, { page, limit })
    const total = await countFilteredEmails(accountId, filters)

    // Calculate total size of ALL matching emails (for storage info)
    const totalSizeBytes = await sumFilteredEmailsSize(accountId, filters)

    return c.json({
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
      filters,
      totalSizeBytes,
    })
  } catch (error) {
    logger.error('[Explorer] Error querying emails:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to query emails: ${message}` }, 500)
  }
})

/**
 * GET /api/explorer/accounts/:id/emails/count
 * Get count of emails matching filters
 */
explorer.get('/accounts/:id/emails/count', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

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
        },
        400
      )
    }

    // Parse filters
    const filters = parseFilters(c.req.query() as Record<string, string | undefined>)

    // Count matching emails
    const count = await countFilteredEmails(accountId, filters)

    return c.json({ count, filters })
  } catch (error) {
    logger.error('[Explorer] Error counting emails:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to count emails: ${message}` }, 500)
  }
})

// ============================================================================
// Single Email Endpoints
// ============================================================================

/**
 * POST /api/explorer/accounts/:id/emails/:messageId/read
 * Mark an email as read (remove UNREAD label)
 */
explorer.post('/accounts/:id/emails/:messageId/read', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')
  const messageId = c.req.param('messageId')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    // Mark as read in Gmail
    const gmail = await getGmailClient(accountId)
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    })

    // Update local database
    await db
      .update(tables.emails)
      .set({ isUnread: 0 })
      .where(
        and(eq(tables.emails.mailAccountId, accountId), eq(tables.emails.messageId, messageId))
      )

    return c.json({ success: true })
  } catch (error) {
    logger.error('[Explorer] Error marking email as read:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to mark as read: ${message}` }, 500)
  }
})

/**
 * GET /api/explorer/accounts/:id/emails/:messageId
 * Get full email content including body from Gmail API
 * Since we don't store email body, this fetches directly from Gmail
 */
explorer.get('/accounts/:id/emails/:messageId', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')
  const messageId = c.req.param('messageId')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    // Fetch full message from Gmail API
    const gmail = await getGmailClient(accountId)
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    })

    const message = response.data
    if (!message) {
      return c.json({ error: 'Email not found' }, 404)
    }

    // Extract headers
    const headers = message.payload?.headers || []
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || null

    // Extract body content
    const extractBody = (
      payload: typeof message.payload
    ): { html: string | null; text: string | null } => {
      let html: string | null = null
      let text: string | null = null

      if (!payload) return { html, text }

      // Helper to decode base64url
      const decode = (data: string | undefined | null) => {
        if (!data) return null
        try {
          // Gmail uses base64url encoding
          const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
          return Buffer.from(base64, 'base64').toString('utf-8')
        } catch {
          return null
        }
      }

      // Check if this part has body data
      if (payload.body?.data) {
        const content = decode(payload.body.data)
        if (payload.mimeType === 'text/html') {
          html = content
        } else if (payload.mimeType === 'text/plain') {
          text = content
        }
      }

      // Recursively check parts
      if (payload.parts) {
        for (const part of payload.parts) {
          if (part.mimeType === 'text/html' && part.body?.data) {
            html = decode(part.body.data) || html
          } else if (part.mimeType === 'text/plain' && part.body?.data) {
            text = decode(part.body.data) || text
          } else if (part.mimeType?.startsWith('multipart/') && part.parts) {
            const nested = extractBody(part)
            html = nested.html || html
            text = nested.text || text
          }
        }
      }

      return { html, text }
    }

    const body = extractBody(message.payload)

    // Extract attachments info
    const extractAttachments = (
      payload: typeof message.payload
    ): Array<{ filename: string; mimeType: string; size: number }> => {
      const attachments: Array<{ filename: string; mimeType: string; size: number }> = []

      const processparts = (parts: typeof payload.parts) => {
        if (!parts) return
        for (const part of parts) {
          if (part.filename && part.filename.length > 0) {
            attachments.push({
              filename: part.filename,
              mimeType: part.mimeType || 'application/octet-stream',
              size: part.body?.size || 0,
            })
          }
          if (part.parts) {
            processparts(part.parts)
          }
        }
      }

      processparts(payload?.parts)
      return attachments
    }

    const attachments = extractAttachments(message.payload)

    return c.json({
      id: message.id,
      threadId: message.threadId,
      labelIds: message.labelIds || [],
      snippet: message.snippet,
      historyId: message.historyId,
      internalDate: message.internalDate,
      sizeEstimate: message.sizeEstimate,
      headers: {
        from: getHeader('From'),
        to: getHeader('To'),
        cc: getHeader('Cc'),
        bcc: getHeader('Bcc'),
        subject: getHeader('Subject'),
        date: getHeader('Date'),
        replyTo: getHeader('Reply-To'),
        messageId: getHeader('Message-ID'),
      },
      body,
      attachments,
    })
  } catch (error) {
    logger.error('[Explorer] Error fetching email content:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to fetch email: ${message}` }, 500)
  }
})

// ============================================================================
// Trash Endpoint
// ============================================================================

/**
 * POST /api/explorer/accounts/:id/emails/trash
 * Move selected emails to trash
 *
 * Body can contain either:
 * - emailIds: string[] - specific email IDs to trash
 * - filters: ExplorerFilters - filter criteria to match emails to trash
 */
explorer.post('/accounts/:id/emails/trash', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

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
        },
        400
      )
    }

    const body = await c.req.json<{ emailIds?: string[]; filters?: ExplorerFilters }>()

    // Get email IDs from either direct IDs or filters
    let emailIds: string[]
    if (body.filters && Object.keys(body.filters).length > 0) {
      // Get all matching email IDs from filters
      emailIds = await getMessageIdsByFilters(accountId, body.filters)
    } else if (body.emailIds && Array.isArray(body.emailIds)) {
      emailIds = body.emailIds
    } else {
      return c.json({ error: 'No email IDs or filters provided' }, 400)
    }

    if (emailIds.length === 0) {
      return c.json({ error: 'No emails match the criteria' }, 400)
    }

    // No upper limit when using filters - process in batches
    logger.debug(`[Explorer] Trashing ${emailIds.length} emails for account ${accountId}`)

    // Trash emails in Gmail
    const throttle = createGmailThrottle()
    const { succeeded, failed } = await trashMessages(accountId, emailIds, throttle)

    // Mark trashed emails in local database (set is_trash = 1)
    if (succeeded > 0) {
      // Mark emails as trashed to keep data consistent with Gmail
      await markEmailsAsTrashed(accountId, emailIds)
    }

    logger.debug(`[Explorer] Trashed ${succeeded} emails, ${failed} failed`)

    return c.json({
      success: true,
      trashedCount: succeeded,
      failedCount: failed,
      message:
        failed > 0
          ? `Trashed ${succeeded} emails, ${failed} failed`
          : `Successfully trashed ${succeeded} emails`,
    })
  } catch (error) {
    logger.error('[Explorer] Error trashing emails:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to trash emails: ${message}` }, 500)
  }
})

/**
 * POST /api/explorer/accounts/:id/emails/delete
 * Permanently delete selected emails (cannot be recovered)
 *
 * Body can contain either:
 * - emailIds: string[] - specific email IDs to delete
 * - filters: ExplorerFilters - filter criteria to match emails to delete
 */
explorer.post('/accounts/:id/emails/delete', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

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
        },
        400
      )
    }

    const body = await c.req.json<{ emailIds?: string[]; filters?: ExplorerFilters }>()

    // Get email IDs from either direct IDs or filters
    let emailIds: string[]
    if (body.filters && Object.keys(body.filters).length > 0) {
      // Get all matching email IDs from filters
      emailIds = await getMessageIdsByFilters(accountId, body.filters)
    } else if (body.emailIds && Array.isArray(body.emailIds)) {
      emailIds = body.emailIds
    } else {
      return c.json({ error: 'No email IDs or filters provided' }, 400)
    }

    if (emailIds.length === 0) {
      return c.json({ error: 'No emails match the criteria' }, 400)
    }

    logger.debug(
      `[Explorer] Permanently deleting ${emailIds.length} emails for account ${accountId}`
    )

    // 1. Delete from Gmail first - if this fails, local state stays consistent
    await batchDeleteMessages(accountId, emailIds)

    // 2. Archive to Eternal Memory, then remove from local database
    const { archived, deleted: deletedCount } = await archiveAndDeleteEmails(accountId, emailIds)

    logger.debug(
      `[Explorer] Permanently deleted ${deletedCount} emails (${archived} archived to Eternal Memory)`
    )

    return c.json({
      success: true,
      deletedCount,
      archivedCount: archived,
      message: `Permanently deleted ${deletedCount} emails`,
    })
  } catch (error) {
    logger.error('[Explorer] Error permanently deleting emails:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to delete emails: ${message}` }, 500)
  }
})

// ============================================================================
// Filter Options Endpoints
// ============================================================================

/**
 * GET /api/explorer/accounts/:id/senders
 * Get sender suggestions with domain grouping for autocomplete
 */
explorer.get('/accounts/:id/senders', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

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
        },
        400
      )
    }

    const search = c.req.query('search')
    const limit = Math.min(50, parseInt(c.req.query('limit') || '20', 10))

    const suggestions = await getSenderSuggestions(accountId, search, limit)

    return c.json({ suggestions })
  } catch (error) {
    logger.error('[Explorer] Error fetching senders:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to fetch senders: ${message}` }, 500)
  }
})

/**
 * GET /api/explorer/accounts/:id/categories
 * Get distinct categories for filter dropdown
 */
explorer.get('/accounts/:id/categories', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

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
        },
        400
      )
    }

    const categories = await getDistinctCategories(accountId)

    return c.json({ categories })
  } catch (error) {
    logger.error('[Explorer] Error fetching categories:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to fetch categories: ${message}` }, 500)
  }
})

// ============================================================================
// Subscriptions Endpoint
// ============================================================================

/**
 * Helper: Parse subscription filter query params
 */
function parseSubscriptionFilters(query: Record<string, string | undefined>): SubscriptionFilters {
  const filters: SubscriptionFilters = {}

  if (query.search) {
    filters.search = query.search
  }

  if (query.minCount) {
    const parsed = parseInt(query.minCount, 10)
    if (!isNaN(parsed)) filters.minCount = parsed
  }

  if (query.maxCount) {
    const parsed = parseInt(query.maxCount, 10)
    if (!isNaN(parsed)) filters.maxCount = parsed
  }

  if (query.minSize) {
    const parsed = parseInt(query.minSize, 10)
    if (!isNaN(parsed)) filters.minSize = parsed
  }

  if (query.maxSize) {
    const parsed = parseInt(query.maxSize, 10)
    if (!isNaN(parsed)) filters.maxSize = parsed
  }

  if (query.dateFrom) {
    const parsed = parseInt(query.dateFrom, 10)
    if (!isNaN(parsed)) filters.dateFrom = parsed
  }

  if (query.dateTo) {
    const parsed = parseInt(query.dateTo, 10)
    if (!isNaN(parsed)) filters.dateTo = parsed
  }

  if (
    query.sortBy &&
    ['count', 'size', 'first_date', 'latest_date', 'name'].includes(query.sortBy)
  ) {
    filters.sortBy = query.sortBy as SubscriptionFilters['sortBy']
  }

  if (query.sortOrder && ['asc', 'desc'].includes(query.sortOrder)) {
    filters.sortOrder = query.sortOrder as 'asc' | 'desc'
  }

  return filters
}

/**
 * GET /api/explorer/accounts/:id/subscriptions
 * Get senders with unsubscribe links for the subscriptions page
 * Includes unsubscribed senders with isUnsubscribed flag
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Page size (default: 50, max: 100)
 * - search: Search by sender name or email
 * - minCount, maxCount: Filter by email count
 * - minSize, maxSize: Filter by total size
 * - dateFrom, dateTo: Filter by first email date
 * - sortBy: count | size | first_date | latest_date | name
 * - sortOrder: asc | desc
 */
explorer.get('/accounts/:id/subscriptions', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

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
        },
        400
      )
    }

    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50', 10)))
    const offset = (page - 1) * limit

    // Parse filters
    const filters = parseSubscriptionFilters(c.req.query() as Record<string, string | undefined>)

    // Get unsubscribed sender emails for this account
    const unsubscribedRows = await db
      .select({ senderEmail: tables.unsubscribedSenders.senderEmail })
      .from(tables.unsubscribedSenders)
      .where(eq(tables.unsubscribedSenders.mailAccountId, accountId))

    const unsubscribedEmails = new Set(unsubscribedRows.map((r) => r.senderEmail.toLowerCase()))

    const { senders, total } = await getSendersWithUnsubscribe(accountId, limit, offset, filters)

    // Add isUnsubscribed flag - keep original order from query (by count or whatever sort is applied)
    const sendersWithStatus = senders.map((s) => ({
      ...s,
      isUnsubscribed: unsubscribedEmails.has(s.email.toLowerCase()),
    }))

    return c.json({
      subscriptions: sendersWithStatus,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
      filters,
    })
  } catch (error) {
    logger.error('[Explorer] Error fetching subscriptions:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to fetch subscriptions: ${message}` }, 500)
  }
})

/**
 * POST /api/explorer/accounts/:id/subscriptions/unsubscribe
 * Mark one or more senders as unsubscribed
 *
 * Body:
 * - senderEmail: string - single email address (for single unsubscribe)
 * - senderName: string | null - optional name of the sender
 * OR
 * - senders: Array<{ email: string; name?: string | null }> - bulk unsubscribe
 */
explorer.post('/accounts/:id/subscriptions/unsubscribe', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const body = await c.req.json<{
      senderEmail?: string
      senderName?: string | null
      senders?: Array<{ email: string; name?: string | null }>
    }>()

    // Handle bulk unsubscribe
    if (body.senders && Array.isArray(body.senders) && body.senders.length > 0) {
      // Get existing unsubscribed senders
      const existingRows = await db
        .select({ senderEmail: tables.unsubscribedSenders.senderEmail })
        .from(tables.unsubscribedSenders)
        .where(eq(tables.unsubscribedSenders.mailAccountId, accountId))

      const existingEmails = new Set(existingRows.map((r) => r.senderEmail.toLowerCase()))

      // Filter out already unsubscribed
      const newSenders = body.senders.filter((s) => !existingEmails.has(s.email.toLowerCase()))

      if (newSenders.length > 0) {
        // Insert new unsubscribed sender records
        await db.insert(tables.unsubscribedSenders).values(
          newSenders.map((s) => ({
            mailAccountId: accountId,
            senderEmail: s.email.toLowerCase(),
            senderName: s.name ?? null,
          }))
        )
      }

      const alreadyUnsubscribed = body.senders.length - newSenders.length

      logger.debug(
        `[Explorer] Bulk marked ${newSenders.length} senders as unsubscribed (${alreadyUnsubscribed} already unsubscribed) for account ${accountId}`
      )

      return c.json({
        success: true,
        message: `Marked ${newSenders.length} senders as unsubscribed`,
        markedCount: newSenders.length,
        alreadyUnsubscribedCount: alreadyUnsubscribed,
      })
    }

    // Handle single unsubscribe (backward compatible)
    if (!body.senderEmail) {
      return c.json({ error: 'senderEmail or senders array is required' }, 400)
    }

    // Check if already unsubscribed
    const existing = await db
      .select()
      .from(tables.unsubscribedSenders)
      .where(
        and(
          eq(tables.unsubscribedSenders.mailAccountId, accountId),
          eq(tables.unsubscribedSenders.senderEmail, body.senderEmail.toLowerCase())
        )
      )
      .limit(1)

    if (existing.length > 0) {
      return c.json({
        success: true,
        message: 'Sender was already marked as unsubscribed',
        alreadyUnsubscribed: true,
      })
    }

    // Insert new unsubscribed sender record
    await db.insert(tables.unsubscribedSenders).values({
      mailAccountId: accountId,
      senderEmail: body.senderEmail.toLowerCase(),
      senderName: body.senderName ?? null,
    })

    logger.debug(
      `[Explorer] Marked sender as unsubscribed: ${body.senderEmail} for account ${accountId}`
    )

    return c.json({
      success: true,
      message: 'Sender marked as unsubscribed',
      alreadyUnsubscribed: false,
    })
  } catch (error) {
    logger.error('[Explorer] Error marking sender as unsubscribed:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to mark as unsubscribed: ${message}` }, 500)
  }
})

/**
 * GET /api/explorer/accounts/:id/subscriptions/unsubscribed
 * Get list of senders the user has unsubscribed from
 */
explorer.get('/accounts/:id/subscriptions/unsubscribed', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

  try {
    const account = await getAccountForUser(userId, accountId)

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const unsubscribed = await db
      .select()
      .from(tables.unsubscribedSenders)
      .where(eq(tables.unsubscribedSenders.mailAccountId, accountId))

    return c.json({
      unsubscribed: unsubscribed.map((u) => ({
        email: u.senderEmail,
        name: u.senderName,
        unsubscribedAt: u.unsubscribedAt,
      })),
    })
  } catch (error) {
    logger.error('[Explorer] Error fetching unsubscribed senders:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to fetch unsubscribed senders: ${message}` }, 500)
  }
})

export default explorer
