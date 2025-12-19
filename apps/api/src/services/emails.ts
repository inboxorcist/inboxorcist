/**
 * Email Service
 *
 * Database operations for email metadata.
 * All emails are stored in the main database with gmailAccountId for multi-tenancy.
 */

import { sql, eq, and, or, gt, lt, gte, lte, like, desc, asc, count, inArray } from 'drizzle-orm'
import { db, tables } from '../db'
import { logger } from '../lib/logger'

const { emails, senders } = tables

// ============================================================================
// Types
// ============================================================================

/**
 * Email metadata record for database operations
 */
export interface EmailRecord {
  gmail_id: string
  thread_id: string
  subject: string | null
  snippet: string | null
  from_email: string
  from_name: string | null
  labels: string // JSON array
  category: string | null
  size_bytes: number
  has_attachments: number // 0 or 1
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
  sender?: string // Comma-separated email addresses
  senderDomain?: string // Comma-separated domains
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
    gmail_id: row.gmailId,
    thread_id: row.threadId ?? '',
    subject: row.subject,
    snippet: row.snippet,
    from_email: row.fromEmail,
    from_name: row.fromName,
    labels: row.labels ?? '[]',
    category: row.category,
    size_bytes: row.sizeBytes ?? 0,
    has_attachments: row.hasAttachments ?? 0,
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
 * Build WHERE conditions from filters
 */
function buildWhereConditions(accountId: string, filters: ExplorerFilters) {
  const conditions = [eq(emails.gmailAccountId, accountId)]

  const senderConditions = []

  if (filters.sender) {
    const senderList = filters.sender
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (senderList.length === 1) {
      senderConditions.push(like(emails.fromEmail, `%${senderList[0]}%`))
    } else if (senderList.length > 1) {
      senderConditions.push(inArray(emails.fromEmail, senderList))
    }
  }

  if (filters.senderDomain) {
    const domainList = filters.senderDomain
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean)
    for (const domain of domainList) {
      senderConditions.push(like(emails.fromEmail, `%@${domain}`))
    }
  }

