/**
 * Email Service
 *
 * Database operations for email metadata.
 * All emails are stored in the main database with mailAccountId for multi-tenancy.
 */

import { sql, eq, and, or, gt, lt, gte, lte, like, desc, asc, count, inArray } from 'drizzle-orm'
import { db, tables } from '../db'
import { logger } from '../lib/logger'

const { emails, senders, deletedEmails } = tables

// ============================================================================
// Types
// ============================================================================

/**
 * Email metadata record for database operations
 */
/**
 * Attachment metadata
 */
export interface AttachmentMeta {
  filename: string
  mimeType: string
  size: number
}

export interface EmailRecord {
  message_id: string // Provider's message ID
  thread_id: string
  subject: string | null
  snippet: string | null
  from_email: string
  from_name: string | null
  labels: string // JSON array
  category: string | null
  size_bytes: number
  has_attachments: number // count of attachments
  attachments: string | null // JSON array of AttachmentMeta
  is_unread: number // 0 or 1
  is_starred: number // 0 or 1
  is_trash: number // 0 or 1
  is_spam: number // 0 or 1
  is_important: number // 0 or 1
  internal_date: number // Unix timestamp in ms
  synced_at: number // Unix timestamp in ms
  unsubscribe_link: string | null // List-Unsubscribe header URL
}

/**
 * Sender aggregation stored after sync completes
 */
export interface SenderRecord {
  email: string
  name: string | null
  count: number
  total_size: number
}

/**
 * Sender with unsubscribe link for subscriptions page
 */
export interface SenderWithUnsubscribe {
  email: string
  name: string | null
  count: number
  total_size: number
  unsubscribe_link: string | null
  first_date: number
  latest_date: number
}

/**
 * Filter options for subscriptions query
 */
export interface SubscriptionFilters {
  search?: string
  minCount?: number
  maxCount?: number
  minSize?: number
  maxSize?: number
  dateFrom?: number
  dateTo?: number
  sortBy?: 'count' | 'size' | 'first_date' | 'latest_date' | 'name'
  sortOrder?: 'asc' | 'desc'
}

/**
 * Filter options for querying emails
 */
export interface ExplorerFilters {
  sender?: string // Partial match on sender name OR email (single value, e.g., "Coursera", "amazon")
  senderEmail?: string // Comma-separated exact email addresses (e.g., "a@example.com,b@example.com")
  senderDomain?: string // Comma-separated exact domains (e.g., "example.com,test.com")
  category?: string
  dateFrom?: number // Unix timestamp ms
  dateTo?: number // Unix timestamp ms
  sizeMin?: number // bytes
  sizeMax?: number // bytes
  isUnread?: boolean
  isStarred?: boolean
  hasAttachments?: boolean
  isTrash?: boolean
  isSpam?: boolean
  isImportant?: boolean
  isSent?: boolean // Emails with SENT label
  isArchived?: boolean // Emails without INBOX label (not in inbox, trash, or spam)
  labelIds?: string // Comma-separated label IDs (user labels)
  search?: string // Subject search
  sortBy?: 'date' | 'size' | 'sender'
  sortOrder?: 'asc' | 'desc'
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number
  limit: number
}

export interface SenderSuggestion {
  type: 'domain' | 'email'
  value: string
  label: string
  count: number
}

export interface TopSender {
  email: string
  name: string | null
  count: number
}

export interface AnalysisResults {
  size: {
    larger5MB: number
    larger10MB: number
    totalStorageBytes: number
  }
  age: {
    olderThan1Year: number
    olderThan2Years: number
    olderThan3Years: number
  }
}

