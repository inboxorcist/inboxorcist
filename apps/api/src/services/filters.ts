/**
 * Gmail Filters & Labels Service
 *
 * Manage Gmail filters (rules) and labels via the Gmail API.
 * - Filters: Create, list, get, delete (no update - must delete and recreate)
 * - Labels: Create, list, get, update, delete
 */

import { gmail_v1 } from 'googleapis'
import { getGmailClient } from './gmail'
import { withRetry } from '../lib/retry'
import { logger } from '../lib/logger'

// ============================================================================
// Types
// ============================================================================

export interface FilterCriteria {
  from?: string
  to?: string
  subject?: string
  query?: string
  negatedQuery?: string
  hasAttachment?: boolean
  size?: number
  sizeComparison?: 'larger' | 'smaller'
  excludeChats?: boolean
}

export interface FilterAction {
  addLabelIds?: string[]
  removeLabelIds?: string[]
  forward?: string
}

export interface GmailFilter {
  id: string
  criteria: FilterCriteria
  action: FilterAction
}

export interface LabelColor {
  textColor: string
  backgroundColor: string
}

export interface GmailLabel {
  id: string
  name: string
  type: 'system' | 'user'
  messageListVisibility?: 'show' | 'hide'
  labelListVisibility?: 'labelShow' | 'labelShowIfUnread' | 'labelHide'
  messagesTotal?: number
  messagesUnread?: number
  threadsTotal?: number
  threadsUnread?: number
  color?: LabelColor
}

export interface CreateLabelRequest {
  name: string
  messageListVisibility?: 'show' | 'hide'
  labelListVisibility?: 'labelShow' | 'labelShowIfUnread' | 'labelHide'
  color?: LabelColor
}

export interface UpdateLabelRequest {
  name?: string
  messageListVisibility?: 'show' | 'hide'
  labelListVisibility?: 'labelShow' | 'labelShowIfUnread' | 'labelHide'
  color?: LabelColor
}

// ============================================================================
// Filter Operations
// ============================================================================

/**
 * Parse Gmail API filter response to our type
 */
function parseFilter(filter: gmail_v1.Schema$Filter): GmailFilter | null {
  if (!filter.id) return null

  const criteria: FilterCriteria = {}
  if (filter.criteria?.from) criteria.from = filter.criteria.from
  if (filter.criteria?.to) criteria.to = filter.criteria.to
  if (filter.criteria?.subject) criteria.subject = filter.criteria.subject
  if (filter.criteria?.query) criteria.query = filter.criteria.query
  if (filter.criteria?.negatedQuery) criteria.negatedQuery = filter.criteria.negatedQuery
  if (filter.criteria?.hasAttachment) criteria.hasAttachment = filter.criteria.hasAttachment
  if (filter.criteria?.size) criteria.size = filter.criteria.size
  if (filter.criteria?.sizeComparison) {
    criteria.sizeComparison = filter.criteria.sizeComparison as 'larger' | 'smaller'
  }
  if (filter.criteria?.excludeChats) criteria.excludeChats = filter.criteria.excludeChats

  const action: FilterAction = {}
  if (filter.action?.addLabelIds) action.addLabelIds = filter.action.addLabelIds
  if (filter.action?.removeLabelIds) action.removeLabelIds = filter.action.removeLabelIds
  if (filter.action?.forward) action.forward = filter.action.forward

  return {
    id: filter.id,
    criteria,
    action,
  }
}

/**
 * List all filters for an account
 */
export async function listFilters(accountId: string): Promise<GmailFilter[]> {
  const gmail = await getGmailClient(accountId)

  const response = await withRetry(
    async () => {
      return gmail.users.settings.filters.list({ userId: 'me' })
    },
    { maxRetries: 3 }
  )

  const filters = response.data.filter || []
  return filters.map(parseFilter).filter((f): f is GmailFilter => f !== null)
}

/**
 * Get a single filter by ID
 */
