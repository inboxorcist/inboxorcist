/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AI Tools Definition
 *
 * Defines all tools available to the AI agent.
 * IMPORTANT: All tools reuse existing service functions - no logic duplication.
 */

import { tool } from 'ai'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { formatBytes } from './types'
import { logger } from '../../lib/logger'
import { db, tables, dbType } from '../../db'
import { getCleanupQueries } from './prompt'

// Import existing service functions
import {
  queryEmailsUnified,
  getMessageIdsByFiltersWithSize,
  getEmailContent,
  getSendersWithUnsubscribe,
  type ExplorerFilters,
} from '../emails'
import { listLabels, listFilters } from '../filters'

/**
 * Convert tool parameters to ExplorerFilters
 *
 * Handles three states for each parameter:
 * - actual value (string/boolean/number) = apply filter
 * - null = explicitly no filter (ignore)
 * - undefined = not provided (ignore)
 * - empty string "" = ignore
 */
export function toExplorerFilters(params: {
  sender?: string | null
  senderEmail?: string | null
  senderDomain?: string | null
  category?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  sizeMin?: number | null
  sizeMax?: number | null
  hasAttachments?: boolean | null
  isUnread?: boolean | null
  isStarred?: boolean | null
  isTrash?: boolean | null
  isSpam?: boolean | null
  isImportant?: boolean | null
  isSent?: boolean | null
  isArchived?: boolean | null
  labelIds?: string | null
  search?: string | null
}): ExplorerFilters {
  const filters: ExplorerFilters = {}

  // String filters: only include if non-null and non-empty
  if (params.sender && params.sender.trim() !== '') {
    filters.sender = params.sender.trim()
  }

  if (params.senderEmail && params.senderEmail.trim() !== '') {
    filters.senderEmail = params.senderEmail.trim()
  }

  if (params.senderDomain && params.senderDomain.trim() !== '') {
    filters.senderDomain = params.senderDomain.trim()
  }

  if (params.category && params.category.trim() !== '') {
    filters.category = params.category.trim()
  }

  if (params.search && params.search.trim() !== '') {
    filters.search = params.search.trim()
  }

  if (params.labelIds && params.labelIds.trim() !== '') {
    filters.labelIds = params.labelIds.trim()
  }

  // Date filters: only if non-null, non-empty, and valid date
  if (params.dateFrom && params.dateFrom.trim() !== '') {
    const date = new Date(params.dateFrom)
    if (!isNaN(date.getTime())) {
      filters.dateFrom = date.getTime()
    }
  }
  if (params.dateTo && params.dateTo.trim() !== '') {
    const date = new Date(params.dateTo)
    if (!isNaN(date.getTime())) {
      filters.dateTo = date.getTime()
    }
  }

  // Size filters: only if non-null and positive
  if (typeof params.sizeMin === 'number' && params.sizeMin > 0) {
    filters.sizeMin = params.sizeMin
  }
  if (typeof params.sizeMax === 'number' && params.sizeMax > 0) {
    filters.sizeMax = params.sizeMax
  }

  // Boolean filters: only include if explicitly true or false (not null/undefined)
  // null means "both" (no filter), true/false means specific filter
  if (params.hasAttachments === true || params.hasAttachments === false) {
    filters.hasAttachments = params.hasAttachments
  }
  if (params.isUnread === true || params.isUnread === false) {
    filters.isUnread = params.isUnread
  }
  if (params.isStarred === true || params.isStarred === false) {
    filters.isStarred = params.isStarred
  }
  if (params.isTrash === true || params.isTrash === false) {
    filters.isTrash = params.isTrash
  }
  if (params.isSpam === true || params.isSpam === false) {
    filters.isSpam = params.isSpam
  }
  if (params.isImportant === true || params.isImportant === false) {
    filters.isImportant = params.isImportant
  }
  if (params.isSent === true || params.isSent === false) {
    filters.isSent = params.isSent
  }
  if (params.isArchived === true || params.isArchived === false) {
    filters.isArchived = params.isArchived
  }

  return filters
}

/**
 * Build human-readable filter description from ExplorerFilters
 */
