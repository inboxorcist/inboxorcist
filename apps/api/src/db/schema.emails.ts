import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

/**
 * Schema for per-account emails SQLite database.
 * Each Gmail account gets its own SQLite file at data/{accountId}/emails.db
 */

/**
 * Emails table - stores email metadata synced from Gmail
 */
export const emails = sqliteTable(
  'emails',
  {
    gmailId: text('gmail_id').primaryKey(),
    threadId: text('thread_id'),
    subject: text('subject'),
    snippet: text('snippet'),
    fromEmail: text('from_email').notNull(),
    fromName: text('from_name'),
    labels: text('labels'), // JSON array
    category: text('category'),
    sizeBytes: integer('size_bytes'),
    hasAttachments: integer('has_attachments').default(0), // 0 or 1
    isUnread: integer('is_unread').default(0), // 0 or 1
    isStarred: integer('is_starred').default(0), // 0 or 1
    isTrash: integer('is_trash').default(0), // 0 or 1
    isSpam: integer('is_spam').default(0), // 0 or 1
    isImportant: integer('is_important').default(0), // 0 or 1
    internalDate: integer('internal_date'), // Unix timestamp in ms
    syncedAt: integer('synced_at'), // Unix timestamp in ms
  },
  (table) => [
    index('idx_from_email').on(table.fromEmail),
    index('idx_category').on(table.category),
    index('idx_internal_date').on(table.internalDate),
    index('idx_size_bytes').on(table.sizeBytes),
    index('idx_is_unread').on(table.isUnread),
    index('idx_is_starred').on(table.isStarred),
    index('idx_has_attachments').on(table.hasAttachments),
    index('idx_is_trash').on(table.isTrash),
    index('idx_is_spam').on(table.isSpam),
    index('idx_is_important').on(table.isImportant),
  ]
)

/**
 * Senders table - aggregated sender stats computed after sync completes
 */
export const senders = sqliteTable('senders', {
  email: text('email').primaryKey(),
  name: text('name'),
  count: integer('count'),
  totalSize: integer('total_size'),
})

// Type exports
export type Email = typeof emails.$inferSelect
export type NewEmail = typeof emails.$inferInsert

export type Sender = typeof senders.$inferSelect
export type NewSender = typeof senders.$inferInsert