export async function getFilter(accountId: string, filterId: string): Promise<GmailFilter | null> {
  const gmail = await getGmailClient(accountId)

  try {
    const response = await withRetry(
      async () => {
        return gmail.users.settings.filters.get({ userId: 'me', id: filterId })
      },
      { maxRetries: 3 }
    )

    return parseFilter(response.data)
  } catch (error) {
    const err = error as { code?: number }
    if (err.code === 404) {
      return null
    }
    throw error
  }
}

/**
 * Create a new filter
 */
export async function createFilter(
  accountId: string,
  criteria: FilterCriteria,
  action: FilterAction
): Promise<GmailFilter> {
  const gmail = await getGmailClient(accountId)

  // Build Gmail API request body
  const requestBody: gmail_v1.Schema$Filter = {
    criteria: {},
    action: {},
  }

  // Map criteria
  if (criteria.from) requestBody.criteria!.from = criteria.from
  if (criteria.to) requestBody.criteria!.to = criteria.to
  if (criteria.subject) requestBody.criteria!.subject = criteria.subject
  if (criteria.query) requestBody.criteria!.query = criteria.query
  if (criteria.negatedQuery) requestBody.criteria!.negatedQuery = criteria.negatedQuery
  if (criteria.hasAttachment !== undefined)
    requestBody.criteria!.hasAttachment = criteria.hasAttachment
  if (criteria.size !== undefined) requestBody.criteria!.size = criteria.size
  if (criteria.sizeComparison) requestBody.criteria!.sizeComparison = criteria.sizeComparison
  if (criteria.excludeChats !== undefined)
    requestBody.criteria!.excludeChats = criteria.excludeChats

  // Map action
  if (action.addLabelIds && action.addLabelIds.length > 0) {
    requestBody.action!.addLabelIds = action.addLabelIds
  }
  if (action.removeLabelIds && action.removeLabelIds.length > 0) {
    requestBody.action!.removeLabelIds = action.removeLabelIds
  }
  if (action.forward) requestBody.action!.forward = action.forward

  const response = await withRetry(
    async () => {
      return gmail.users.settings.filters.create({
        userId: 'me',
        requestBody,
      })
    },
    { maxRetries: 3 }
  )

  const filter = parseFilter(response.data)
  if (!filter) {
    throw new Error('Failed to create filter: no ID returned')
  }

  logger.debug(`[Filters] Created filter ${filter.id} for account ${accountId}`)
  return filter
}

/**
 * Delete a filter
 */
export async function deleteFilter(accountId: string, filterId: string): Promise<void> {
  const gmail = await getGmailClient(accountId)

  await withRetry(
    async () => {
      return gmail.users.settings.filters.delete({ userId: 'me', id: filterId })
    },
    { maxRetries: 3 }
  )

  logger.debug(`[Filters] Deleted filter ${filterId} for account ${accountId}`)
}

/**
 * Update a filter (delete and recreate since Gmail API has no update)
 */
export async function updateFilter(
  accountId: string,
  filterId: string,
  criteria: FilterCriteria,
  action: FilterAction
): Promise<GmailFilter> {
  // Delete the old filter
  await deleteFilter(accountId, filterId)

  // Create new filter with updated settings
  const newFilter = await createFilter(accountId, criteria, action)

  logger.debug(`[Filters] Updated filter ${filterId} -> ${newFilter.id} for account ${accountId}`)
  return newFilter
}

// ============================================================================
// Label Operations
// ============================================================================

/**
 * Parse Gmail API label response to our type
 */
