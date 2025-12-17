/**
 * Gmail API service for email metadata operations
 *
 * Two-step sync:
 * - Step 1: Quick stats using messages.list with query filters
 * - Step 2: Full metadata sync using messages.get for each email
 */

import { google, gmail_v1 } from 'googleapis'
import { getAuthenticatedClient } from './oauth'
import { withRetry, isRetryableError, getRetryAfter } from '../lib/retry'
import { AdaptiveThrottle } from '../lib/throttle'
import type { EmailRecord } from '../lib/emails-db'

/**
 * Get Gmail API client for an account
 */
export async function getGmailClient(accountId: string): Promise<gmail_v1.Gmail> {
  const auth = await getAuthenticatedClient(accountId)
  return google.gmail({ version: 'v1', auth })
}

// ============================================================================
// STEP 1: Quick Stats
// ============================================================================

/**
 * Label IDs for Gmail categories
 */
const _CATEGORY_LABELS = {
  promotions: 'CATEGORY_PROMOTIONS',
  social: 'CATEGORY_SOCIAL',
  updates: 'CATEGORY_UPDATES',
  forums: 'CATEGORY_FORUMS',
  primary: 'CATEGORY_PERSONAL', // Primary inbox
} as const

/**
 * Get accurate message count for a label using Labels API
 * This is more accurate than resultSizeEstimate from messages.list
 */
async function _getLabelCount(gmail: gmail_v1.Gmail, labelId: string): Promise<number> {
  try {
    const response = await gmail.users.labels.get({
      userId: 'me',
      id: labelId,
    })
    return response.data.messagesTotal || 0
  } catch (error) {
    // Label might not exist (e.g., categories not enabled)
    console.warn(`[Gmail] Could not get count for label ${labelId}:`, error)
    return 0
  }
}

/**
 * Get a count estimate using messages.list with a query
 * Note: resultSizeEstimate can be inaccurate for large mailboxes
 */
async function _getMessageCountByQuery(gmail: gmail_v1.Gmail, query: string): Promise<number> {
  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 1,
    includeSpamTrash: true,
    q: query,
  })

  return response.data.resultSizeEstimate || 0
}

/**
 * Quick stats result - minimal data needed before sync
 */
export interface QuickStatsResult {
  total: number
}

/**
 * Get quick stats (total message count) from Gmail API
 *
 * Uses Profile API for accurate total count.
 * Takes ~1-2 seconds depending on network latency.
 *
 * @param accountId - The Gmail account ID
 * @returns Quick stats with total message count
 */
export async function getQuickStats(accountId: string): Promise<QuickStatsResult> {
  const gmail = await getGmailClient(accountId)

  // Get profile for accurate total
  const profileResult = await gmail.users.getProfile({ userId: 'me' })
  const total = profileResult.data.messagesTotal || 0

  return { total }
}

// ============================================================================
// STEP 2: Full Metadata Sync
// ============================================================================

/**
 * Parsed email address
 */
interface ParsedEmail {
  email: string
  name: string | null
}

/**
 * Parse email address from "From" header
 *
 * Handles formats like:
 * - "John Doe <john@example.com>"
 * - "<john@example.com>"
 * - "john@example.com"
 */
export function parseEmailAddress(header: string | null | undefined): ParsedEmail {
  if (!header) {
    return { email: 'unknown@unknown.com', name: null }
  }

  // Pattern: optional "Name" <email> or just email
  const match = header.match(/"?([^"<]*)"?\s*<?([^\s<>]+@[^\s<>]+)>?/)

  if (match) {
    const name = match[1]?.trim() || null
    const email = match[2]?.toLowerCase() || header.toLowerCase()
    return { email, name: name || null }
  }

  // Fallback: treat the whole thing as an email
  return { email: header.toLowerCase().trim(), name: null }
}

/**
 * Get a specific header value from message headers
 */
function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string | null {
  if (!headers) return null
  const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
  return header?.value || null
}

/**
 * Extract category label from label IDs
 *
 * Gmail categories use CATEGORY_* prefix (e.g., CATEGORY_PROMOTIONS).
 * Special handling for SENT emails which don't have a CATEGORY_ prefix.
 */
function findCategory(labelIds: string[] | null | undefined): string | null {
  if (!labelIds) return null

  // Check for CATEGORY_* labels first (Promotions, Social, Updates, Forums, Primary)
  for (const label of labelIds) {
    if (label.startsWith('CATEGORY_')) {
      return label
    }
  }

  // Check for special labels that don't have a CATEGORY_ prefix
  if (labelIds.includes('SENT')) {
    return 'SENT'
  }

  if (labelIds.includes('SPAM')) {
    return 'SPAM'
  }

  if (labelIds.includes('TRASH')) {
    return 'TRASH'
  }

  // Note: DRAFT requires separate drafts.list API, not included in messages.list

  return null
}

