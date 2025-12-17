import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { nanoid } from '../lib/id'

/**
 * Users table - authenticated users
 */
export const users = sqliteTable(
  'users',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    email: text('email').notNull().unique(),
    name: text('name'),
    picture: text('picture'), // Google profile picture URL
    googleId: text('google_id').notNull().unique(), // Google account ID (sub claim from OAuth)
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
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
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(), // SHA-256 hash of refresh token
    fingerprintHash: text('fingerprint_hash').notNull(), // SHA-256 hash of fingerprint cookie
    expiresAt: text('expires_at').notNull(), // ISO timestamp - refresh token expiry (7 days, rolling)
    absoluteExpiresAt: text('absolute_expires_at').notNull(), // ISO timestamp - hard limit (30 days)
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    lastUsedAt: text('last_used_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    revokedAt: text('revoked_at'), // ISO timestamp - soft revoke (null = active)
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

/**
 * Gmail accounts connected by users.
 * Supports multiple Gmail accounts per user.
 */
export const gmailAccounts = sqliteTable(
  'gmail_accounts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text('user_id').notNull(),
    email: text('email').notNull(),

    // Sync status fields
    syncStatus: text('sync_status').$type<SyncStatus>().notNull().default('idle'),
    syncStartedAt: text('sync_started_at'), // ISO timestamp
    syncCompletedAt: text('sync_completed_at'), // ISO timestamp
    syncError: text('sync_error'),

    // For incremental sync
    historyId: integer('history_id'),

    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
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
export const oauthTokens = sqliteTable(
  'oauth_tokens',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    gmailAccountId: text('gmail_account_id')
      .notNull()
      .references(() => gmailAccounts.id, { onDelete: 'cascade' }),
    accessToken: text('access_token').notNull(), // Encrypted
    refreshToken: text('refresh_token').notNull(), // Encrypted
    tokenType: text('token_type').notNull().default('Bearer'),
    scope: text('scope').notNull(),
    expiresAt: text('expires_at').notNull(), // ISO timestamp
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
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
export const jobs = sqliteTable(
  'jobs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text('user_id').notNull(),
    gmailAccountId: text('gmail_account_id')
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
    resumedAt: text('resumed_at'), // ISO timestamp when job was last resumed
    processedAtResume: integer('processed_at_resume'), // Messages already processed when resumed (null = 0)

    // Timestamps (stored as ISO strings in SQLite)
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
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
export const appConfig = sqliteTable('app_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // Encrypted for sensitive keys
  isEncrypted: integer('is_encrypted').notNull().default(0), // 1 = encrypted, 0 = plaintext
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

/**
 * Unsubscribed senders - tracks senders the user has unsubscribed from
 * Used to filter out unsubscribed senders from the subscriptions list
 */
export const unsubscribedSenders = sqliteTable(
  'unsubscribed_senders',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    gmailAccountId: text('gmail_account_id')
      .notNull()
      .references(() => gmailAccounts.id, { onDelete: 'cascade' }),
    senderEmail: text('sender_email').notNull(),
    senderName: text('sender_name'),
    unsubscribedAt: text('unsubscribed_at')
      .notNull()
      .default(sql`(datetime('now'))`),
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