function parseLabel(label: gmail_v1.Schema$Label): GmailLabel | null {
  if (!label.id || !label.name) return null

  const result: GmailLabel = {
    id: label.id,
    name: label.name,
    type: label.type === 'system' ? 'system' : 'user',
  }

  if (label.messageListVisibility) {
    result.messageListVisibility = label.messageListVisibility as 'show' | 'hide'
  }
  if (label.labelListVisibility) {
    result.labelListVisibility = label.labelListVisibility as
      | 'labelShow'
      | 'labelShowIfUnread'
      | 'labelHide'
  }
  if (label.messagesTotal != null) result.messagesTotal = label.messagesTotal
  if (label.messagesUnread != null) result.messagesUnread = label.messagesUnread
  if (label.threadsTotal != null) result.threadsTotal = label.threadsTotal
  if (label.threadsUnread != null) result.threadsUnread = label.threadsUnread
  if (label.color) {
    result.color = {
      textColor: label.color.textColor || '#000000',
      backgroundColor: label.color.backgroundColor || '#ffffff',
    }
  }

  return result
}

/**
 * List all labels for an account
 */
export async function listLabels(accountId: string): Promise<GmailLabel[]> {
  const gmail = await getGmailClient(accountId)

  const response = await withRetry(
    async () => {
      return gmail.users.labels.list({ userId: 'me' })
    },
    { maxRetries: 3 }
  )

  const labels = response.data.labels || []
  return labels.map(parseLabel).filter((l): l is GmailLabel => l !== null)
}

/**
 * Get a single label by ID
 */
export async function getLabel(accountId: string, labelId: string): Promise<GmailLabel | null> {
  const gmail = await getGmailClient(accountId)

  try {
    const response = await withRetry(
      async () => {
        return gmail.users.labels.get({ userId: 'me', id: labelId })
      },
      { maxRetries: 3 }
    )

    return parseLabel(response.data)
  } catch (error) {
    const err = error as { code?: number }
    if (err.code === 404) {
      return null
    }
    throw error
  }
}

/**
 * Create a new label
 */
export async function createLabel(
  accountId: string,
  request: CreateLabelRequest
): Promise<GmailLabel> {
  const gmail = await getGmailClient(accountId)

  const requestBody: gmail_v1.Schema$Label = {
    name: request.name,
    labelListVisibility: request.labelListVisibility || 'labelShow',
    messageListVisibility: request.messageListVisibility || 'show',
  }

  if (request.color) {
    requestBody.color = {
      textColor: request.color.textColor,
      backgroundColor: request.color.backgroundColor,
    }
  }

  const response = await withRetry(
    async () => {
      return gmail.users.labels.create({
        userId: 'me',
        requestBody,
      })
    },
    { maxRetries: 3 }
  )

  const label = parseLabel(response.data)
  if (!label) {
    throw new Error('Failed to create label: no ID returned')
  }

  logger.debug(`[Labels] Created label ${label.id} "${label.name}" for account ${accountId}`)
  return label
}

/**
 * Update an existing label
 */
export async function updateLabel(
  accountId: string,
  labelId: string,
  request: UpdateLabelRequest
): Promise<GmailLabel> {
  const gmail = await getGmailClient(accountId)

  const requestBody: gmail_v1.Schema$Label = {}

  if (request.name !== undefined) requestBody.name = request.name
  if (request.labelListVisibility !== undefined) {
    requestBody.labelListVisibility = request.labelListVisibility
  }
  if (request.messageListVisibility !== undefined) {
    requestBody.messageListVisibility = request.messageListVisibility
  }
  if (request.color !== undefined) {
    requestBody.color = {
      textColor: request.color.textColor,
      backgroundColor: request.color.backgroundColor,
    }
  }

  const response = await withRetry(
    async () => {
      return gmail.users.labels.patch({
        userId: 'me',
        id: labelId,
        requestBody,
      })
    },
    { maxRetries: 3 }
  )

  const label = parseLabel(response.data)
  if (!label) {
    throw new Error('Failed to update label: no data returned')
  }

  logger.debug(`[Labels] Updated label ${labelId} for account ${accountId}`)
  return label
}

/**
 * Delete a label
 */
