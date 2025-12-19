import {
  pgTable,
  text,
  timestamp,
  integer,
  index,
  varchar,
  uniqueIndex,
  bigint,
} from 'drizzle-orm/pg-core'
import { nanoid } from '../lib/id'

/**
 * Users table - authenticated users
 */
export const users = pgTable(
  'users',
  {
    id: varchar('id', { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    email: text('email').notNull().unique(),
    name: text('name'),
    picture: text('picture'), // Google profile picture URL
    googleId: text('google_id').notNull().unique(), // Google account ID (sub claim from OAuth)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('users_google_id_idx').on(table.googleId),
    index('users_email_idx').on(table.email),
  ]
)

/**
 * Sessions table - for tracking active user sessions
 * Supports multiple sessions per user, revocation, and token rotation
 */
export const sessions = pgTable(
  'sessions',
  {
    id: varchar('id', { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: varchar('user_id', { length: 21 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(), // SHA-256 hash of refresh token
    fingerprintHash: text('fingerprint_hash').notNull(), // SHA-256 hash of fingerprint cookie
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), // Refresh token expiry (7 days, rolling)
    absoluteExpiresAt: timestamp('absolute_expires_at', { withTimezone: true }).notNull(), // Hard limit (30 days from creation)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }), // Soft revoke (null = active)
    userAgent: text('user_agent'), // Browser/device info for display
    ipAddress: text('ip_address'), // For display in session management UI
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_token_hash_idx').on(table.refreshTokenHash),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ]
)

/**
 * Sync status enum for Gmail accounts
 *
 * - idle: No sync in progress
 * - stats_only: Quick stats fetched, full sync not started
 * - syncing: Full metadata sync in progress
 * - completed: Sync completed successfully
 * - error: Sync failed (retryable)
 * - auth_expired: OAuth tokens expired/revoked, needs re-authentication
 */
export type SyncStatus = 'idle' | 'stats_only' | 'syncing' | 'completed' | 'error' | 'auth_expired'

export const gmailAccounts = pgTable(
  'gmail_accounts',
  {
    id: varchar('id', { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: varchar('user_id', { length: 21 }).notNull(),
    email: text('email').notNull(),

    // Sync status fields
    syncStatus: text('sync_status').$type<SyncStatus>().notNull().default('idle'),
    syncStartedAt: timestamp('sync_started_at', { withTimezone: true }),
    syncCompletedAt: timestamp('sync_completed_at', { withTimezone: true }),
    syncError: text('sync_error'),

    // For incremental sync
    historyId: bigint('history_id', { mode: 'number' }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('gmail_accounts_user_id_idx').on(table.userId),
    index('gmail_accounts_email_idx').on(table.email),
    index('gmail_accounts_sync_status_idx').on(table.syncStatus),
    uniqueIndex('gmail_accounts_user_email_unique').on(table.userId, table.email),
  ]
)

/**
 * OAuth tokens for Gmail accounts.
 * Tokens are encrypted before storage.
 */
export const oauthTokens = pgTable(
  'oauth_tokens',
  {
    id: varchar('id', { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    gmailAccountId: varchar('gmail_account_id', { length: 21 })
      .notNull()
      .references(() => gmailAccounts.id, { onDelete: 'cascade' }),
    accessToken: text('access_token').notNull(), // Encrypted
    refreshToken: text('refresh_token').notNull(), // Encrypted
    tokenType: text('token_type').notNull().default('Bearer'),
    scope: text('scope').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('oauth_tokens_gmail_account_idx').on(table.gmailAccountId),
    index('oauth_tokens_expires_at_idx').on(table.expiresAt),
  ]
)

/**
 * Job status enum values
 */
export type JobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

/**
 * Job types for different operations
 */
export type JobType = 'delete' | 'trash' | 'archive' | 'sync'

/**
 * Deletion/cleanup jobs.
 * Jobs are resumable if interrupted.
 */
export const jobs = pgTable(
  'jobs',
  {
    id: varchar('id', { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: varchar('user_id', { length: 21 }).notNull(),
    gmailAccountId: varchar('gmail_account_id', { length: 21 })
      .notNull()
      .references(() => gmailAccounts.id, { onDelete: 'cascade' }),
    type: text('type').$type<JobType>().notNull().default('delete'),
    status: text('status').$type<JobStatus>().notNull().default('pending'),

    // Progress tracking
    totalMessages: integer('total_messages').notNull().default(0),
    processedMessages: integer('processed_messages').notNull().default(0),

    // Pagination state for resumability
    nextPageToken: text('next_page_token'),

    // Error handling
    lastError: text('last_error'),
    retryCount: integer('retry_count').notNull().default(0),

    // Resume tracking (for accurate ETA after resume)
    resumedAt: timestamp('resumed_at', { withTimezone: true }), // When job was last resumed
    processedAtResume: integer('processed_at_resume'), // Messages already processed when resumed (null = 0)

    // Timestamps
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('jobs_user_id_idx').on(table.userId),
    index('jobs_gmail_account_idx').on(table.gmailAccountId),
    index('jobs_status_idx').on(table.status),
    index('jobs_type_idx').on(table.type),
    index('jobs_user_status_idx').on(table.userId, table.status),
    index('jobs_account_type_status_idx').on(table.gmailAccountId, table.type, table.status),
    index('jobs_created_at_idx').on(table.createdAt),
  ]
)

/**
 * Application configuration stored in database.
 * Allows runtime configuration without environment variables.
 * Sensitive values (like client secrets) are encrypted before storage.
 *
 * Known keys:
 * - google_client_id: Google OAuth client ID
 * - google_client_secret: Google OAuth client secret (encrypted)
 * - app_url: Public URL for OAuth redirects
 * - setup_completed: Whether initial setup is done ('true'/'false')
 */
export const appConfig = pgTable('app_config', {
  key: varchar('key', { length: 255 }).primaryKey(),
  value: text('value').notNull(), // Encrypted for sensitive keys
  isEncrypted: integer('is_encrypted').notNull().default(0), // 1 = encrypted, 0 = plaintext
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Unsubscribed senders - tracks senders the user has unsubscribed from
 * Used to filter out unsubscribed senders from the subscriptions list
 */
export const unsubscribedSenders = pgTable(
  'unsubscribed_senders',
  {
    id: varchar('id', { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    gmailAccountId: varchar('gmail_account_id', { length: 21 })
      .notNull()
      .references(() => gmailAccounts.id, { onDelete: 'cascade' }),
    senderEmail: text('sender_email').notNull(),
    senderName: text('sender_name'),
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('unsubscribed_senders_gmail_account_idx').on(table.gmailAccountId),
    index('unsubscribed_senders_email_idx').on(table.senderEmail),
    uniqueIndex('unsubscribed_senders_account_email_unique').on(
      table.gmailAccountId,
      table.senderEmail
    ),
  ]
)

// Type exports for use throughout the application
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

export type GmailAccount = typeof gmailAccounts.$inferSelect
export type NewGmailAccount = typeof gmailAccounts.$inferInsert

export type OAuthToken = typeof oauthTokens.$inferSelect
export type NewOAuthToken = typeof oauthTokens.$inferInsert

export type Job = typeof jobs.$inferSelect
export type NewJob = typeof jobs.$inferInsert

export type AppConfig = typeof appConfig.$inferSelect
export type NewAppConfig = typeof appConfig.$inferInsert

export type UnsubscribedSender = typeof unsubscribedSenders.$inferSelect
export type NewUnsubscribedSender = typeof unsubscribedSenders.$inferInsert

/**
 * Emails table - stores email metadata synced from Gmail
 * Multi-tenant: filtered by gmailAccountId
 */
export const emails = pgTable(
  'emails',
  {
    gmailId: text('gmail_id').notNull(),
    gmailAccountId: varchar('gmail_account_id', { length: 21 })
      .notNull()
      .references(() => gmailAccounts.id, { onDelete: 'cascade' }),
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
    internalDate: bigint('internal_date', { mode: 'number' }), // Unix timestamp in ms
    syncedAt: bigint('synced_at', { mode: 'number' }), // Unix timestamp in ms
    unsubscribeLink: text('unsubscribe_link'), // List-Unsubscribe header URL
  },
  (table) => [
    // Composite primary key: gmail_id + gmail_account_id
    uniqueIndex('emails_gmail_account_unique').on(table.gmailId, table.gmailAccountId),
    // Account-scoped indexes for efficient queries
    index('emails_account_idx').on(table.gmailAccountId),
    index('emails_account_from_idx').on(table.gmailAccountId, table.fromEmail),
    index('emails_account_category_idx').on(table.gmailAccountId, table.category),
    index('emails_account_date_idx').on(table.gmailAccountId, table.internalDate),
    index('emails_account_size_idx').on(table.gmailAccountId, table.sizeBytes),
    index('emails_account_unread_idx').on(table.gmailAccountId, table.isUnread),
    index('emails_account_starred_idx').on(table.gmailAccountId, table.isStarred),
    index('emails_account_trash_idx').on(table.gmailAccountId, table.isTrash),
    index('emails_account_spam_idx').on(table.gmailAccountId, table.isSpam),
    index('emails_account_important_idx').on(table.gmailAccountId, table.isImportant),
  ]
)

/**
 * Senders table - aggregated sender stats computed after sync completes
 * Multi-tenant: filtered by gmailAccountId
 */
export const senders = pgTable(
  'senders',
  {
    gmailAccountId: varchar('gmail_account_id', { length: 21 })
      .notNull()
      .references(() => gmailAccounts.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    name: text('name'),
    count: integer('count'),
    totalSize: bigint('total_size', { mode: 'number' }),
  },
  (table) => [
    // Composite primary key: email + gmail_account_id
    uniqueIndex('senders_account_email_unique').on(table.gmailAccountId, table.email),
    index('senders_account_idx').on(table.gmailAccountId),
    index('senders_account_count_idx').on(table.gmailAccountId, table.count),
  ]
)

// Email types
export type Email = typeof emails.$inferSelect
export type NewEmail = typeof emails.$inferInsert

export type Sender = typeof senders.$inferSelect
export type NewSender = typeof senders.$inferInsert