function buildFilterDescription(filters: ExplorerFilters): string {
  const details: string[] = []

  // Sender filters
  if (filters.sender) details.push(`from "${filters.sender}"`)
  if (filters.senderEmail) details.push(`from ${filters.senderEmail}`)
  if (filters.senderDomain) details.push(`from @${filters.senderDomain}`)

  // Category
  if (filters.category)
    details.push(`in ${filters.category.replace('CATEGORY_', '').toLowerCase()}`)

  // Date filters
  if (filters.dateFrom)
    details.push(`after ${new Date(filters.dateFrom).toISOString().split('T')[0]}`)
  if (filters.dateTo) details.push(`before ${new Date(filters.dateTo).toISOString().split('T')[0]}`)

  // Size filters
  if (filters.sizeMin) details.push(`larger than ${formatBytes(filters.sizeMin)}`)
  if (filters.sizeMax) details.push(`smaller than ${formatBytes(filters.sizeMax)}`)

  // Search
  if (filters.search) details.push(`subject contains "${filters.search}"`)

  // Labels
  if (filters.labelIds) details.push(`with label ${filters.labelIds}`)

  // Boolean filters
  if (filters.hasAttachments === true) details.push('with attachments')
  if (filters.hasAttachments === false) details.push('without attachments')
  if (filters.isUnread === true) details.push('unread')
  if (filters.isUnread === false) details.push('read')
  if (filters.isStarred === true) details.push('starred')
  if (filters.isStarred === false) details.push('not starred')
  if (filters.isImportant === true) details.push('important')
  if (filters.isImportant === false) details.push('not important')
  if (filters.isTrash === true) details.push('in trash')
  if (filters.isSpam === true) details.push('in spam')
  if (filters.isSent === true) details.push('sent emails')
  if (filters.isArchived === true) details.push('archived')

  return details.length > 0 ? details.join(', ') : 'matching your criteria'
}

/**
 * Store query result in database cache
 */
async function storeQueryCache(
  queryId: string,
  mailAccountId: string,
  filters: ExplorerFilters,
  count: number,
  totalSize: number
): Promise<void> {
  const now = new Date()

  await db.insert(tables.aiQueryCache).values({
    queryId,
    mailAccountId,
    filters: JSON.stringify(filters),
    count,
    totalSize,
    createdAt: dbType === 'postgres' ? now : now.toISOString(),
  } as any)
}

/**
 * Get query result from database cache
 * Note: Cache entries never expire - they're used for displaying email tables in chat
 */
async function getQueryCache(
  queryId: string
): Promise<{ filters: ExplorerFilters; count: number; totalSize: number } | null> {
  const [result] = await db
    .select()
    .from(tables.aiQueryCache)
    .where(eq(tables.aiQueryCache.queryId, queryId))
    .limit(1)

  if (!result) return null

  return {
    filters: JSON.parse(result.filters) as ExplorerFilters,
    count: result.count,
    totalSize: result.totalSize,
  }
}

/**
 * Clean up query cache entries (deprecated - cache no longer expires)
 * Kept for backwards compatibility but does nothing meaningful now
 */
export async function cleanupExpiredQueryCache(): Promise<number> {
  // Cache entries no longer expire - they're used for displaying email tables in chat
  return 0
}

/**
 * Create all AI tools bound to a specific account
 */