export async function deleteLabel(accountId: string, labelId: string): Promise<void> {
  const gmail = await getGmailClient(accountId)

  await withRetry(
    async () => {
      return gmail.users.labels.delete({ userId: 'me', id: labelId })
    },
    { maxRetries: 3 }
  )

  logger.debug(`[Labels] Deleted label ${labelId} for account ${accountId}`)
}

// ============================================================================
// Apply Filter to Existing Emails
// ============================================================================

/**
 * Strip surrounding quotes from a search term
 * Users may enter "exact phrase" with quotes for Gmail search syntax
 */
function stripQuotes(term: string): string {
  return term.replace(/^["']|["']$/g, '')
}

/**
 * Build Gmail search query from filter criteria
 * Note: We strip surrounding quotes from fields to ensure consistent behavior
 * between the local DB test query and Gmail API queries
 */
export function buildQueryFromCriteria(criteria: FilterCriteria): string {
  const parts: string[] = []

  if (criteria.from) parts.push(`from:${stripQuotes(criteria.from)}`)
  if (criteria.to) parts.push(`to:${stripQuotes(criteria.to)}`)
  if (criteria.subject) parts.push(`subject:${stripQuotes(criteria.subject)}`)
  if (criteria.query) parts.push(stripQuotes(criteria.query))
  if (criteria.negatedQuery) parts.push(`-{${stripQuotes(criteria.negatedQuery)}}`)
  if (criteria.hasAttachment) parts.push('has:attachment')
  if (criteria.size && criteria.sizeComparison) {
    parts.push(`${criteria.sizeComparison}:${criteria.size}`)
  }

  return parts.join(' ')
}

/**
 * Get count of emails matching filter criteria
 */
export async function getMatchingEmailCount(
  accountId: string,
  criteria: FilterCriteria
): Promise<number> {
  const gmail = await getGmailClient(accountId)
  const query = buildQueryFromCriteria(criteria)

  if (!query) {
    return 0
  }

  const response = await withRetry(
    async () => {
      return gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 1,
        includeSpamTrash: true,
      })
    },
    { maxRetries: 3 }
  )

  return response.data.resultSizeEstimate || 0
}

export interface FilterTestResult {
  count: number
  samples: Array<{
    from: string
    subject: string
    date: string
  }>
}

/**
 * Test filter criteria by getting count and sample emails from Gmail API
 * This ensures the preview count matches what "apply to existing" will affect
 */
export async function testFilterCriteria(
  accountId: string,
  criteria: FilterCriteria
): Promise<FilterTestResult> {
  const gmail = await getGmailClient(accountId)
  const query = buildQueryFromCriteria(criteria)

  if (!query) {
    return { count: 0, samples: [] }
  }

  // Get all matching message IDs to get accurate count
  const messageIds: string[] = []
  let pageToken: string | undefined

  do {
    const response = await withRetry(
      async () => {
        return gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: 500,
          pageToken,
          includeSpamTrash: true,
        })
      },
      { maxRetries: 3 }
    )

    const messages = response.data.messages || []
    messageIds.push(...messages.map((m) => m.id!).filter(Boolean))

    pageToken = response.data.nextPageToken || undefined
  } while (pageToken)

  const totalCount = messageIds.length

  if (totalCount === 0) {
    return { count: 0, samples: [] }
  }

  // Fetch details for sample emails (up to 5)
  const samplePromises = messageIds.slice(0, 5).map(async (msgId) => {
    try {
      const detail = await withRetry(
        async () => {
          return gmail.users.messages.get({
            userId: 'me',
            id: msgId,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date'],
          })
        },
        { maxRetries: 2 }
      )

      const headers = detail.data.payload?.headers || []
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || ''

      // Parse the from header to get just the name/email
      const fromHeader = getHeader('From')
      const fromMatch = fromHeader.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]*)>?$/)
      const fromDisplay = fromMatch
        ? fromMatch[1]?.trim() || fromMatch[2] || fromHeader
        : fromHeader

      // Format date
      const dateHeader = getHeader('Date')
      let dateDisplay = ''
      if (dateHeader) {
        try {
          const date = new Date(dateHeader)
          const now = new Date()
          dateDisplay = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
          })
        } catch {
          dateDisplay = dateHeader.split(' ').slice(0, 4).join(' ')
        }
      }

      return {
        from: fromDisplay,
        subject: getHeader('Subject') || '(No subject)',
        date: dateDisplay,
      }
    } catch {
      return null
    }
  })

  const samplesWithNulls = await Promise.all(samplePromises)
  const samples = samplesWithNulls.filter((s): s is NonNullable<typeof s> => s !== null)

  return { count: totalCount, samples }
}