export interface CalculatedStats {
  total: number
  unread: number
  categories: {
    promotions: number
    social: number
    updates: number
    forums: number
    primary: number
  }
  size: {
    larger5MB: number
    larger10MB: number
    totalStorageBytes: number
    trashStorageBytes: number
  }
  age: {
    olderThan1Year: number
    olderThan2Years: number
  }
  senders: {
    uniqueCount: number
  }
  trash: {
    count: number
    sizeBytes: number
  }
  spam: {
    count: number
    sizeBytes: number
  }
  cleanup: {
    promotions: { count: number; size: number }
    social: { count: number; size: number }
    updates: { count: number; size: number }
    forums: { count: number; size: number }
    readPromotions: { count: number; size: number }
    olderThan1Year: { count: number; size: number }
    olderThan2Years: { count: number; size: number }
    larger5MB: { count: number; size: number }
    larger10MB: { count: number; size: number }
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Safely convert to number for INTEGER columns
 */
function toSafeInt(value: unknown): number {
  if (value === null || value === undefined) return 0
  const num = Number(value)
  return Number.isFinite(num) ? Math.floor(num) : 0
}

/**
 * Convert Drizzle result to SenderRecord
 */
function toSenderRecord(row: typeof senders.$inferSelect): SenderRecord {
  return {
    email: row.email,
    name: row.name,
    count: row.count ?? 0,
    total_size: Number(row.totalSize ?? 0),
  }
}

/**
 * Convert Drizzle result to EmailRecord
 */
function toEmailRecord(row: typeof emails.$inferSelect): EmailRecord {
  return {
    message_id: row.messageId,
    thread_id: row.threadId ?? '',
    subject: row.subject,
    snippet: row.snippet,
    from_email: row.fromEmail,
    from_name: row.fromName,
    labels: row.labels ?? '[]',
    category: row.category,
    size_bytes: row.sizeBytes ?? 0,
    has_attachments: row.hasAttachments ?? 0,
    attachments: row.attachments ?? null,
    is_unread: row.isUnread ?? 0,
    is_starred: row.isStarred ?? 0,
    is_trash: row.isTrash ?? 0,
    is_spam: row.isSpam ?? 0,
    is_important: row.isImportant ?? 0,
    internal_date: Number(row.internalDate ?? 0),
    synced_at: Number(row.syncedAt ?? 0),
    unsubscribe_link: row.unsubscribeLink ?? null,
  }
}

/**
 * Extract category label from label IDs
 */
function findCategoryFromLabels(labelIds: string[]): string | null {
  for (const label of labelIds) {
    if (label.startsWith('CATEGORY_')) {
      return label
    }
  }
  if (labelIds.includes('SENT')) {
    return 'SENT'
  }
  return null
}

/**
 * Parse search query and build SQL condition with OR/AND operator support
 *
 * Supports:
 * - "term1 OR term2 OR term3" -> matches any of the terms
 * - "term1 AND term2" -> matches all terms (default if no operator)
 * - "term1" -> simple single term match
 * - Mixed: "term1 OR term2 AND term3" is NOT supported (use parentheses in future)
 *
 * All searches are case-insensitive partial matches on subject field.
 */
function buildSearchCondition(search: string) {
  const trimmed = search.trim()
  if (!trimmed) return null

  // Check if query contains OR operator (case-insensitive)
  const orParts = trimmed.split(/\s+OR\s+/i)
  if (orParts.length > 1) {
    // OR query: match any of the terms
    const orConditions = orParts
      .map((term) => term.trim())
      .filter(Boolean)
      .map((term) => {
        // Remove surrounding quotes if present
        const cleanTerm = term.replace(/^["']|["']$/g, '').trim()
        return sql`LOWER(${emails.subject}) LIKE ${'%' + cleanTerm.toLowerCase() + '%'}`
      })

    if (orConditions.length === 0) return null
    if (orConditions.length === 1) return orConditions[0]
    return or(...orConditions)!
  }

  // Check if query contains AND operator (case-insensitive)
  const andParts = trimmed.split(/\s+AND\s+/i)
  if (andParts.length > 1) {
    // AND query: match all of the terms
    const andConditions = andParts
      .map((term) => term.trim())
      .filter(Boolean)
      .map((term) => {
        // Remove surrounding quotes if present
        const cleanTerm = term.replace(/^["']|["']$/g, '').trim()
        return sql`LOWER(${emails.subject}) LIKE ${'%' + cleanTerm.toLowerCase() + '%'}`
      })

    if (andConditions.length === 0) return null
    if (andConditions.length === 1) return andConditions[0]
    return and(...andConditions)!
  }

  // Simple single term search
  const cleanTerm = trimmed.replace(/^["']|["']$/g, '').trim()
  return sql`LOWER(${emails.subject}) LIKE ${'%' + cleanTerm.toLowerCase() + '%'}`
}

/**
 * Build WHERE conditions from filters
 */
function buildWhereConditions(accountId: string, filters: ExplorerFilters) {
  const conditions = [eq(emails.mailAccountId, accountId)]

  // sender: Partial match on sender name OR email (single value)
  // Use case: "show me emails from Coursera" or "emails from amazon"
  if (filters.sender) {
    const senderLower = filters.sender.toLowerCase().trim()
    if (senderLower) {
      conditions.push(
        or(
          sql`LOWER(${emails.fromName}) LIKE ${'%' + senderLower + '%'}`,
          sql`LOWER(${emails.fromEmail}) LIKE ${'%' + senderLower + '%'}`
        )!
      )
    }
  }

  // senderEmail: Exact email match (comma-separated for multiple values)
  // Use case: filter by specific email addresses
  if (filters.senderEmail) {
    const emailList = filters.senderEmail
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
    if (emailList.length === 1) {
      conditions.push(sql`LOWER(${emails.fromEmail}) = ${emailList[0]}`)
    } else if (emailList.length > 1) {
      conditions.push(or(...emailList.map((email) => sql`LOWER(${emails.fromEmail}) = ${email}`))!)
    }
  }

  // senderDomain: Exact domain match (comma-separated for multiple values)
  // Use case: filter by domain like "coursera.org"
  if (filters.senderDomain) {
    const domainList = filters.senderDomain
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean)
    if (domainList.length === 1) {
      conditions.push(sql`LOWER(${emails.fromEmail}) LIKE ${'%@' + domainList[0]}`)
    } else if (domainList.length > 1) {
      conditions.push(
        or(...domainList.map((domain) => sql`LOWER(${emails.fromEmail}) LIKE ${'%@' + domain}`))!
      )
    }
  }

  if (filters.category) {
    conditions.push(eq(emails.category, filters.category))
  }
  if (filters.dateFrom !== undefined) {
    conditions.push(gte(emails.internalDate, filters.dateFrom))
  }
  if (filters.dateTo !== undefined) {
    conditions.push(lte(emails.internalDate, filters.dateTo))
  }
  if (filters.sizeMin !== undefined) {
    conditions.push(gte(emails.sizeBytes, filters.sizeMin))
  }
  if (filters.sizeMax !== undefined) {
    conditions.push(lte(emails.sizeBytes, filters.sizeMax))
  }
  if (filters.isUnread !== undefined) {
    conditions.push(eq(emails.isUnread, filters.isUnread ? 1 : 0))
  }
  if (filters.isStarred !== undefined) {
    conditions.push(eq(emails.isStarred, filters.isStarred ? 1 : 0))
  }
  if (filters.hasAttachments !== undefined) {
    conditions.push(
      filters.hasAttachments ? gt(emails.hasAttachments, 0) : eq(emails.hasAttachments, 0)
    )
  }
  if (filters.isTrash !== undefined) {
    conditions.push(eq(emails.isTrash, filters.isTrash ? 1 : 0))
  }
  if (filters.isSpam !== undefined) {
    conditions.push(eq(emails.isSpam, filters.isSpam ? 1 : 0))
  }
  if (filters.isImportant !== undefined) {
    conditions.push(eq(emails.isImportant, filters.isImportant ? 1 : 0))
  }
  if (filters.isArchived === true) {
    // Archived = not in inbox (no INBOX label), not trash, not spam
    conditions.push(sql`${emails.labels} NOT LIKE '%"INBOX"%'`)
    conditions.push(eq(emails.isTrash, 0))
    conditions.push(eq(emails.isSpam, 0))
  }
  if (filters.isSent === true) {
    // Sent = emails with SENT label
    conditions.push(sql`${emails.labels} LIKE '%"SENT"%'`)
  }
  if (filters.labelIds) {
    // Filter by user labels (comma-separated label IDs)
    const labelList = filters.labelIds
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean)
    if (labelList.length > 0) {
      // Match any of the specified labels (OR)
      const labelConditions = labelList.map(
        (labelId) => sql`${emails.labels} LIKE ${'%"' + labelId + '"%'}`
      )
      if (labelConditions.length === 1) {
        conditions.push(labelConditions[0]!)
      } else {
        conditions.push(or(...labelConditions)!)
      }
    }
  }
  if (filters.search) {
    const searchCondition = buildSearchCondition(filters.search)
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  return and(...conditions)!
}

/**
 * Get ORDER BY column and direction from filters
 */
function getOrderBy(filters: ExplorerFilters) {
  const sortBy = filters.sortBy || 'date'
  const sortOrder = filters.sortOrder || 'desc'
  const columnMap = {
    date: emails.internalDate,
    size: emails.sizeBytes,
    sender: emails.fromEmail,
  }
  const column = columnMap[sortBy] || emails.internalDate
  return sortOrder === 'asc' ? asc(column) : desc(column)
}

// ============================================================================
// Core CRUD Operations
// ============================================================================

/**
 * Clear all emails and senders for an account (for full re-sync)
 */
export async function clearEmails(accountId: string): Promise<void> {
  await db.delete(emails).where(eq(emails.mailAccountId, accountId))
  await db.delete(senders).where(eq(senders.mailAccountId, accountId))
}

/**
 * Insert or update a batch of emails
 */
export async function insertEmails(accountId: string, emailRecords: EmailRecord[]): Promise<void> {
  if (emailRecords.length === 0) return

  const values = emailRecords.map((email) => ({
    messageId: String(email.message_id || ''),
    mailAccountId: accountId,
    threadId: String(email.thread_id || ''),
    subject: email.subject ?? null,
    snippet: email.snippet ?? null,
    fromEmail: String(email.from_email || 'unknown@unknown.com'),
    fromName: email.from_name ?? null,
    labels: String(email.labels || '[]'),
    category: email.category ?? null,
    sizeBytes: toSafeInt(email.size_bytes),
    hasAttachments: toSafeInt(email.has_attachments),
    attachments: email.attachments ?? null,
    isUnread: toSafeInt(email.is_unread),
    isStarred: toSafeInt(email.is_starred),
    isTrash: toSafeInt(email.is_trash),
    isSpam: toSafeInt(email.is_spam),
    isImportant: toSafeInt(email.is_important),
    internalDate: toSafeInt(email.internal_date),
    syncedAt: toSafeInt(email.synced_at),
    unsubscribeLink: email.unsubscribe_link ?? null,
  }))

  await db
    .insert(emails)
    .values(values)
    .onConflictDoUpdate({
      target: [emails.messageId, emails.mailAccountId],
      set: {
        threadId: sql`excluded.thread_id`,
        subject: sql`excluded.subject`,
        snippet: sql`excluded.snippet`,
        fromEmail: sql`excluded.from_email`,
        fromName: sql`excluded.from_name`,
        labels: sql`excluded.labels`,
        category: sql`excluded.category`,
        sizeBytes: sql`excluded.size_bytes`,
        hasAttachments: sql`excluded.has_attachments`,
        attachments: sql`excluded.attachments`,
        isUnread: sql`excluded.is_unread`,
        isStarred: sql`excluded.is_starred`,
        isTrash: sql`excluded.is_trash`,
        isSpam: sql`excluded.is_spam`,
        isImportant: sql`excluded.is_important`,
        internalDate: sql`excluded.internal_date`,
        syncedAt: sql`excluded.synced_at`,
        unsubscribeLink: sql`excluded.unsubscribe_link`,
      },
    })
}

/**
 * Delete emails by message IDs
 */
export async function deleteEmailsByIds(accountId: string, messageIds: string[]): Promise<number> {
  if (messageIds.length === 0) return 0

  await db
    .delete(emails)
    .where(and(eq(emails.mailAccountId, accountId), inArray(emails.messageId, messageIds)))

  return messageIds.length
}

/**
 * Archive emails to "Eternal Memory" before permanent deletion
 * Copies email metadata to deleted_emails table for historical reference
 */
export async function archiveEmailsToEternalMemory(
  accountId: string,
  messageIds: string[]
): Promise<number> {
  if (messageIds.length === 0) return 0

  // Fetch emails to archive
  const emailsToArchive = await db
    .select()
    .from(emails)
    .where(and(eq(emails.mailAccountId, accountId), inArray(emails.messageId, messageIds)))

  if (emailsToArchive.length === 0) return 0

  // Insert into deleted_emails (without synced_at and is_trash)
  const BATCH_SIZE = 500
  let archivedCount = 0

  for (let i = 0; i < emailsToArchive.length; i += BATCH_SIZE) {
    const batch = emailsToArchive.slice(i, i + BATCH_SIZE)
    const values = batch.map((email) => ({
      messageId: email.messageId,
      mailAccountId: email.mailAccountId,
      threadId: email.threadId,
      subject: email.subject,
      snippet: email.snippet,
      fromEmail: email.fromEmail,
      fromName: email.fromName,
      labels: email.labels,
      category: email.category,
      sizeBytes: email.sizeBytes,
      hasAttachments: email.hasAttachments,
      isUnread: email.isUnread,
      isStarred: email.isStarred,
      isSpam: email.isSpam,
      isImportant: email.isImportant,
      internalDate: email.internalDate,
      unsubscribeLink: email.unsubscribeLink,
      // deletedAt is set automatically via defaultNow()
    }))

    // Use onConflictDoNothing to handle duplicates (email already archived)
    await db.insert(deletedEmails).values(values).onConflictDoNothing()
    archivedCount += batch.length
  }

  logger.debug(`[Emails] Archived ${archivedCount} emails to Eternal Memory`)
  return archivedCount
}

/**
 * Archive and delete emails in one operation
 * First archives to deleted_emails, then removes from emails table
 */
export async function archiveAndDeleteEmails(
  accountId: string,
  messageIds: string[]
): Promise<{ archived: number; deleted: number }> {
  if (messageIds.length === 0) return { archived: 0, deleted: 0 }

  // Archive first
  const archived = await archiveEmailsToEternalMemory(accountId, messageIds)

  // Then delete from emails table
  const deleted = await deleteEmailsByIds(accountId, messageIds)

  return { archived, deleted }
}

/**
 * Mark emails as trashed in local database
 */
export async function markEmailsAsTrashed(
  accountId: string,
  messageIds: string[]
): Promise<number> {
  if (messageIds.length === 0) return 0

  await db
    .update(emails)
    .set({ isTrash: 1 })
    .where(and(eq(emails.mailAccountId, accountId), inArray(emails.messageId, messageIds)))

  return messageIds.length
}

/**
 * Update email labels incrementally (for delta sync)
 */
export async function updateEmailLabels(
  accountId: string,
  messageId: string,
  labelsAdded: string[],
  labelsRemoved: string[]
): Promise<boolean> {
  const emailResults = await db
    .select({ messageId: emails.messageId, labels: emails.labels })
    .from(emails)
    .where(and(eq(emails.mailAccountId, accountId), eq(emails.messageId, messageId)))
    .limit(1)

  const email = emailResults[0]
  if (!email) {
    return false
  }

  let currentLabels: string[]
  try {
    currentLabels = JSON.parse(email.labels || '[]')
  } catch {
    currentLabels = []
  }

  const labelSet = new Set(currentLabels)
  for (const label of labelsAdded) {
    labelSet.add(label)
  }
  for (const label of labelsRemoved) {
    labelSet.delete(label)
  }

  const updatedLabels = Array.from(labelSet)
  const category = findCategoryFromLabels(updatedLabels)
  const isUnread = updatedLabels.includes('UNREAD') ? 1 : 0
  const isStarred = updatedLabels.includes('STARRED') ? 1 : 0
  const isTrash = updatedLabels.includes('TRASH') ? 1 : 0
  const isSpam = updatedLabels.includes('SPAM') ? 1 : 0
  const isImportant = updatedLabels.includes('IMPORTANT') ? 1 : 0

  await db
    .update(emails)
    .set({
      labels: JSON.stringify(updatedLabels),
      category,
      isUnread,
      isStarred,
      isTrash,
      isSpam,
      isImportant,
      syncedAt: Date.now(),
    })
    .where(and(eq(emails.mailAccountId, accountId), eq(emails.messageId, messageId)))

  return true
}

// ============================================================================
// Sender Aggregation
// ============================================================================

/**
 * Build sender aggregates from the emails table
 */
export async function buildSenderAggregates(accountId: string): Promise<void> {
  await db.delete(senders).where(eq(senders.mailAccountId, accountId))

  // Use Drizzle query builder to aggregate and insert (works for both Postgres and SQLite)
  const aggregatedSenders = await db
    .select({
      mailAccountId: emails.mailAccountId,
      email: emails.fromEmail,
      name: sql<string | null>`MAX(${emails.fromName})`,
      count: count(),
      totalSize: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)`,
    })
    .from(emails)
    .where(eq(emails.mailAccountId, accountId))
    .groupBy(emails.mailAccountId, emails.fromEmail)
    .orderBy(desc(count()))

  // Insert in batches
  const BATCH_SIZE = 500
  for (let i = 0; i < aggregatedSenders.length; i += BATCH_SIZE) {
    const batch = aggregatedSenders.slice(i, i + BATCH_SIZE)
    if (batch.length > 0) {
      await db.insert(senders).values(
        batch.map((s) => ({
          mailAccountId: s.mailAccountId,
          email: s.email,
          name: s.name,
          count: s.count,
          totalSize: Number(s.totalSize) || 0,
        }))
      )
    }
  }
}

/**
 * Get top senders by email count
 */
export async function getTopSenders(accountId: string, limit = 50): Promise<SenderRecord[]> {
  const results = await db
    .select()
    .from(senders)
    .where(eq(senders.mailAccountId, accountId))
    .orderBy(desc(senders.count))
    .limit(limit)

  return results.map(toSenderRecord)
}

/**
 * Get senders with unsubscribe links for subscriptions page
 * Applies all subscription filters: search, minCount, maxCount, minSize, maxSize, dateFrom, dateTo, sortBy, sortOrder
 */
export async function getSendersWithUnsubscribe(
  accountId: string,
  limit = 100,
  offset = 0,
  filters: SubscriptionFilters = {}
): Promise<{ senders: SenderWithUnsubscribe[]; total: number }> {
  const results: SenderWithUnsubscribe[] = []
  let total = 0

  try {
    // Build WHERE conditions for base email filtering
    const whereConditions = [
      eq(emails.mailAccountId, accountId),
      sql`${emails.unsubscribeLink} IS NOT NULL`,
    ]

    // Search filter on sender name or email
    if (filters.search) {
      const searchLower = filters.search.toLowerCase().trim()
      if (searchLower) {
        whereConditions.push(
          or(
            sql`LOWER(${emails.fromName}) LIKE ${'%' + searchLower + '%'}`,
            sql`LOWER(${emails.fromEmail}) LIKE ${'%' + searchLower + '%'}`
          )!
        )
      }
    }

    // Build HAVING conditions for aggregate filters
    const havingConditions: ReturnType<typeof sql>[] = []

    if (filters.minCount !== undefined) {
      havingConditions.push(sql`COUNT(*) >= ${filters.minCount}`)
    }
    if (filters.maxCount !== undefined) {
      havingConditions.push(sql`COUNT(*) <= ${filters.maxCount}`)
    }
    if (filters.minSize !== undefined) {
      havingConditions.push(sql`SUM(${emails.sizeBytes}) >= ${filters.minSize}`)
    }
    if (filters.maxSize !== undefined) {
      havingConditions.push(sql`SUM(${emails.sizeBytes}) <= ${filters.maxSize}`)
    }

    // Date filters - applied at sender level on aggregated dates
    // dateFrom: Show senders with recent activity (latest_date >= dateFrom)
    if (filters.dateFrom !== undefined) {
      havingConditions.push(sql`MAX(${emails.internalDate}) >= ${filters.dateFrom}`)
    }
    // dateTo: Show inactive senders (latest_date <= dateTo, i.e., no emails after this date)
    if (filters.dateTo !== undefined) {
      havingConditions.push(sql`MAX(${emails.internalDate}) <= ${filters.dateTo}`)
    }

    // Determine sort order
    const sortOrder = filters.sortOrder === 'asc' ? asc : desc
    let orderByClause
    switch (filters.sortBy) {
      case 'size':
        orderByClause = sortOrder(sql`SUM(${emails.sizeBytes})`)
        break
      case 'first_date':
        orderByClause = sortOrder(sql`MIN(${emails.internalDate})`)
        break
      case 'latest_date':
        orderByClause = sortOrder(sql`MAX(${emails.internalDate})`)
        break
      case 'name':
        orderByClause = sortOrder(sql`COALESCE(MAX(${emails.fromName}), ${emails.fromEmail})`)
        break
      case 'count':
      default:
        orderByClause = sortOrder(count())
        break
    }

    // Build the main query with all filters
    const baseQuery = db
      .select({
        email: emails.fromEmail,
        name: sql<string | null>`MAX(${emails.fromName})`,
        count: count(),
        totalSize: sql<number>`SUM(${emails.sizeBytes})`,
        firstDate: sql<number>`MIN(${emails.internalDate})`,
        latestDate: sql<number>`MAX(${emails.internalDate})`,
      })
      .from(emails)
      .where(and(...whereConditions))
      .groupBy(emails.fromEmail)

    // Apply HAVING conditions if any
    const queryWithHaving =
      havingConditions.length > 0 ? baseQuery.having(and(...havingConditions)) : baseQuery

    // Get paginated results with sorting
    const rawResults = await queryWithHaving.orderBy(orderByClause).limit(limit).offset(offset)

    // Get total count (separate query without pagination)
    const countQuery = db
      .select({
        email: emails.fromEmail,
      })
      .from(emails)
      .where(and(...whereConditions))
      .groupBy(emails.fromEmail)

    const countQueryWithHaving =
      havingConditions.length > 0 ? countQuery.having(and(...havingConditions)) : countQuery

    const countResults = await countQueryWithHaving
    total = countResults.length

    // Fetch unsubscribe links for each sender
    for (const row of rawResults) {
      const unsubLinkResults = await db
        .select({ unsubscribeLink: emails.unsubscribeLink })
        .from(emails)
        .where(
          and(
            eq(emails.mailAccountId, accountId),
            eq(emails.fromEmail, row.email),
            sql`${emails.unsubscribeLink} IS NOT NULL`
          )
        )
        .orderBy(desc(emails.internalDate))
        .limit(1)

      results.push({
        email: row.email,
        name: row.name,
        count: row.count,
        total_size: Number(row.totalSize) || 0,
        first_date: Number(row.firstDate) || 0,
        latest_date: Number(row.latestDate) || 0,
        unsubscribe_link: unsubLinkResults[0]?.unsubscribeLink ?? null,
      })
    }
  } catch (error) {
    logger.error('[Emails] Error in getSendersWithUnsubscribe:', error)
  }

  return { senders: results, total }
}

/**
 * Get sender suggestions with domain grouping
 */
export async function getSenderSuggestions(
  accountId: string,
  search?: string,
  limit = 20
): Promise<SenderSuggestion[]> {
  const suggestions: SenderSuggestion[] = []

  // Get all senders for this account
  const allSenders = await db
    .select()
    .from(senders)
    .where(eq(senders.mailAccountId, accountId))
    .orderBy(desc(senders.count))

  // Build domain aggregates
  const domainMap = new Map<string, { count: number; addresses: number }>()
  for (const sender of allSenders) {
    const atIndex = sender.email.indexOf('@')
    if (atIndex > 0) {
      const domain = sender.email.slice(atIndex + 1).toLowerCase()
      const existing = domainMap.get(domain) || { count: 0, addresses: 0 }
      existing.count += sender.count ?? 0
      existing.addresses += 1
      domainMap.set(domain, existing)
    }
  }

  // Convert to sorted array (domains with multiple addresses first, then by count)
  const domains = Array.from(domainMap.entries())
    .filter(([_, data]) => data.addresses > 1) // Only show domains with 2+ addresses
    .sort((a, b) => b[1].count - a[1].count)

  if (search && search.length > 0) {
    const searchLower = search.toLowerCase()

    // Add matching domains first
    for (const [domain, data] of domains) {
      if (domain.includes(searchLower) || `@${domain}`.includes(searchLower)) {
        suggestions.push({
          type: 'domain',
          value: domain,
          label: `@${domain} (${data.addresses} addresses)`,
          count: data.count,
        })
        if (suggestions.length >= limit) break
      }
    }

    // Add matching individual emails
    if (suggestions.length < limit) {
      for (const sender of allSenders) {
        if (sender.email.toLowerCase().includes(searchLower)) {
          suggestions.push({
            type: 'email',
            value: sender.email,
            label: sender.email,
            count: sender.count ?? 0,
          })
          if (suggestions.length >= limit) break
        }
      }
    }
  } else {
    // No search - show top domains first, then top individual emails
    for (const [domain, data] of domains.slice(0, Math.floor(limit / 2))) {
      suggestions.push({
        type: 'domain',
        value: domain,
        label: `@${domain} (${data.addresses} addresses)`,
        count: data.count,
      })
    }

    // Fill remaining with top individual emails
    for (const sender of allSenders) {
      if (suggestions.length >= limit) break
      suggestions.push({
        type: 'email',
        value: sender.email,
        label: sender.email,
        count: sender.count ?? 0,
      })
    }
  }

  return suggestions
}

/**
 * Get distinct senders for autocomplete
 */
export async function getDistinctSenders(
  accountId: string,
  search?: string,
  limit = 20
): Promise<string[]> {
  if (search) {
    const results = await db
      .selectDistinct({ fromEmail: emails.fromEmail })
      .from(emails)
      .where(and(eq(emails.mailAccountId, accountId), like(emails.fromEmail, `%${search}%`)))
      .orderBy(emails.fromEmail)
      .limit(limit)
    return results.map((r) => r.fromEmail)
  } else {
    const results = await db
      .select({ email: senders.email })
      .from(senders)
      .where(eq(senders.mailAccountId, accountId))
      .orderBy(desc(senders.count))
      .limit(limit)
    return results.map((r) => r.email)
  }
}

// ============================================================================
// Query Operations
// ============================================================================

/**
 * Query emails with filters and pagination
 */
export async function queryEmails(
  accountId: string,
  filters: ExplorerFilters,
  pagination: PaginationOptions
): Promise<EmailRecord[]> {
  const whereCondition = buildWhereConditions(accountId, filters)
  const orderBy = getOrderBy(filters)
  const offset = (pagination.page - 1) * pagination.limit

  const results = await db
    .select()
    .from(emails)
    .where(whereCondition)
    .orderBy(orderBy)
    .limit(pagination.limit)
    .offset(offset)

  return results.map(toEmailRecord)
}

/**
 * Count emails matching filters
 */
export async function countFilteredEmails(
  accountId: string,
  filters: ExplorerFilters
): Promise<number> {
  const whereCondition = buildWhereConditions(accountId, filters)
  const results = await db.select({ count: count() }).from(emails).where(whereCondition)
  return results[0]?.count ?? 0
}

/**
 * Get all message IDs matching filters (for bulk operations)
 */
export async function getMessageIdsByFilters(
  accountId: string,
  filters: ExplorerFilters
): Promise<string[]> {
  const whereCondition = buildWhereConditions(accountId, filters)
  const results = await db
    .select({ messageId: emails.messageId })
    .from(emails)
    .where(whereCondition)
  return results.map((r) => r.messageId)
}

/**
 * Get all message IDs and total size matching filters (for bulk operations with size info)
 */
export async function getMessageIdsByFiltersWithSize(
  accountId: string,
  filters: ExplorerFilters
): Promise<{ messageIds: string[]; totalSize: number }> {
  const whereCondition = buildWhereConditions(accountId, filters)
  const results = await db
    .select({ messageId: emails.messageId, sizeBytes: emails.sizeBytes })
    .from(emails)
    .where(whereCondition)

  const messageIds = results.map((r) => r.messageId)
  const totalSize = results.reduce((sum, r) => sum + (r.sizeBytes || 0), 0)

  return { messageIds, totalSize }
}

/**
 * Sum total size of emails matching filters
 */
export async function sumFilteredEmailsSize(
  accountId: string,
  filters: ExplorerFilters
): Promise<number> {
  const whereCondition = buildWhereConditions(accountId, filters)
  const results = await db
    .select({ totalSize: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)` })
    .from(emails)
    .where(whereCondition)
  return Number(results[0]?.totalSize ?? 0)
}

/**
 * Get distinct categories for filter dropdown
 */
export async function getDistinctCategories(accountId: string): Promise<string[]> {
  const results = await db
    .selectDistinct({ category: emails.category })
    .from(emails)
    .where(and(eq(emails.mailAccountId, accountId), sql`${emails.category} IS NOT NULL`))
    .orderBy(emails.category)
  return results.filter((r) => r.category !== null).map((r) => r.category as string)
}

// ============================================================================
// Count & Stats Operations
// ============================================================================

/**
 * Get total email count for an account
 */
export async function getEmailCount(accountId: string): Promise<number> {
  const results = await db
    .select({ count: count() })
    .from(emails)
    .where(eq(emails.mailAccountId, accountId))
  return results[0]?.count ?? 0
}

/**
 * Get email count by category
 */
export async function getEmailCountByCategory(accountId: string): Promise<Record<string, number>> {
  const results = await db
    .select({
      category: emails.category,
      count: count(),
    })
    .from(emails)
    .where(and(eq(emails.mailAccountId, accountId), sql`${emails.category} IS NOT NULL`))
    .groupBy(emails.category)

  const result: Record<string, number> = {}
  for (const row of results) {
    if (row.category) {
      result[row.category] = row.count
    }
  }
  return result
}

/**
 * Get count of unique senders
 */
export async function getUniqueSenderCount(accountId: string): Promise<number> {
  const results = await db
    .select({ count: count() })
    .from(senders)
    .where(eq(senders.mailAccountId, accountId))
  return results[0]?.count ?? 0
}

/**
 * Get total storage used by all emails
 */
export async function getTotalStorageBytes(accountId: string): Promise<number> {
  const results = await db
    .select({ total: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)` })
    .from(emails)
    .where(eq(emails.mailAccountId, accountId))
  return Number(results[0]?.total ?? 0)
}

/**
 * Get count of emails larger than a given size
 */
export async function getEmailCountLargerThan(
  accountId: string,
  sizeBytes: number
): Promise<number> {
  const results = await db
    .select({ count: count() })
    .from(emails)
    .where(and(eq(emails.mailAccountId, accountId), gt(emails.sizeBytes, sizeBytes)))
  return results[0]?.count ?? 0
}

/**
 * Get count of emails older than a given timestamp
 */
export async function getEmailCountOlderThan(
  accountId: string,
  timestampMs: number
): Promise<number> {
  const results = await db
    .select({ count: count() })
    .from(emails)
    .where(and(eq(emails.mailAccountId, accountId), lt(emails.internalDate, timestampMs)))
  return results[0]?.count ?? 0
}

// ============================================================================
// Specialized Queries
// ============================================================================

/**
 * Get emails by sender
 */
export async function getEmailsBySender(
  accountId: string,
  senderEmail: string,
  limit = 100,
  offset = 0
): Promise<EmailRecord[]> {
  const results = await db
    .select()
    .from(emails)
    .where(and(eq(emails.mailAccountId, accountId), eq(emails.fromEmail, senderEmail)))
    .orderBy(desc(emails.internalDate))
    .limit(limit)
    .offset(offset)
  return results.map(toEmailRecord)
}

/**
 * Get emails by category
 */
export async function getEmailsByCategory(
  accountId: string,
  category: string,
  limit = 100,
  offset = 0
): Promise<EmailRecord[]> {
  const results = await db
    .select()
    .from(emails)
    .where(and(eq(emails.mailAccountId, accountId), eq(emails.category, category)))
    .orderBy(desc(emails.internalDate))
    .limit(limit)
    .offset(offset)
  return results.map(toEmailRecord)
}

/**
 * Get emails larger than a certain size
 */
export async function getEmailsLargerThan(
  accountId: string,
  sizeBytes: number,
  limit = 100,
  offset = 0
): Promise<EmailRecord[]> {
  const results = await db
    .select()
    .from(emails)
    .where(and(eq(emails.mailAccountId, accountId), gt(emails.sizeBytes, sizeBytes)))
    .orderBy(desc(emails.sizeBytes))
    .limit(limit)
    .offset(offset)
  return results.map(toEmailRecord)
}

/**
 * Get emails older than a certain date
 */
export async function getEmailsOlderThan(
  accountId: string,
  dateMs: number,
  limit = 100,
  offset = 0
): Promise<EmailRecord[]> {
  const results = await db
    .select()
    .from(emails)
    .where(and(eq(emails.mailAccountId, accountId), lt(emails.internalDate, dateMs)))
    .orderBy(asc(emails.internalDate))
    .limit(limit)
    .offset(offset)
  return results.map(toEmailRecord)
}

/**
 * Get unread emails
 */
export async function getUnreadEmails(
  accountId: string,
  limit = 100,
  offset = 0
): Promise<EmailRecord[]> {
  const results = await db
    .select()
    .from(emails)
    .where(and(eq(emails.mailAccountId, accountId), eq(emails.isUnread, 1)))
    .orderBy(desc(emails.internalDate))
    .limit(limit)
    .offset(offset)
  return results.map(toEmailRecord)
}

/**
 * Get message IDs by sender (for bulk operations)
 */
export async function getMessageIdsBySender(
  accountId: string,
  senderEmail: string
): Promise<string[]> {
  const results = await db
    .select({ messageId: emails.messageId })
    .from(emails)
    .where(and(eq(emails.mailAccountId, accountId), eq(emails.fromEmail, senderEmail)))
  return results.map((r) => r.messageId)
}

/**
 * Get message IDs by category (for bulk operations)
 */
export async function getMessageIdsByCategory(
  accountId: string,
  category: string
): Promise<string[]> {
  const results = await db
    .select({ messageId: emails.messageId })
    .from(emails)
    .where(and(eq(emails.mailAccountId, accountId), eq(emails.category, category)))
  return results.map((r) => r.messageId)
}

// ============================================================================
// Analysis & Stats
// ============================================================================

/**
 * Compute analysis stats from synced email metadata
 */
export async function computeAnalysis(accountId: string): Promise<AnalysisResults> {
  const now = Date.now()
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000
  const twoYearsAgo = now - 2 * 365 * 24 * 60 * 60 * 1000
  const threeYearsAgo = now - 3 * 365 * 24 * 60 * 60 * 1000

  const FIVE_MB = 5 * 1024 * 1024
  const TEN_MB = 10 * 1024 * 1024

  const sizeResults = await db
    .select({
      larger5MB: sql<number>`SUM(CASE WHEN ${emails.sizeBytes} > ${FIVE_MB} THEN 1 ELSE 0 END)`,
      larger10MB: sql<number>`SUM(CASE WHEN ${emails.sizeBytes} > ${TEN_MB} THEN 1 ELSE 0 END)`,
      totalStorageBytes: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)`,
    })
    .from(emails)
    .where(eq(emails.mailAccountId, accountId))

  const ageResults = await db
    .select({
      olderThan1Year: sql<number>`SUM(CASE WHEN ${emails.internalDate} < ${oneYearAgo} THEN 1 ELSE 0 END)`,
      olderThan2Years: sql<number>`SUM(CASE WHEN ${emails.internalDate} < ${twoYearsAgo} THEN 1 ELSE 0 END)`,
      olderThan3Years: sql<number>`SUM(CASE WHEN ${emails.internalDate} < ${threeYearsAgo} THEN 1 ELSE 0 END)`,
    })
    .from(emails)
    .where(eq(emails.mailAccountId, accountId))

  const sizeStats = sizeResults[0]
  const ageStats = ageResults[0]

  return {
    size: {
      larger5MB: Number(sizeStats?.larger5MB ?? 0),
      larger10MB: Number(sizeStats?.larger10MB ?? 0),
      totalStorageBytes: Number(sizeStats?.totalStorageBytes ?? 0),
    },
    age: {
      olderThan1Year: Number(ageStats?.olderThan1Year ?? 0),
      olderThan2Years: Number(ageStats?.olderThan2Years ?? 0),
      olderThan3Years: Number(ageStats?.olderThan3Years ?? 0),
    },
  }
}

// ============================================================================
// AI Agent Functions
// ============================================================================

/**
 * Breakdown item for aggregated results
 */
export interface BreakdownItem {
  key: string
  label: string
  count: number
  totalSize: number
  totalSizeFormatted: string
}

/**
 * Options for the unified queryEmailsUnified function
 */
export interface QueryEmailsOptions {
  filters: ExplorerFilters
  breakdownBy?: 'sender' | 'category' | 'month'
  breakdownSortBy?: 'count' | 'size'
  breakdownSortOrder?: 'asc' | 'desc'
  limit?: number
  page?: number
}

/**
 * Result from queryEmailsUnified
 */
export interface QueryEmailsResult {
  // Always returned
  count: number
  totalSizeBytes: number
  totalSizeFormatted: string
  appliedFilters: ExplorerFilters

  // Returned when breakdownBy is set
  breakdown?: BreakdownItem[]

  // Returned when breakdownBy is NOT set
  emails?: EmailRecord[]
}

/**
 * Format bytes to human readable string
 */
function formatBytesInternal(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Unified email query function for AI tools
 *
 * This single function replaces multiple AI tools by supporting:
 * - All filters (sender, senderDomain, senderName, category, dates, etc.)
 * - Optional breakdown by sender, category, or month
 * - Returns count + totalSize always
 * - Returns either emails list OR breakdown based on options
 */
export async function queryEmailsUnified(
  accountId: string,
  options: QueryEmailsOptions
): Promise<QueryEmailsResult> {
  const {
    filters,
    breakdownBy,
    breakdownSortBy = 'count',
    breakdownSortOrder = 'desc',
    limit = 20,
    page = 1,
  } = options
  const whereCondition = buildWhereConditions(accountId, filters)

  // Always get count and total size
  const countResult = await db.select({ count: count() }).from(emails).where(whereCondition)
  const totalCount = countResult[0]?.count ?? 0

  const sizeResult = await db
    .select({ totalSize: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)` })
    .from(emails)
    .where(whereCondition)
  const totalSizeBytes = Number(sizeResult[0]?.totalSize ?? 0)

  const result: QueryEmailsResult = {
    count: totalCount,
    totalSizeBytes,
    totalSizeFormatted: formatBytesInternal(totalSizeBytes),
    appliedFilters: filters,
  }

  // If breakdownBy is set, return aggregated breakdown
  if (breakdownBy) {
    const breakdown = await getBreakdown(
      accountId,
      filters,
      breakdownBy,
      limit,
      breakdownSortBy,
      breakdownSortOrder
    )
    result.breakdown = breakdown
    return result
  }

  // Otherwise return email list
  const offset = (page - 1) * limit
  const orderBy = getOrderBy(filters)
  const emailResults = await db
    .select()
    .from(emails)
    .where(whereCondition)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset)

  result.emails = emailResults.map(toEmailRecord)
  return result
}

/**
 * Helper: Get breakdown by sender, category, or month
 */
async function getBreakdown(
  accountId: string,
  filters: ExplorerFilters,
  breakdownBy: 'sender' | 'category' | 'month',
  limit: number,
  sortBy: 'count' | 'size' = 'count',
  sortOrder: 'asc' | 'desc' = 'desc'
): Promise<BreakdownItem[]> {
  const whereCondition = buildWhereConditions(accountId, filters)

  // Determine sort expression and direction
  const sortDirection = sortOrder === 'asc' ? asc : desc
  const sortExpression = sortBy === 'size' ? sql`SUM(${emails.sizeBytes})` : count()

  if (breakdownBy === 'sender') {
    const results = await db
      .select({
        key: emails.fromEmail,
        label: sql<string | null>`MAX(${emails.fromName})`,
        count: count(),
        totalSize: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)`,
      })
      .from(emails)
      .where(whereCondition)
      .groupBy(emails.fromEmail)
      .orderBy(sortDirection(sortExpression))
      .limit(limit)

    return results.map((r) => ({
      key: r.key,
      label: r.label || r.key,
      count: r.count,
      totalSize: Number(r.totalSize),
      totalSizeFormatted: formatBytesInternal(Number(r.totalSize)),
    }))
  }

  if (breakdownBy === 'category') {
    // Map category IDs to readable names
    const categoryNames: Record<string, string> = {
      CATEGORY_PROMOTIONS: 'Promotions',
      CATEGORY_SOCIAL: 'Social',
      CATEGORY_UPDATES: 'Updates',
      CATEGORY_FORUMS: 'Forums',
      CATEGORY_PERSONAL: 'Primary',
      SENT: 'Sent',
    }

    const results = await db
      .select({
        key: emails.category,
        count: count(),
        totalSize: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)`,
      })
      .from(emails)
      .where(and(whereCondition, sql`${emails.category} IS NOT NULL`))
      .groupBy(emails.category)
      .orderBy(sortDirection(sortExpression))
      .limit(limit)

    return results
      .filter((r) => r.key !== null)
      .map((r) => ({
        key: r.key as string,
        label: categoryNames[r.key as string] || (r.key as string),
        count: r.count,
        totalSize: Number(r.totalSize),
        totalSizeFormatted: formatBytesInternal(Number(r.totalSize)),
      }))
  }

  if (breakdownBy === 'month') {
    // Group by year-month - month breakdown always sorts by date (key)
    const results = await db
      .select({
        key: sql<string>`strftime('%Y-%m', datetime(${emails.internalDate} / 1000, 'unixepoch'))`,
        count: count(),
        totalSize: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)`,
      })
      .from(emails)
      .where(whereCondition)
      .groupBy(sql`strftime('%Y-%m', datetime(${emails.internalDate} / 1000, 'unixepoch'))`)
      .orderBy(sortDirection(sortExpression))
      .limit(limit)

    return results.map((r) => ({
      key: r.key || 'unknown',
      label: r.key || 'Unknown',
      count: r.count,
      totalSize: Number(r.totalSize),
      totalSizeFormatted: formatBytesInternal(Number(r.totalSize)),
    }))
  }

  return []
}

/**
 * Options for getTopSendersExtended
 */
export interface TopSendersOptions {
  sortBy?: 'count' | 'size'
  limit?: number
  category?: string
}

/**
 * Extended sender stats for AI tools
 */
export interface SenderStats {
  email: string
  name: string | null
  count: number
  totalSize: number
}

/**
 * Get top senders with extended options (for AI tools)
 * Supports sorting by count or size, filtering by category
 */
export async function getTopSendersExtended(
  accountId: string,
  options: TopSendersOptions = {}
): Promise<SenderStats[]> {
  const { sortBy = 'count', limit = 10, category } = options

  // Build conditions
  const conditions = [eq(emails.mailAccountId, accountId)]
  if (category) {
    conditions.push(eq(emails.category, category))
  }

  // Aggregate by sender
  const results = await db
    .select({
      email: emails.fromEmail,
      name: sql<string | null>`MAX(${emails.fromName})`,
      count: count(),
      totalSize: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)`,
    })
    .from(emails)
    .where(and(...conditions))
    .groupBy(emails.fromEmail)
    .orderBy(sortBy === 'size' ? desc(sql`SUM(${emails.sizeBytes})`) : desc(count()))
    .limit(limit)

  return results.map((r) => ({
    email: r.email,
    name: r.name,
    count: r.count,
    totalSize: Number(r.totalSize),
  }))
}

/**
 * Category stats with count and size
 */
export interface CategoryStatsResult {
  category: string
  count: number
  totalSize: number
}

/**
 * Get category breakdown with counts and sizes (for AI tools)
 */
export async function getCategoryStats(accountId: string): Promise<CategoryStatsResult[]> {
  const results = await db
    .select({
      category: emails.category,
      count: count(),
      totalSize: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)`,
    })
    .from(emails)
    .where(and(eq(emails.mailAccountId, accountId), sql`${emails.category} IS NOT NULL`))
    .groupBy(emails.category)
    .orderBy(desc(count()))

  return results
    .filter((r) => r.category !== null)
    .map((r) => ({
      category: r.category as string,
      count: r.count,
      totalSize: Number(r.totalSize),
    }))
}

/**
 * Storage breakdown item
 */
export interface StorageBreakdownItem {
  key: string
  label: string
  count: number
  totalSize: number
}

/**
 * Analyze storage usage grouped by sender, category, or month (for AI tools)
 */
export async function getStorageAnalysis(
  accountId: string,
  groupBy: 'sender' | 'category' | 'month',
  limit = 10
): Promise<StorageBreakdownItem[]> {
  if (groupBy === 'sender') {
    const results = await db
      .select({
        key: emails.fromEmail,
        label: sql<string | null>`MAX(${emails.fromName})`,
        count: count(),
        totalSize: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)`,
      })
      .from(emails)
      .where(eq(emails.mailAccountId, accountId))
      .groupBy(emails.fromEmail)
      .orderBy(desc(sql`SUM(${emails.sizeBytes})`))
      .limit(limit)

    return results.map((r) => ({
      key: r.key,
      label: r.label || r.key,
      count: r.count,
      totalSize: Number(r.totalSize),
    }))
  }

  if (groupBy === 'category') {
    const results = await db
      .select({
        key: emails.category,
        count: count(),
        totalSize: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)`,
      })
      .from(emails)
      .where(and(eq(emails.mailAccountId, accountId), sql`${emails.category} IS NOT NULL`))
      .groupBy(emails.category)
      .orderBy(desc(sql`SUM(${emails.sizeBytes})`))
      .limit(limit)

    // Map category IDs to readable names
    const categoryNames: Record<string, string> = {
      CATEGORY_PROMOTIONS: 'Promotions',
      CATEGORY_SOCIAL: 'Social',
      CATEGORY_UPDATES: 'Updates',
      CATEGORY_FORUMS: 'Forums',
      CATEGORY_PERSONAL: 'Primary',
      SENT: 'Sent',
    }

    return results
      .filter((r) => r.key !== null)
      .map((r) => ({
        key: r.key as string,
        label: categoryNames[r.key as string] || (r.key as string),
        count: r.count,
        totalSize: Number(r.totalSize),
      }))
  }

  if (groupBy === 'month') {
    // Group by year-month
    const results = await db
      .select({
        key: sql<string>`strftime('%Y-%m', datetime(${emails.internalDate} / 1000, 'unixepoch'))`,
        count: count(),
        totalSize: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)`,
      })
      .from(emails)
      .where(eq(emails.mailAccountId, accountId))
      .groupBy(sql`strftime('%Y-%m', datetime(${emails.internalDate} / 1000, 'unixepoch'))`)
      .orderBy(desc(sql`SUM(${emails.sizeBytes})`))
      .limit(limit)

    return results.map((r) => ({
      key: r.key || 'unknown',
      label: r.key || 'Unknown',
      count: r.count,
      totalSize: Number(r.totalSize),
    }))
  }

  return []
}

/**
 * Email content result from Gmail API
 */
export interface EmailContent {
  id: string
  threadId: string | null
  labelIds: string[]
  snippet: string | null
  internalDate: string | null
  sizeEstimate: number | null
  headers: {
    from: string | null
    to: string | null
    cc: string | null
    bcc: string | null
    subject: string | null
    date: string | null
    replyTo: string | null
    messageId: string | null
  }
  body: {
    html: string | null
    text: string | null
  }
  attachments: Array<{
    filename: string
    mimeType: string
    size: number
  }>
}

/**
 * Get full email content from Gmail API (for AI tools)
 * This fetches the email body which is not stored locally
 */
export async function getEmailContent(
  accountId: string,
  messageId: string
): Promise<EmailContent | null> {
  // Import gmail client here to avoid circular dependency
  const { getGmailClient } = await import('./gmail')

  try {
    const gmail = await getGmailClient(accountId)
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    })

    const message = response.data
    if (!message) {
      return null
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

      const processParts = (parts: NonNullable<typeof message.payload>['parts']) => {
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
            processParts(part.parts)
          }
        }
      }

      processParts(payload?.parts)
      return attachments
    }

    const attachments = extractAttachments(message.payload)

    return {
      id: message.id || messageId,
      threadId: message.threadId || null,
      labelIds: message.labelIds || [],
      snippet: message.snippet || null,
      internalDate: message.internalDate || null,
      sizeEstimate: message.sizeEstimate || null,
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
    }
  } catch (error) {
    logger.error(`[Emails] Error fetching email content for ${messageId}:`, error)
    return null
  }
}

// ============================================================================
// Stats Operations
// ============================================================================

/**
 * Calculate all stats from the emails database
 */
export async function calculateStats(accountId: string): Promise<CalculatedStats> {
  const now = Date.now()
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000
  const twoYearsAgo = now - 2 * 365 * 24 * 60 * 60 * 1000
  const FIVE_MB = 5 * 1024 * 1024
  const TEN_MB = 10 * 1024 * 1024

  const inboxCondition = and(
    eq(emails.mailAccountId, accountId),
    eq(emails.isTrash, 0),
    eq(emails.isSpam, 0)
  )

  const cleanableCondition = and(
    eq(emails.mailAccountId, accountId),
    eq(emails.isTrash, 0),
    eq(emails.isSpam, 0),
    eq(emails.isStarred, 0),
    eq(emails.isImportant, 0)
  )

  const basicStatsResults = await db
    .select({
      total: count(),
      unread: sql<number>`SUM(CASE WHEN ${emails.isUnread} = 1 THEN 1 ELSE 0 END)`,
      totalStorageBytes: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)`,
      larger5MB: sql<number>`SUM(CASE WHEN ${emails.sizeBytes} > ${FIVE_MB} THEN 1 ELSE 0 END)`,
      larger10MB: sql<number>`SUM(CASE WHEN ${emails.sizeBytes} > ${TEN_MB} THEN 1 ELSE 0 END)`,
      olderThan1Year: sql<number>`SUM(CASE WHEN ${emails.internalDate} < ${oneYearAgo} THEN 1 ELSE 0 END)`,
      olderThan2Years: sql<number>`SUM(CASE WHEN ${emails.internalDate} < ${twoYearsAgo} THEN 1 ELSE 0 END)`,
    })
    .from(emails)
    .where(inboxCondition)

  const basicStats = basicStatsResults[0]

  const trashStatsResults = await db
    .select({
      count: count(),
      sizeBytes: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)`,
    })
    .from(emails)
    .where(and(eq(emails.mailAccountId, accountId), eq(emails.isTrash, 1)))

  const trashStats = trashStatsResults[0]

  const spamStatsResults = await db
    .select({
      count: count(),
      sizeBytes: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)`,
    })
    .from(emails)
    .where(and(eq(emails.mailAccountId, accountId), eq(emails.isSpam, 1), eq(emails.isTrash, 0)))