  if (senderConditions.length === 1) {
    conditions.push(senderConditions[0]!)
  } else if (senderConditions.length > 1) {
    conditions.push(or(...senderConditions)!)
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
    conditions.push(eq(emails.hasAttachments, filters.hasAttachments ? 1 : 0))
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
  if (filters.search) {
    conditions.push(like(emails.subject, `%${filters.search}%`))
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
  await db.delete(emails).where(eq(emails.gmailAccountId, accountId))
  await db.delete(senders).where(eq(senders.gmailAccountId, accountId))
}

/**
 * Insert or update a batch of emails
 */
export async function insertEmails(accountId: string, emailRecords: EmailRecord[]): Promise<void> {
  if (emailRecords.length === 0) return

  const values = emailRecords.map((email) => ({
    gmailId: String(email.gmail_id || ''),
    gmailAccountId: accountId,
    threadId: String(email.thread_id || ''),
    subject: email.subject ?? null,
    snippet: email.snippet ?? null,
    fromEmail: String(email.from_email || 'unknown@unknown.com'),
    fromName: email.from_name ?? null,
    labels: String(email.labels || '[]'),
    category: email.category ?? null,
    sizeBytes: toSafeInt(email.size_bytes),
    hasAttachments: toSafeInt(email.has_attachments),
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
      target: [emails.gmailId, emails.gmailAccountId],
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
 * Delete emails by Gmail IDs
 */
export async function deleteEmailsByIds(accountId: string, gmailIds: string[]): Promise<number> {
  if (gmailIds.length === 0) return 0

  await db
    .delete(emails)
    .where(and(eq(emails.gmailAccountId, accountId), inArray(emails.gmailId, gmailIds)))

  return gmailIds.length
}

/**
 * Mark emails as trashed in local database
 */
export async function markEmailsAsTrashed(accountId: string, gmailIds: string[]): Promise<number> {
  if (gmailIds.length === 0) return 0

  await db
    .update(emails)
    .set({ isTrash: 1 })
    .where(and(eq(emails.gmailAccountId, accountId), inArray(emails.gmailId, gmailIds)))

  return gmailIds.length
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
    .select({ gmailId: emails.gmailId, labels: emails.labels })
    .from(emails)
    .where(and(eq(emails.gmailAccountId, accountId), eq(emails.gmailId, messageId)))
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
    .where(and(eq(emails.gmailAccountId, accountId), eq(emails.gmailId, messageId)))

  return true
}

// ============================================================================
// Sender Aggregation
// ============================================================================

/**
 * Build sender aggregates from the emails table
 */
export async function buildSenderAggregates(accountId: string): Promise<void> {
  await db.delete(senders).where(eq(senders.gmailAccountId, accountId))

  // Use Drizzle query builder to aggregate and insert (works for both Postgres and SQLite)
  const aggregatedSenders = await db
    .select({
      gmailAccountId: emails.gmailAccountId,
      email: emails.fromEmail,
      name: sql<string | null>`MAX(${emails.fromName})`,
      count: count(),
      totalSize: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)`,
    })
    .from(emails)
    .where(eq(emails.gmailAccountId, accountId))
    .groupBy(emails.gmailAccountId, emails.fromEmail)
    .orderBy(desc(count()))

  // Insert in batches
  const BATCH_SIZE = 500
  for (let i = 0; i < aggregatedSenders.length; i += BATCH_SIZE) {
    const batch = aggregatedSenders.slice(i, i + BATCH_SIZE)
    if (batch.length > 0) {
      await db.insert(senders).values(
        batch.map((s) => ({
          gmailAccountId: s.gmailAccountId,
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
    .where(eq(senders.gmailAccountId, accountId))
    .orderBy(desc(senders.count))
    .limit(limit)

  return results.map(toSenderRecord)
}

/**
 * Get senders with unsubscribe links for subscriptions page
 */
export async function getSendersWithUnsubscribe(
  accountId: string,
  limit = 100,
  offset = 0,
  filters: SubscriptionFilters = {}
): Promise<{ senders: SenderWithUnsubscribe[]; total: number }> {
  let results: SenderWithUnsubscribe[] = []
  let total = 0

  try {
    const rawResults = await db
      .select({
        email: emails.fromEmail,
        name: emails.fromName,
        count: count(),
        totalSize: sql<number>`SUM(${emails.sizeBytes})`,
        firstDate: sql<number>`MIN(${emails.internalDate})`,
        latestDate: sql<number>`MAX(${emails.internalDate})`,
      })
      .from(emails)
      .where(and(eq(emails.gmailAccountId, accountId), sql`${emails.unsubscribeLink} IS NOT NULL`))
      .groupBy(emails.gmailAccountId, emails.fromEmail, emails.fromName)
      .orderBy(desc(count()))
      .limit(limit)
      .offset(offset)

    for (const row of rawResults) {
      const unsubLinkResults = await db
        .select({ unsubscribeLink: emails.unsubscribeLink })
        .from(emails)
        .where(
          and(
            eq(emails.gmailAccountId, accountId),
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

    total = results.length < limit ? offset + results.length : offset + limit + 1

    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      results = results.filter(
        (r) =>
          r.email.toLowerCase().includes(searchLower) ||
          (r.name && r.name.toLowerCase().includes(searchLower))
      )
      total = results.length
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
    .where(eq(senders.gmailAccountId, accountId))
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
      .where(and(eq(emails.gmailAccountId, accountId), like(emails.fromEmail, `%${search}%`)))
      .orderBy(emails.fromEmail)
      .limit(limit)
    return results.map((r) => r.fromEmail)
  } else {
    const results = await db
      .select({ email: senders.email })
      .from(senders)
      .where(eq(senders.gmailAccountId, accountId))
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
 * Get all Gmail IDs matching filters (for bulk operations)
 */
export async function getEmailIdsByFilters(
  accountId: string,
  filters: ExplorerFilters
): Promise<string[]> {
  const whereCondition = buildWhereConditions(accountId, filters)
  const results = await db.select({ gmailId: emails.gmailId }).from(emails).where(whereCondition)
  return results.map((r) => r.gmailId)
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
    .where(and(eq(emails.gmailAccountId, accountId), sql`${emails.category} IS NOT NULL`))
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
    .where(eq(emails.gmailAccountId, accountId))
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
    .where(and(eq(emails.gmailAccountId, accountId), sql`${emails.category} IS NOT NULL`))
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
    .where(eq(senders.gmailAccountId, accountId))
  return results[0]?.count ?? 0
}

/**
 * Get total storage used by all emails
 */
export async function getTotalStorageBytes(accountId: string): Promise<number> {
  const results = await db
    .select({ total: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)` })
    .from(emails)
    .where(eq(emails.gmailAccountId, accountId))
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
    .where(and(eq(emails.gmailAccountId, accountId), gt(emails.sizeBytes, sizeBytes)))
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
    .where(and(eq(emails.gmailAccountId, accountId), lt(emails.internalDate, timestampMs)))
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
    .where(and(eq(emails.gmailAccountId, accountId), eq(emails.fromEmail, senderEmail)))
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
    .where(and(eq(emails.gmailAccountId, accountId), eq(emails.category, category)))
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
    .where(and(eq(emails.gmailAccountId, accountId), gt(emails.sizeBytes, sizeBytes)))
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
    .where(and(eq(emails.gmailAccountId, accountId), lt(emails.internalDate, dateMs)))
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
    .where(and(eq(emails.gmailAccountId, accountId), eq(emails.isUnread, 1)))
    .orderBy(desc(emails.internalDate))
    .limit(limit)
    .offset(offset)
  return results.map(toEmailRecord)
}

/**
 * Get Gmail IDs by sender (for bulk operations)
 */
export async function getGmailIdsBySender(
  accountId: string,
  senderEmail: string
): Promise<string[]> {
  const results = await db
    .select({ gmailId: emails.gmailId })
    .from(emails)
    .where(and(eq(emails.gmailAccountId, accountId), eq(emails.fromEmail, senderEmail)))
  return results.map((r) => r.gmailId)
}

/**
 * Get Gmail IDs by category (for bulk operations)
 */
export async function getGmailIdsByCategory(
  accountId: string,
  category: string
): Promise<string[]> {
  const results = await db
    .select({ gmailId: emails.gmailId })
    .from(emails)
    .where(and(eq(emails.gmailAccountId, accountId), eq(emails.category, category)))
  return results.map((r) => r.gmailId)
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
    .where(eq(emails.gmailAccountId, accountId))

  const ageResults = await db
    .select({
      olderThan1Year: sql<number>`SUM(CASE WHEN ${emails.internalDate} < ${oneYearAgo} THEN 1 ELSE 0 END)`,
      olderThan2Years: sql<number>`SUM(CASE WHEN ${emails.internalDate} < ${twoYearsAgo} THEN 1 ELSE 0 END)`,
      olderThan3Years: sql<number>`SUM(CASE WHEN ${emails.internalDate} < ${threeYearsAgo} THEN 1 ELSE 0 END)`,
    })
    .from(emails)
    .where(eq(emails.gmailAccountId, accountId))

  const sizeStats = sizeResults[0]
  const ageStats = ageResults[0]

  return {
    size: {
      larger5MB: sizeStats?.larger5MB ?? 0,
      larger10MB: sizeStats?.larger10MB ?? 0,
      totalStorageBytes: Number(sizeStats?.totalStorageBytes ?? 0),
    },
    age: {
      olderThan1Year: ageStats?.olderThan1Year ?? 0,
      olderThan2Years: ageStats?.olderThan2Years ?? 0,
      olderThan3Years: ageStats?.olderThan3Years ?? 0,
    },
  }
}

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
    eq(emails.gmailAccountId, accountId),
    eq(emails.isTrash, 0),
    eq(emails.isSpam, 0)
  )

  const cleanableCondition = and(
    eq(emails.gmailAccountId, accountId),
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
    .where(and(eq(emails.gmailAccountId, accountId), eq(emails.isTrash, 1)))

  const trashStats = trashStatsResults[0]

  const spamStatsResults = await db
    .select({
      count: count(),
      sizeBytes: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)`,
    })
    .from(emails)
    .where(and(eq(emails.gmailAccountId, accountId), eq(emails.isSpam, 1), eq(emails.isTrash, 0)))

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
    if (cat === 'CATEGORY_PROMOTIONS') categories.promotions = row.count
    else if (cat === 'CATEGORY_SOCIAL') categories.social = row.count
    else if (cat === 'CATEGORY_UPDATES') categories.updates = row.count
    else if (cat === 'CATEGORY_FORUMS') categories.forums = row.count
    else if (cat === 'CATEGORY_PERSONAL') categories.primary = row.count
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
      cleanupCategories.promotions = row.total
      cleanupCategories.promotionsSize = Number(row.totalSize ?? 0)
      cleanupCategories.readPromotions = row.readOnly ?? 0
      cleanupCategories.readPromotionsSize = Number(row.readOnlySize ?? 0)
    } else if (cat === 'CATEGORY_SOCIAL') {
      cleanupCategories.social = row.total
      cleanupCategories.socialSize = Number(row.totalSize ?? 0)
    } else if (cat === 'CATEGORY_UPDATES') {
      cleanupCategories.updates = row.total
      cleanupCategories.updatesSize = Number(row.totalSize ?? 0)
    } else if (cat === 'CATEGORY_FORUMS') {
      cleanupCategories.forums = row.total
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
    .where(eq(senders.gmailAccountId, accountId))
  const uniqueSenderCount = senderCountResults[0]?.count ?? 0

  return {
    total: basicStats?.total ?? 0,
    unread: basicStats?.unread ?? 0,
    categories,
    size: {
      larger5MB: basicStats?.larger5MB ?? 0,
      larger10MB: basicStats?.larger10MB ?? 0,
      totalStorageBytes: Number(basicStats?.totalStorageBytes ?? 0),
      trashStorageBytes: Number(trashStats?.sizeBytes ?? 0),
    },
    age: {
      olderThan1Year: basicStats?.olderThan1Year ?? 0,
      olderThan2Years: basicStats?.olderThan2Years ?? 0,
    },
    senders: {
      uniqueCount: uniqueSenderCount,
    },
    trash: {
      count: trashStats?.count ?? 0,
      sizeBytes: Number(trashStats?.sizeBytes ?? 0),
    },
    spam: {
      count: spamStats?.count ?? 0,
      sizeBytes: Number(spamStats?.sizeBytes ?? 0),
    },
    cleanup: {
      promotions: { count: cleanupCategories.promotions, size: cleanupCategories.promotionsSize },
      social: { count: cleanupCategories.social, size: cleanupCategories.socialSize },
      updates: { count: cleanupCategories.updates, size: cleanupCategories.updatesSize },
      forums: { count: cleanupCategories.forums, size: cleanupCategories.forumsSize },
      readPromotions: {
        count: cleanupCategories.readPromotions,
        size: cleanupCategories.readPromotionsSize,
      },
      olderThan1Year: {
        count: cleanupStats?.olderThan1Year ?? 0,
        size: Number(cleanupStats?.olderThan1YearSize ?? 0),
      },
      olderThan2Years: {
        count: cleanupStats?.olderThan2Years ?? 0,
        size: Number(cleanupStats?.olderThan2YearsSize ?? 0),
      },
      larger5MB: {
        count: cleanupStats?.larger5MB ?? 0,
        size: Number(cleanupStats?.larger5MBSize ?? 0),
      },
      larger10MB: {
        count: cleanupStats?.larger10MB ?? 0,
        size: Number(cleanupStats?.larger10MBSize ?? 0),
      },
    },
  }
}