export function createTools(accountId: string) {
  return {
    // ═══════════════════════════════════════════════════════════════════════
    // UNIFIED QUERY TOOL
    // ═══════════════════════════════════════════════════════════════════════

    queryEmails: tool({
      description: `Query emails. Use null for "no filter" on any field.

**Sender filters:**
- sender: partial match on name/email
- senderEmail: exact email(s) comma-separated
- senderDomain: exact domain(s) comma-separated

**Category:** CATEGORY_PROMOTIONS|SOCIAL|UPDATES|FORUMS|PERSONAL

**Date filters:** dateFrom/dateTo as ISO date strings

**Size filters:** sizeMin/sizeMax in bytes (e.g., 5000000 for 5MB)

**Boolean filters (true/false/null):**
- hasAttachments: has file attachments
- isUnread: unread emails
- isStarred: starred emails
- isImportant: marked important
- isTrash: in trash folder
- isSpam: in spam folder
- isSent: sent emails
- isArchived: archived (not in inbox)

**Labels:** labelIds - comma-separated Gmail label IDs

**Output modes:**
- breakdownBy: sender|category|month (null = return email list)
- sortBy: count|size (for breakdown)
- limit: max results (default 20)`,
      inputSchema: z.object({
        sender: z.string().nullable().optional().describe('Partial match on sender name/email'),
        senderEmail: z.string().nullable().optional().describe('Exact email(s), comma-separated'),
        senderDomain: z.string().nullable().optional().describe('Exact domain(s), comma-separated'),
        category: z
          .enum([
            'CATEGORY_PROMOTIONS',
            'CATEGORY_SOCIAL',
            'CATEGORY_UPDATES',
            'CATEGORY_FORUMS',
            'CATEGORY_PERSONAL',
          ])
          .nullable()
          .optional()
          .describe('Gmail category'),
        dateFrom: z.string().nullable().optional().describe('Emails after this ISO date'),
        dateTo: z.string().nullable().optional().describe('Emails before this ISO date'),
        sizeMin: z.number().nullable().optional().describe('Min size in bytes'),
        sizeMax: z.number().nullable().optional().describe('Max size in bytes'),
        search: z.string().nullable().optional().describe('Search in subject'),
        labelIds: z.string().nullable().optional().describe('Comma-separated Gmail label IDs'),
        hasAttachments: z.boolean().nullable().optional().describe('Has attachments'),
        isUnread: z.boolean().nullable().optional().describe('Is unread'),
        isStarred: z.boolean().nullable().optional().describe('Is starred'),
        isImportant: z.boolean().nullable().optional().describe('Is marked important'),
        isTrash: z.boolean().nullable().optional().describe('Is in trash'),
        isSpam: z.boolean().nullable().optional().describe('Is in spam'),
        isSent: z.boolean().nullable().optional().describe('Is sent email'),
        isArchived: z.boolean().nullable().optional().describe('Is archived (not in inbox)'),
        breakdownBy: z
          .enum(['sender', 'category', 'month'])
          .nullable()
          .optional()
          .describe('Group by field'),
        sortBy: z.enum(['count', 'size']).optional().describe('Sort breakdown by (default: count)'),
        sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort direction (default: desc)'),
        limit: z.number().optional().describe('Max results (default 10, max 20)'),
      }),
      execute: async (params) => {
        const filters = toExplorerFilters(params)
        // Cap limit at 20 to prevent context window overflow
        const limit = Math.min(params.limit || 10, 20)
        const result = await queryEmailsUnified(accountId, {
          filters,
          breakdownBy: params.breakdownBy ?? undefined,
          breakdownSortBy: params.sortBy ?? 'count',
          breakdownSortOrder: params.sortOrder ?? 'desc',
          limit,
        })

        // Generate queryId and store filters in database for use by trash/delete tools and email table display
        const queryId = `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        await storeQueryCache(queryId, accountId, filters, result.count, result.totalSizeBytes)

        // If breakdown requested, return the breakdown data
        if (result.breakdown) {
          return {
            queryId,
            count: result.count,
            totalSizeBytes: result.totalSizeBytes,
            totalSizeFormatted: result.totalSizeFormatted,
            appliedFilters: result.appliedFilters,
            breakdown: result.breakdown,
          }
        }

        // For non-breakdown queries, return summary only
        // AI should use <email-table queryId="..." title="..." /> to display the emails
        return {
          queryId,
          count: result.count,
          totalSizeBytes: result.totalSizeBytes,
          totalSizeFormatted: result.totalSizeFormatted,
          appliedFilters: result.appliedFilters,
          // Note: Use <email-table queryId="..." title="Descriptive title" /> in your response to display emails
          // The title should briefly describe what emails are being shown (e.g., "Old Promotions", "Flipkart emails before 2020")
        }
      },
    }),

    // ═══════════════════════════════════════════════════════════════════════
    // SPECIALIZED READ TOOLS
    // ═══════════════════════════════════════════════════════════════════════

    getEmailContent: tool({
      description:
        'Fetch the full content of a specific email by its message ID. Use this when you need to read the actual email body.',
      inputSchema: z.object({
        messageId: z.string().describe('The message ID from queryEmails results'),
      }),
      execute: async ({ messageId }) => {
        const content = await getEmailContent(accountId, messageId)
        if (!content) {
          return { error: 'Email not found or could not be fetched' }
        }
        return {
          id: content.id,
          subject: content.headers.subject,
          from: content.headers.from,
          to: content.headers.to,
          date: content.headers.date,
          body: content.body.text || content.body.html || '(No body content)',
          hasHtml: !!content.body.html,
          attachments: content.attachments.map((a) => ({
            filename: a.filename,
            mimeType: a.mimeType,
            size: formatBytes(a.size),
          })),
        }
      },
    }),

    listLabels: tool({
      description: 'Get all Gmail labels for the account. Includes both system and user labels.',
      inputSchema: z.object({}),
      execute: async () => {
        const labels = await listLabels(accountId)
        return labels.map((l) => ({
          id: l.id,
          name: l.name,
          type: l.type,
          messagesTotal: l.messagesTotal,
        }))
      },
    }),

    listFilters: tool({
      description: 'Get all existing Gmail filter rules. Shows what auto-actions are set up.',
      inputSchema: z.object({}),
      execute: async () => {
        const filters = await listFilters(accountId)
        return filters.map((f) => ({
          id: f.id,
          criteria: f.criteria,
          action: f.action,
        }))
      },
    }),

    listSubscriptions: tool({
      description: `Get senders with unsubscribe links (newsletters, marketing).

- search: filter by sender name/email
- minCount/maxCount: filter by email count
- minSize/maxSize: filter by total size (bytes)
- dateFrom: senders active after this date (timestamp ms)
- dateTo: senders inactive since this date (timestamp ms)
- sortBy: count|size|first_date|latest_date|name
- sortOrder: asc|desc
- limit: max results (default 50)`,
      inputSchema: z.object({
        search: z.string().nullable().optional().describe('Search sender name/email'),
        minCount: z.number().nullable().optional().describe('Min email count'),
        maxCount: z.number().nullable().optional().describe('Max email count'),
        minSize: z.number().nullable().optional().describe('Min total size in bytes'),
        maxSize: z.number().nullable().optional().describe('Max total size in bytes'),
        dateFrom: z.number().nullable().optional().describe('Active after this timestamp (ms)'),
        dateTo: z.number().nullable().optional().describe('Inactive since this timestamp (ms)'),
        sortBy: z
          .enum(['count', 'size', 'first_date', 'latest_date', 'name'])
          .nullable()
          .optional()
          .describe('Sort field'),
        sortOrder: z.enum(['asc', 'desc']).nullable().optional().describe('Sort direction'),
        limit: z.number().optional().describe('Max results (default 50)'),
      }),
      execute: async (params) => {
        const { senders, total } = await getSendersWithUnsubscribe(
          accountId,
          params.limit || 50,
          0,
          {
            search: params.search ?? undefined,
            minCount: params.minCount ?? undefined,
            maxCount: params.maxCount ?? undefined,
            minSize: params.minSize ?? undefined,
            maxSize: params.maxSize ?? undefined,
            dateFrom: params.dateFrom ?? undefined,
            dateTo: params.dateTo ?? undefined,
            sortBy: params.sortBy ?? undefined,
            sortOrder: params.sortOrder ?? undefined,
          }
        )
        return {
          total,
          subscriptions: senders.map((s) => ({
            email: s.email,
            name: s.name,
            emailCount: s.count,
            totalSize: s.total_size,
            totalSizeFormatted: formatBytes(s.total_size),
            firstDate: new Date(s.first_date).toISOString(),
            latestDate: new Date(s.latest_date).toISOString(),
            unsubscribeLink: s.unsubscribe_link ? s.unsubscribe_link.slice(0, 16) + '...' : null,
          })),
        }
      },
    }),

    analyzeInbox: tool({
      description: `Analyze inbox and find cleanup opportunities based on email patterns.

Returns a prioritized list of cleanup opportunities with:
- High-confidence patterns (old unread promotions, expired OTPs, social notifications)
- Storage impact estimates
- Safety ratings

Use this as a starting point when user asks for help cleaning their inbox.`,
      inputSchema: z.object({
        focus: z
          .enum(['all', 'storage', 'count', 'unread'])
          .optional()
          .describe(
            'Focus area: all (default), storage (large emails), count (bulk senders), unread (ignored emails)'
          ),
      }),
      execute: async (params) => {
        const cleanupQueries = getCleanupQueries()
        const opportunities: Array<{
          name: string
          description: string
          count: number
          totalSize: number
          totalSizeFormatted: string
          safety: 'high' | 'moderate'
          queryId: string
        }> = []

        // Run each cleanup query to get actual counts
        for (const query of cleanupQueries) {
          // Skip based on focus
          if (params.focus === 'storage' && query.name !== 'Large Old Emails') continue
          if (params.focus === 'unread' && !query.filters.isUnread) continue

          const filters = toExplorerFilters(
            query.filters as Parameters<typeof toExplorerFilters>[0]
          )
          const result = await queryEmailsUnified(accountId, { filters, limit: 1 })

          if (result.count > 0) {
            // Store query for later use
            const queryId = `analyze_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
            await storeQueryCache(queryId, accountId, filters, result.count, result.totalSizeBytes)

            opportunities.push({
              name: query.name,
              description: query.description,
              count: result.count,
              totalSize: result.totalSizeBytes,
              totalSizeFormatted: result.totalSizeFormatted,
              safety: query.safety,
              queryId,
            })
          }
        }

        // Sort by count (most impactful first)
        opportunities.sort((a, b) => b.count - a.count)

        const totalCount = opportunities.reduce((sum, o) => sum + o.count, 0)
        const totalSize = opportunities.reduce((sum, o) => sum + o.totalSize, 0)

        return {
          opportunities,
          summary: {
            totalCleanupOpportunities: opportunities.length,
            totalEmailsToClean: totalCount,
            totalSizeToFree: totalSize,
            totalSizeFormatted: formatBytes(totalSize),
          },
          recommendation:
            opportunities.length > 0
              ? `Found ${opportunities.length} cleanup opportunities totaling ${totalCount.toLocaleString()} emails (${formatBytes(totalSize)}). Start with high-safety patterns like "${opportunities.find((o) => o.safety === 'high')?.name ?? opportunities[0]?.name ?? 'the first opportunity'}".`
              : 'No significant cleanup opportunities found. Your inbox is relatively clean!',
        }
      },
    }),

    // ═══════════════════════════════════════════════════════════════════════
    // ACTION TOOLS (Require user approval)
    // ═══════════════════════════════════════════════════════════════════════

    deleteEmails: tool({
      description: `PERMANENTLY delete emails. Only use when user explicitly says "permanently delete".

Pass the queryId from queryEmails result - filters will be used automatically.`,
      inputSchema: z.object({
        queryId: z.string().describe('The queryId from queryEmails result'),
      }),
      execute: async (params) => {
        logger.debug('[Tool:deleteEmails] Called with queryId:', params.queryId)

        // Look up the cached query from database
        const cachedQuery = await getQueryCache(params.queryId)
        if (!cachedQuery) {
          logger.error('[Tool:deleteEmails] Query not found or expired:', params.queryId)
          return { error: `Query ${params.queryId} not found or expired. Run queryEmails first.` }
        }

        const { filters } = cachedQuery
        logger.debug('[Tool:deleteEmails] Using cached filters:', filters)

        const { messageIds, totalSize } = await getMessageIdsByFiltersWithSize(accountId, filters)
        logger.debug('[Tool:deleteEmails] Found emails:', { count: messageIds.length, totalSize })

        if (messageIds.length === 0) {
          return { deleted: 0, message: 'No emails matched the criteria' }
        }

        // Return confirmation request
        return {
          confirmation_required: true,
          action: 'delete' as const,
          count: messageIds.length,
          totalSize,
          totalSizeFormatted: formatBytes(totalSize),
          filters,
          filterDescription: buildFilterDescription(filters),
          description: `Permanently delete ${messageIds.length.toLocaleString()} emails`,
          warning: 'This action cannot be undone. Emails will be permanently deleted.',
        }
      },
    }),

    trashEmails: tool({
      description: `Move emails to trash (recoverable for 30 days). Use this when user says "delete".

Pass the queryId from queryEmails result - filters will be used automatically.`,
      inputSchema: z.object({
        queryId: z.string().describe('The queryId from queryEmails result'),
      }),
      execute: async (params) => {
        logger.debug('[Tool:trashEmails] Called with queryId:', params.queryId)

        // Look up the cached query from database
        const cachedQuery = await getQueryCache(params.queryId)
        if (!cachedQuery) {
          logger.error('[Tool:trashEmails] Query not found or expired:', params.queryId)
          return { error: `Query ${params.queryId} not found or expired. Run queryEmails first.` }
        }

        const { filters, count: expectedCount } = cachedQuery
        logger.debug('[Tool:trashEmails] Using cached filters:', { filters, expectedCount })

        const { messageIds, totalSize } = await getMessageIdsByFiltersWithSize(accountId, filters)
        logger.debug('[Tool:trashEmails] Found emails:', { count: messageIds.length, totalSize })

        if (messageIds.length === 0) {
          return { trashed: 0, message: 'No emails matched the criteria' }
        }

        // Return confirmation request
        const confirmationResult = {
          confirmation_required: true,
          action: 'trash' as const,
          count: messageIds.length,
          totalSize,
          totalSizeFormatted: formatBytes(totalSize),
          filters,
          filterDescription: buildFilterDescription(filters),
          description: `Move ${messageIds.length.toLocaleString()} emails to trash`,
          warning: 'Emails can be recovered from trash for 30 days.',
        }
        logger.debug('[Tool:trashEmails] Returning confirmation_required:', {
          count: confirmationResult.count,
        })
        return confirmationResult
      },
    }),

    createFilter: tool({
      description:
        'Create a Gmail filter to automatically handle future emails. Can auto-delete, archive, label, or forward emails.',
      inputSchema: z.object({
        from: z.string().optional().describe('Match emails from this sender'),
        to: z.string().optional().describe('Match emails sent to this address'),
        subject: z.string().optional().describe('Match emails with this subject'),
        hasAttachment: z.boolean().optional(),
        action: z
          .enum(['delete', 'archive', 'markRead', 'star', 'label'])
          .describe('What to do with matching emails'),
        labelName: z.string().optional().describe('Label name (required if action is "label")'),
      }),
      execute: async (params) => {
        if (params.action === 'label' && !params.labelName) {
          return { error: 'labelName is required when action is "label"' }
        }

        // Build human-readable description of the filter
        const criteriaDesc: string[] = []
        if (params.from) criteriaDesc.push(`from: ${params.from}`)
        if (params.to) criteriaDesc.push(`to: ${params.to}`)
        if (params.subject) criteriaDesc.push(`subject contains: ${params.subject}`)
        if (params.hasAttachment) criteriaDesc.push('has attachment')

        const actionDesc = {
          delete: 'Move to Trash',
          archive: 'Skip Inbox (Archive)',
          markRead: 'Mark as read',
          star: 'Star the email',
          label: `Apply label: ${params.labelName}`,
        }[params.action]

        // Return confirmation request instead of executing
        return {
          confirmation_required: true,
          action: 'createFilter',
          filters: params,
          description: `Create Gmail filter: ${actionDesc}`,
          details: {
            criteria: criteriaDesc.join(', ') || 'No criteria specified',
            action: actionDesc,
          },
          warning: 'This filter will automatically apply to all future matching emails.',
        }
      },
    }),

    applyLabel: tool({
      description: `Apply or remove Gmail labels from emails matching a query.

Use this to organize emails by adding labels, or to archive emails by removing INBOX label.
Pass the queryId from queryEmails result.

Common uses:
- Add a custom label to categorize emails
- Archive emails (remove INBOX label)
- Mark emails as read (remove UNREAD label)
- Star emails (add STARRED label)`,
      inputSchema: z.object({
        queryId: z.string().describe('The queryId from queryEmails result'),
        addLabels: z
          .array(z.string())
          .optional()
          .describe('Label IDs to add (e.g., ["STARRED", "Label_123"])'),
        removeLabels: z
          .array(z.string())
          .optional()
          .describe('Label IDs to remove (e.g., ["INBOX", "UNREAD"])'),
      }),
      execute: async (params) => {
        logger.debug('[Tool:applyLabel] Called with:', params)

        if (!params.addLabels?.length && !params.removeLabels?.length) {
          return { error: 'Must specify at least one label to add or remove' }
        }

        // Look up the cached query from database
        const cachedQuery = await getQueryCache(params.queryId)
        if (!cachedQuery) {
          return { error: `Query ${params.queryId} not found or expired. Run queryEmails first.` }
        }

        const { filters, count } = cachedQuery

        // Build description of the action
        const actions: string[] = []
        if (params.addLabels?.length) {
          actions.push(`add labels: ${params.addLabels.join(', ')}`)
        }
        if (params.removeLabels?.length) {
          actions.push(`remove labels: ${params.removeLabels.join(', ')}`)
        }

        return {
          confirmation_required: true,
          action: 'applyLabel' as const,
          count,
          filters,
          filterDescription: buildFilterDescription(filters),
          addLabels: params.addLabels || [],
          removeLabels: params.removeLabels || [],
          description: `${actions.join(' and ')} on ${count.toLocaleString()} emails`,
          warning: 'This will modify the labels on all matching emails.',
        }
      },
    }),
  }
}

/**
 * Get tools that require user approval
 */
export function getToolsRequiringApproval(): string[] {
  return ['deleteEmails', 'trashEmails', 'createFilter', 'applyLabel']
}

/**
 * Check if a tool requires approval
 */
export function requiresApproval(toolName: string): boolean {
  return getToolsRequiringApproval().includes(toolName)
}