/**
 * Check if message has attachments
 */
function hasAttachments(message: gmail_v1.Schema$Message): boolean {
  const parts = message.payload?.parts
  if (!parts) return false

  return parts.some((part) => {
    // Check for attachment disposition
    if (part.filename && part.filename.length > 0) {
      return true
    }
    // Recursively check nested parts
    if (part.parts) {
      return part.parts.some((p) => p.filename && p.filename.length > 0)
    }
    return false
  })
}

/**
 * Safely parse a number, returning 0 for invalid values
 */
function safeNumber(value: unknown, defaultValue = 0): number {
  if (value === null || value === undefined) return defaultValue
  const num = typeof value === 'string' ? parseInt(value, 10) : Number(value)
  return Number.isFinite(num) ? num : defaultValue
}

/**
 * Parse a Gmail message into an EmailRecord
 */
export function parseMessage(message: gmail_v1.Schema$Message): EmailRecord | null {
  if (!message.id) {
    return null
  }

  const headers = message.payload?.headers
  const fromHeader = getHeader(headers, 'From')
  const { email: fromEmail, name: fromName } = parseEmailAddress(fromHeader)
  const labels = message.labelIds || []

  // Ensure all numeric values are valid integers for SQLite
  const sizeBytes = safeNumber(message.sizeEstimate, 0)
  const internalDate = safeNumber(message.internalDate, 0)

  return {
    gmail_id: message.id,
    thread_id: message.threadId || '',
    subject: getHeader(headers, 'Subject'),
    snippet: message.snippet || null,
    from_email: fromEmail,
    from_name: fromName,
    labels: JSON.stringify(labels),
    category: findCategory(labels),
    size_bytes: sizeBytes,
    has_attachments: hasAttachments(message) ? 1 : 0,
    is_unread: labels.includes('UNREAD') ? 1 : 0,
    is_starred: labels.includes('STARRED') ? 1 : 0,
    is_trash: labels.includes('TRASH') ? 1 : 0,
    is_spam: labels.includes('SPAM') ? 1 : 0,
    is_important: labels.includes('IMPORTANT') ? 1 : 0,
    internal_date: internalDate,
    synced_at: Date.now(),
  }
}

/**
 * Fetch message details for a batch of message IDs
 *
 * Uses controlled concurrency to avoid Gmail API rate limits.
 * Gmail allows ~250 quota units/second, each messages.get is 5 units.
 * So max ~50 requests/second, but we stay conservative at ~15-20/sec.
 *
 * Gets fresh client periodically to handle token refresh during long syncs.
 *
 * @param accountId - Gmail account ID (used to get fresh client with valid token)
 * @param messageIds - Array of message IDs to fetch
 * @param throttle - Adaptive throttle for rate limiting
 * @param onProgress - Optional callback for progress updates
 * @returns Array of parsed email records
 */