/**
 * Apply filter actions to existing emails matching the criteria
 * Returns the number of emails modified
 */
export async function applyFilterToExisting(
  accountId: string,
  criteria: FilterCriteria,
  action: FilterAction,
  onProgress?: (processed: number, total: number) => void
): Promise<{ modified: number; failed: number }> {
  const gmail = await getGmailClient(accountId)
  const query = buildQueryFromCriteria(criteria)

  if (!query) {
    return { modified: 0, failed: 0 }
  }

  // Collect all matching message IDs
  const messageIds: string[] = []
  let pageToken: string | undefined

  do {
    const response = await withRetry(
      async () => {
        return gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: 500,
          pageToken,
          includeSpamTrash: true,
        })
      },
      { maxRetries: 3 }
    )

    const messages = response.data.messages || []
    messageIds.push(...messages.map((m) => m.id!).filter(Boolean))

    pageToken = response.data.nextPageToken || undefined
  } while (pageToken)

  if (messageIds.length === 0) {
    return { modified: 0, failed: 0 }
  }

  logger.debug(
    `[Filters] Applying filter to ${messageIds.length} existing emails for account ${accountId}`
  )

  // Apply actions in batches of 1000 (Gmail's limit for batchModify)
  const BATCH_SIZE = 1000
  let modified = 0
  let failed = 0

  for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
    const batch = messageIds.slice(i, i + BATCH_SIZE)

    try {
      await withRetry(
        async () => {
          return gmail.users.messages.batchModify({
            userId: 'me',
            requestBody: {
              ids: batch,
              addLabelIds: action.addLabelIds || [],
              removeLabelIds: action.removeLabelIds || [],
            },
          })
        },
        { maxRetries: 3 }
      )

      modified += batch.length
    } catch (error) {
      logger.error(`[Filters] Failed to apply filter to batch of ${batch.length} emails:`, error)
      failed += batch.length
    }

    if (onProgress) {
      onProgress(modified + failed, messageIds.length)
    }
  }

  logger.debug(`[Filters] Applied filter: ${modified} modified, ${failed} failed`)
  return { modified, failed }
}

/**
 * Modify labels on specific emails
 * Add and/or remove labels from a list of message IDs
 */
export async function modifyLabels(
  accountId: string,
  messageIds: string[],
  options: {
    addLabelIds?: string[]
    removeLabelIds?: string[]
  }
): Promise<{ modified: number; failed: number }> {
  if (messageIds.length === 0) {
    return { modified: 0, failed: 0 }
  }

  const gmail = await getGmailClient(accountId)
  const BATCH_SIZE = 1000
  let modified = 0
  let failed = 0

  for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
    const batch = messageIds.slice(i, i + BATCH_SIZE)

    try {
      await withRetry(
        async () => {
          return gmail.users.messages.batchModify({
            userId: 'me',
            requestBody: {
              ids: batch,
              addLabelIds: options.addLabelIds || [],
              removeLabelIds: options.removeLabelIds || [],
            },
          })
        },
        { maxRetries: 3 }
      )

      modified += batch.length
    } catch (error) {
      logger.error(`[Filters] Failed to modify labels on batch of ${batch.length} emails:`, error)
      failed += batch.length
    }
  }

  logger.debug(`[Filters] Modified labels: ${modified} modified, ${failed} failed`)
  return { modified, failed }
}