  const spamStats = spamStatsResults[0]

  const categoryResults = await db
    .select({
      category: emails.category,
      count: count(),
    })
    .from(emails)
    .where(and(inboxCondition, sql`${emails.category} IS NOT NULL`))
    .groupBy(emails.category)

  const categories = {
    promotions: 0,
    social: 0,
    updates: 0,
    forums: 0,
    primary: 0,
  }

  for (const row of categoryResults) {
    const cat = row.category
    if (cat === 'CATEGORY_PROMOTIONS') categories.promotions = Number(row.count)
    else if (cat === 'CATEGORY_SOCIAL') categories.social = Number(row.count)
    else if (cat === 'CATEGORY_UPDATES') categories.updates = Number(row.count)
    else if (cat === 'CATEGORY_FORUMS') categories.forums = Number(row.count)
    else if (cat === 'CATEGORY_PERSONAL') categories.primary = Number(row.count)
  }

  const cleanupCategoryResults = await db
    .select({
      category: emails.category,
      total: count(),
      totalSize: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)`,
      readOnly: sql<number>`SUM(CASE WHEN ${emails.isUnread} = 0 THEN 1 ELSE 0 END)`,
      readOnlySize: sql<number>`COALESCE(SUM(CASE WHEN ${emails.isUnread} = 0 THEN ${emails.sizeBytes} ELSE 0 END), 0)`,
    })
    .from(emails)
    .where(and(cleanableCondition, sql`${emails.category} IS NOT NULL`))
    .groupBy(emails.category)

  const cleanupCategories = {
    promotions: 0,
    promotionsSize: 0,
    social: 0,
    socialSize: 0,
    updates: 0,
    updatesSize: 0,
    forums: 0,
    forumsSize: 0,
    readPromotions: 0,
    readPromotionsSize: 0,
  }

  for (const row of cleanupCategoryResults) {
    const cat = row.category
    if (cat === 'CATEGORY_PROMOTIONS') {
      cleanupCategories.promotions = Number(row.total)
      cleanupCategories.promotionsSize = Number(row.totalSize ?? 0)
      cleanupCategories.readPromotions = Number(row.readOnly ?? 0)
      cleanupCategories.readPromotionsSize = Number(row.readOnlySize ?? 0)
    } else if (cat === 'CATEGORY_SOCIAL') {
      cleanupCategories.social = Number(row.total)
      cleanupCategories.socialSize = Number(row.totalSize ?? 0)
    } else if (cat === 'CATEGORY_UPDATES') {
      cleanupCategories.updates = Number(row.total)
      cleanupCategories.updatesSize = Number(row.totalSize ?? 0)
    } else if (cat === 'CATEGORY_FORUMS') {
      cleanupCategories.forums = Number(row.total)
      cleanupCategories.forumsSize = Number(row.totalSize ?? 0)
    }
  }

  const cleanupStatsResults = await db
    .select({
      olderThan1Year: sql<number>`SUM(CASE WHEN ${emails.internalDate} < ${oneYearAgo} THEN 1 ELSE 0 END)`,
      olderThan1YearSize: sql<number>`COALESCE(SUM(CASE WHEN ${emails.internalDate} < ${oneYearAgo} THEN ${emails.sizeBytes} ELSE 0 END), 0)`,
      olderThan2Years: sql<number>`SUM(CASE WHEN ${emails.internalDate} < ${twoYearsAgo} THEN 1 ELSE 0 END)`,
      olderThan2YearsSize: sql<number>`COALESCE(SUM(CASE WHEN ${emails.internalDate} < ${twoYearsAgo} THEN ${emails.sizeBytes} ELSE 0 END), 0)`,
      larger5MB: sql<number>`SUM(CASE WHEN ${emails.sizeBytes} > ${FIVE_MB} THEN 1 ELSE 0 END)`,
      larger5MBSize: sql<number>`COALESCE(SUM(CASE WHEN ${emails.sizeBytes} > ${FIVE_MB} THEN ${emails.sizeBytes} ELSE 0 END), 0)`,
      larger10MB: sql<number>`SUM(CASE WHEN ${emails.sizeBytes} > ${TEN_MB} THEN 1 ELSE 0 END)`,
      larger10MBSize: sql<number>`COALESCE(SUM(CASE WHEN ${emails.sizeBytes} > ${TEN_MB} THEN ${emails.sizeBytes} ELSE 0 END), 0)`,
    })
    .from(emails)
    .where(cleanableCondition)

  const cleanupStats = cleanupStatsResults[0]

  const senderCountResults = await db
    .select({ count: count() })
    .from(senders)
    .where(eq(senders.mailAccountId, accountId))
  const uniqueSenderCount = senderCountResults[0]?.count ?? 0

  return {
    total: Number(basicStats?.total ?? 0),
    unread: Number(basicStats?.unread ?? 0),
    categories,
    size: {
      larger5MB: Number(basicStats?.larger5MB ?? 0),
      larger10MB: Number(basicStats?.larger10MB ?? 0),
      totalStorageBytes: Number(basicStats?.totalStorageBytes ?? 0),
      trashStorageBytes: Number(trashStats?.sizeBytes ?? 0),
    },
    age: {
      olderThan1Year: Number(basicStats?.olderThan1Year ?? 0),
      olderThan2Years: Number(basicStats?.olderThan2Years ?? 0),
    },
    senders: {
      uniqueCount: Number(uniqueSenderCount),
    },
    trash: {
      count: Number(trashStats?.count ?? 0),
      sizeBytes: Number(trashStats?.sizeBytes ?? 0),
    },
    spam: {
      count: Number(spamStats?.count ?? 0),
      sizeBytes: Number(spamStats?.sizeBytes ?? 0),
    },
    cleanup: {
      promotions: {
        count: Number(cleanupCategories.promotions),
        size: Number(cleanupCategories.promotionsSize),
      },
      social: {
        count: Number(cleanupCategories.social),
        size: Number(cleanupCategories.socialSize),
      },
      updates: {
        count: Number(cleanupCategories.updates),
        size: Number(cleanupCategories.updatesSize),
      },
      forums: {
        count: Number(cleanupCategories.forums),
        size: Number(cleanupCategories.forumsSize),
      },
      readPromotions: {
        count: Number(cleanupCategories.readPromotions),
        size: Number(cleanupCategories.readPromotionsSize),
      },
      olderThan1Year: {
        count: Number(cleanupStats?.olderThan1Year ?? 0),
        size: Number(cleanupStats?.olderThan1YearSize ?? 0),
      },
      olderThan2Years: {
        count: Number(cleanupStats?.olderThan2Years ?? 0),
        size: Number(cleanupStats?.olderThan2YearsSize ?? 0),
      },
      larger5MB: {
        count: Number(cleanupStats?.larger5MB ?? 0),
        size: Number(cleanupStats?.larger5MBSize ?? 0),
      },
      larger10MB: {
        count: Number(cleanupStats?.larger10MB ?? 0),
        size: Number(cleanupStats?.larger10MBSize ?? 0),
      },
    },
  }
}

// ============================================================================
// Account Stats for AI Agent
// ============================================================================

/**
 * Account statistics for AI agent context
 */
export interface AIAccountStats {
  totalEmails: number
  unread: number
  categories: {
    promotions: number
    social: number
    updates: number
    forums: number
    primary: number
  }
  totalStorageBytes: number
  uniqueSenderCount: number
}

/**
 * Get account statistics for AI agent context
 */
export async function getAccountStats(accountId: string): Promise<AIAccountStats> {
  // Get total counts and size
  const [totals] = await db
    .select({
      totalEmails: count(),
      totalStorageBytes: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)`,
      unreadCount: sql<number>`SUM(CASE WHEN ${emails.isUnread} = 1 THEN 1 ELSE 0 END)`,
    })
    .from(emails)
    .where(and(eq(emails.mailAccountId, accountId), eq(emails.isTrash, 0), eq(emails.isSpam, 0)))

  // Get category breakdown
  const categoryStats = await db
    .select({
      category: emails.category,
      count: count(),
    })
    .from(emails)
    .where(
      and(
        eq(emails.mailAccountId, accountId),
        eq(emails.isTrash, 0),
        eq(emails.isSpam, 0),
        sql`${emails.category} IS NOT NULL`
      )
    )
    .groupBy(emails.category)

  // Map categories
  const categories = {
    promotions: 0,
    social: 0,
    updates: 0,
    forums: 0,
    primary: 0,
  }

  for (const stat of categoryStats) {
    switch (stat.category) {
      case 'CATEGORY_PROMOTIONS':
        categories.promotions = stat.count
        break
      case 'CATEGORY_SOCIAL':
        categories.social = stat.count
        break
      case 'CATEGORY_UPDATES':
        categories.updates = stat.count
        break
      case 'CATEGORY_FORUMS':
        categories.forums = stat.count
        break
      case 'CATEGORY_PERSONAL':
        categories.primary = stat.count
        break
    }
  }

  // Get unique sender count
  const [senderStats] = await db
    .select({
      uniqueSenderCount: sql<number>`COUNT(DISTINCT ${emails.fromEmail})`,
    })
    .from(emails)
    .where(and(eq(emails.mailAccountId, accountId), eq(emails.isTrash, 0), eq(emails.isSpam, 0)))

  return {
    totalEmails: totals?.totalEmails ?? 0,
    unread: Number(totals?.unreadCount ?? 0),
    categories,
    totalStorageBytes: Number(totals?.totalStorageBytes ?? 0),
    uniqueSenderCount: Number(senderStats?.uniqueSenderCount ?? 0),
  }
}