export async function fetchMessageDetails(
  accountId: string,
  messageIds: Array<{ id: string }>,
  throttle: AdaptiveThrottle,
  onProgress?: (processed: number, failed: number) => void,
  totalMessages?: number // Total messages across all pages for ETA calculation
): Promise<EmailRecord[]> {
  const CONCURRENCY = 15 // Concurrent requests
  const CLIENT_REFRESH_INTERVAL = 30 * 60 * 1000 // Refresh client every 30 minutes
  const results: EmailRecord[] = []
  const startTime = Date.now()
  let processed = 0
  let failed = 0
  let gmail = await getGmailClient(accountId)
  let lastClientRefresh = Date.now()

  console.log(
    `[${new Date().toISOString()}] [Gmail] Starting fetch of ${messageIds.length} messages`
  )

  // Process with controlled concurrency
  for (let i = 0; i < messageIds.length; i += CONCURRENCY) {
    const batch = messageIds.slice(i, i + CONCURRENCY)

    // Periodically refresh the client to ensure valid tokens
    if (Date.now() - lastClientRefresh > CLIENT_REFRESH_INTERVAL) {
      console.log('[Gmail] Refreshing client to ensure valid token...')
      gmail = await getGmailClient(accountId)
      lastClientRefresh = Date.now()
    }

    // Wait for throttle before each small batch
    await throttle.wait()

    // Fetch small batch in parallel
    // Using format: "metadata" - includes headers and parts structure but not body content
    // This is much faster than "full" while still providing attachment info
    const batchPromises = batch.map(({ id }) =>
      withRetry(
        async () => {
          const response = await gmail.users.messages.get({
            userId: 'me',
            id,
            format: 'metadata',
          })
          return response.data
        },
        {
          maxRetries: 3,
          baseDelay: 2000,
          onRetry: (error, attempt) => {
            console.log(`[Gmail] Retry ${attempt} for message ${id}: ${error.message}`)
            if (isRetryableError(error)) {
              const retryAfter = getRetryAfter(error)
              if (retryAfter) {
                throttle.onRateLimit(retryAfter)
              } else {
                throttle.onRateLimit(30000)
              }
            }
          },
        }
      ).catch((error) => {
        console.error(`[Gmail] Failed to fetch message ${id}:`, error.message)
        failed++
        throttle.onError()
        return null
      })
    )

    const batchResults = await Promise.all(batchPromises)

    // Parse successful results
    for (const message of batchResults) {
      if (message) {
        const parsed = parseMessage(message)
        if (parsed) {
          results.push(parsed)
        }
        throttle.onSuccess()
      }
    }

    processed += batch.length

    // Report progress every 500 messages
    if (onProgress && processed % 500 < CONCURRENCY) {
      const elapsed = Date.now() - startTime
      const rate = processed / (elapsed / 1000)
      // Use totalMessages if provided for accurate ETA, otherwise use page size
      const total = totalMessages || messageIds.length
      const etaSeconds = total / rate
      console.log(
        `[${new Date().toISOString()}] [Gmail] Progress: ${processed}/${messageIds.length} (${((processed / messageIds.length) * 100).toFixed(1)}%) | Rate: ${rate.toFixed(1)} msg/sec | Total ETA: ${Math.round(etaSeconds / 60)} min`
      )
      onProgress(processed, failed)
    }
  }

  // Final progress update
  if (onProgress) {
    onProgress(processed, failed)
  }

  const totalTime = (Date.now() - startTime) / 1000
  const finalRate = processed / totalTime
  console.log(
    `[${new Date().toISOString()}] [Gmail] Completed: ${results.length} messages in ${Math.round(totalTime)}s (${finalRate.toFixed(1)} msg/sec) | Failed: ${failed}`
  )

  return results
}

/**
 * List all message IDs from Gmail (paginated)
 *
 * Generator function that yields pages of message IDs.
 * Gets a fresh client for each page to handle token refresh during long syncs.
 */
export async function* listAllMessageIds(
  accountId: string,
  options: {
    pageToken?: string
    onPage?: (pageNumber: number, totalFetched: number) => void
  } = {}
): AsyncGenerator<{ ids: Array<{ id: string }>; nextPageToken: string | null }> {
  let pageToken = options.pageToken || undefined
  let pageNumber = 0
  let totalFetched = 0

  while (true) {
    pageNumber++

    // Get fresh client for each page to handle token refresh
    const gmail = await getGmailClient(accountId)

    const response = await withRetry(
      async () => {
        return gmail.users.messages.list({
          userId: 'me',
          maxResults: 500,
          pageToken,
          includeSpamTrash: true,
          fields: 'messages(id),nextPageToken,resultSizeEstimate',
        })
      },
      { maxRetries: 3 }
    )

    const messages = response.data.messages || []
    const ids = messages.map((m) => ({ id: m.id! })).filter((m) => m.id)

    totalFetched += ids.length

    if (options.onPage) {
      options.onPage(pageNumber, totalFetched)
    }

    yield {
      ids,
      nextPageToken: response.data.nextPageToken || null,
    }

    if (!response.data.nextPageToken || messages.length === 0) {
      break
    }

    pageToken = response.data.nextPageToken
  }
}

// ============================================================================
// Delta Sync (History API)
// ============================================================================

/**
 * History record from Gmail API
 */
export interface HistoryChange {
  messagesAdded: Array<{ id: string }>
  messagesDeleted: Array<{ id: string }>
  labelsAdded: Array<{ id: string; labelIds: string[] }>
  labelsRemoved: Array<{ id: string; labelIds: string[] }>
}

/**
 * Get the current historyId from Gmail profile
 */
export async function getCurrentHistoryId(accountId: string): Promise<string> {
  const gmail = await getGmailClient(accountId)
  const profile = await gmail.users.getProfile({ userId: 'me' })
  return profile.data.historyId || '0'
}

/**
 * Fetch history changes since a given historyId
 *
 * Uses Gmail's History API to get incremental changes.
 * This is much more efficient than full sync for catching up after initial sync.
 *
 * @param accountId - Gmail account ID
 * @param startHistoryId - The historyId from which to start fetching changes
 * @returns Object containing added/deleted message IDs and the new historyId
 */
export async function fetchHistoryChanges(
  accountId: string,
  startHistoryId: string
): Promise<{
  messagesAdded: string[]
  messagesDeleted: string[]
  newHistoryId: string
}> {
  const gmail = await getGmailClient(accountId)

  const messagesAdded = new Set<string>()
  const messagesDeleted = new Set<string>()
  let pageToken: string | undefined
  let newHistoryId = startHistoryId

  console.log(`[Gmail] Fetching history changes since historyId ${startHistoryId}`)

  try {
    do {
      const response = await withRetry(
        async () => {
          return gmail.users.history.list({
            userId: 'me',
            startHistoryId,
            pageToken,
            historyTypes: ['messageAdded', 'messageDeleted'],
          })
        },
        { maxRetries: 3 }
      )

      const history = response.data.history || []

      for (const record of history) {
        // Track added messages
        if (record.messagesAdded) {
          for (const msg of record.messagesAdded) {
            if (msg.message?.id) {
              messagesAdded.add(msg.message.id)
              // If a message was added then deleted, remove from added
              messagesDeleted.delete(msg.message.id)
            }
          }
        }

        // Track deleted messages
        if (record.messagesDeleted) {
          for (const msg of record.messagesDeleted) {
            if (msg.message?.id) {
              messagesDeleted.add(msg.message.id)
              // If a message was deleted then re-added, remove from deleted
              messagesAdded.delete(msg.message.id)
            }
          }
        }
      }

      // Update historyId from response
      if (response.data.historyId) {
        newHistoryId = response.data.historyId
      }

      pageToken = response.data.nextPageToken || undefined
    } while (pageToken)

    console.log(
      `[Gmail] History changes: ${messagesAdded.size} added, ${messagesDeleted.size} deleted`
    )

    return {
      messagesAdded: Array.from(messagesAdded),
      messagesDeleted: Array.from(messagesDeleted),
      newHistoryId,
    }
  } catch (error) {
    const errorObj = error as { code?: number; message?: string }

    // If historyId is too old (expired), we need a full sync
    if (errorObj.code === 404 || errorObj.message?.includes('Start history id')) {
      console.log('[Gmail] History expired, full sync required')
      throw new Error('HISTORY_EXPIRED')
    }

    throw error
  }
}

// ============================================================================
// Email Operations (for cleanup)
// ============================================================================

/**
 * Batch delete messages permanently
 * Max 1000 messages per call
 */
export async function batchDeleteMessages(accountId: string, messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return
  if (messageIds.length > 1000) {
    throw new Error('Cannot delete more than 1000 messages at once')
  }

  const gmail = await getGmailClient(accountId)

  await withRetry(
    async () => {
      await gmail.users.messages.batchDelete({
        userId: 'me',
        requestBody: {
          ids: messageIds,
        },
      })
    },
    { maxRetries: 3 }
  )
}

/**
 * Move messages to trash using batchModify (much faster than individual calls)
 * Processes up to 1000 messages per batch
 */
export async function trashMessages(
  accountId: string,
  messageIds: string[],
  _throttle?: AdaptiveThrottle
): Promise<{ succeeded: number; failed: number }> {
  if (messageIds.length === 0) {
    return { succeeded: 0, failed: 0 }
  }

  const gmail = await getGmailClient(accountId)
  const BATCH_SIZE = 1000 // Gmail's limit for batchModify

  let succeeded = 0
  let failed = 0

  // Process in batches of 1000
  for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
    const batch = messageIds.slice(i, i + BATCH_SIZE)

    try {
      await withRetry(
        async () => {
          await gmail.users.messages.batchModify({
            userId: 'me',
            requestBody: {
              ids: batch,
              addLabelIds: ['TRASH'],
              removeLabelIds: ['INBOX'],
            },
          })
        },
        { maxRetries: 3 }
      )
      succeeded += batch.length
      console.log(
        `[Gmail] Trashed batch of ${batch.length} messages (${succeeded}/${messageIds.length})`
      )
    } catch (error) {
      console.error(`[Gmail] Failed to trash batch of ${batch.length} messages:`, error)
      failed += batch.length
    }
  }

  return { succeeded, failed }
}

/**
 * Get message IDs matching a query
 */
export async function getMessageIdsByQuery(
  accountId: string,
  query: string,
  maxResults = 500
): Promise<string[]> {
  const gmail = await getGmailClient(accountId)
  const ids: string[] = []
  let pageToken: string | undefined

  while (ids.length < maxResults) {
    const response = await withRetry(
      async () => {
        return gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: Math.min(500, maxResults - ids.length),
          pageToken,
          includeSpamTrash: true,
        })
      },
      { maxRetries: 3 }
    )

    const messages = response.data.messages || []
    ids.push(...messages.map((m) => m.id!).filter(Boolean))

    if (!response.data.nextPageToken || messages.length === 0) {
      break
    }

    pageToken = response.data.nextPageToken
  }

  return ids
}
