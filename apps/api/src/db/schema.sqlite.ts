import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { nanoid } from '../lib/id'
import type { AIProvider } from '../services/ai/types'

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
 * Mail provider enum
 */
export type MailProvider = 'gmail' | 'outlook'

/**
 * Sync status enum for mail accounts
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
 * Mail accounts connected by users.
 * Supports multiple mail accounts per user across different providers.
 */
export const mailAccounts = sqliteTable(
  'mail_accounts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text('user_id').notNull(),
    provider: text('provider').$type<MailProvider>().notNull().default('gmail'),
    email: text('email').notNull(),

    // Sync status fields
    syncStatus: text('sync_status').$type<SyncStatus>().notNull().default('idle'),
    syncStartedAt: text('sync_started_at'), // ISO timestamp
    syncCompletedAt: text('sync_completed_at'), // ISO timestamp
    syncError: text('sync_error'),

    // For incremental sync (Gmail: historyId, Outlook: deltaLink stored elsewhere)
    historyId: integer('history_id'),

    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('mail_accounts_user_id_idx').on(table.userId),
    index('mail_accounts_provider_idx').on(table.provider),
    index('mail_accounts_email_idx').on(table.email),
    index('mail_accounts_sync_status_idx').on(table.syncStatus),
    uniqueIndex('mail_accounts_user_provider_email_unique').on(
      table.userId,
      table.provider,
      table.email
    ),
  ]
)

/**
 * OAuth tokens for mail accounts.
 * Tokens are encrypted before storage.
 */
export const oauthTokens = sqliteTable(
  'oauth_tokens',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    mailAccountId: text('mail_account_id')
      .notNull()
      .references(() => mailAccounts.id, { onDelete: 'cascade' }),
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
    index('oauth_tokens_mail_account_idx').on(table.mailAccountId),
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
    mailAccountId: text('mail_account_id')
      .notNull()
      .references(() => mailAccounts.id, { onDelete: 'cascade' }),
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
    index('jobs_mail_account_idx').on(table.mailAccountId),
    index('jobs_status_idx').on(table.status),
    index('jobs_type_idx').on(table.type),
    index('jobs_user_status_idx').on(table.userId, table.status),
    index('jobs_account_type_status_idx').on(table.mailAccountId, table.type, table.status),
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
    mailAccountId: text('mail_account_id')
      .notNull()
      .references(() => mailAccounts.id, { onDelete: 'cascade' }),
    senderEmail: text('sender_email').notNull(),
    senderName: text('sender_name'),
    unsubscribedAt: text('unsubscribed_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('unsubscribed_senders_mail_account_idx').on(table.mailAccountId),
    index('unsubscribed_senders_email_idx').on(table.senderEmail),
    uniqueIndex('unsubscribed_senders_account_email_unique').on(
      table.mailAccountId,
      table.senderEmail
    ),
  ]
)

// Type exports for use throughout the application
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

export type MailAccount = typeof mailAccounts.$inferSelect
export type NewMailAccount = typeof mailAccounts.$inferInsert

export type OAuthToken = typeof oauthTokens.$inferSelect
export type NewOAuthToken = typeof oauthTokens.$inferInsert

export type Job = typeof jobs.$inferSelect
export type NewJob = typeof jobs.$inferInsert

export type AppConfig = typeof appConfig.$inferSelect
export type NewAppConfig = typeof appConfig.$inferInsert

export type UnsubscribedSender = typeof unsubscribedSenders.$inferSelect
export type NewUnsubscribedSender = typeof unsubscribedSenders.$inferInsert

/**
 * Emails table - stores email metadata synced from mail providers
 * Multi-tenant: filtered by mailAccountId
 */
export const emails = sqliteTable(
  'emails',
  {
    messageId: text('message_id').notNull(), // Provider's message ID (Gmail ID, Outlook ID, etc.)
    mailAccountId: text('mail_account_id')
      .notNull()
      .references(() => mailAccounts.id, { onDelete: 'cascade' }),
    threadId: text('thread_id'),
    subject: text('subject'),
    snippet: text('snippet'),
    fromEmail: text('from_email').notNull(),
    fromName: text('from_name'),
    labels: text('labels'), // JSON array (Gmail labels / Outlook categories)
    category: text('category'),
    sizeBytes: integer('size_bytes'),
    hasAttachments: integer('has_attachments').default(0), // count of attachments
    attachments: text('attachments'), // JSON array of {filename, mimeType, size}
    isUnread: integer('is_unread').default(0), // 0 or 1
    isStarred: integer('is_starred').default(0), // 0 or 1
    isTrash: integer('is_trash').default(0), // 0 or 1
    isSpam: integer('is_spam').default(0), // 0 or 1
    isImportant: integer('is_important').default(0), // 0 or 1
    internalDate: integer('internal_date'), // Unix timestamp in ms
    syncedAt: integer('synced_at'), // Unix timestamp in ms
    unsubscribeLink: text('unsubscribe_link'), // List-Unsubscribe header URL
  },
  (table) => [
    // Composite primary key: message_id + mail_account_id
    uniqueIndex('emails_message_account_unique').on(table.messageId, table.mailAccountId),
    // Account-scoped indexes for efficient queries
    index('emails_account_idx').on(table.mailAccountId),
    index('emails_account_from_idx').on(table.mailAccountId, table.fromEmail),
    index('emails_account_category_idx').on(table.mailAccountId, table.category),
    index('emails_account_date_idx').on(table.mailAccountId, table.internalDate),
    index('emails_account_size_idx').on(table.mailAccountId, table.sizeBytes),
    index('emails_account_unread_idx').on(table.mailAccountId, table.isUnread),
    index('emails_account_starred_idx').on(table.mailAccountId, table.isStarred),
    index('emails_account_trash_idx').on(table.mailAccountId, table.isTrash),
    index('emails_account_spam_idx').on(table.mailAccountId, table.isSpam),
    index('emails_account_important_idx').on(table.mailAccountId, table.isImportant),
  ]
)

/**
 * Senders table - aggregated sender stats computed after sync completes
 * Multi-tenant: filtered by mailAccountId
 */
export const senders = sqliteTable(
  'senders',
  {
    mailAccountId: text('mail_account_id')
      .notNull()
      .references(() => mailAccounts.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    name: text('name'),
    count: integer('count'),
    totalSize: integer('total_size'),
  },
  (table) => [
    // Composite primary key: email + mail_account_id
    uniqueIndex('senders_account_email_unique').on(table.mailAccountId, table.email),
    index('senders_account_idx').on(table.mailAccountId),
    index('senders_account_count_idx').on(table.mailAccountId, table.count),
  ]
)

// Email types
export type Email = typeof emails.$inferSelect
export type NewEmail = typeof emails.$inferInsert

export type Sender = typeof senders.$inferSelect
export type NewSender = typeof senders.$inferInsert

/**
 * Mail rules (filters) - provider-agnostic rules for automatic email actions
 * Stores both Gmail filters and Outlook message rules
 */
export const mailRules = sqliteTable(
  'mail_rules',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    mailAccountId: text('mail_account_id')
      .notNull()
      .references(() => mailAccounts.id, { onDelete: 'cascade' }),
    providerRuleId: text('provider_rule_id'), // Remote ID from Gmail/Outlook (null if not synced yet)
    name: text('name').notNull(), // User-friendly name (not stored in provider)
    isEnabled: integer('is_enabled').notNull().default(1), // 1 = enabled, 0 = disabled
    sequence: integer('sequence'), // Outlook uses this for ordering, Gmail ignores

    // Provider-specific criteria and actions stored as JSON
    // Gmail: { from, to, subject, query, hasAttachment, size, sizeComparison }
    // Outlook: { fromAddresses, senderContains, subjectContains, bodyContains, hasAttachments, importance }
    criteria: text('criteria').notNull(), // JSON string

    // Provider-specific actions stored as JSON
    // Gmail: { addLabelIds, removeLabelIds, forward }
    // Outlook: { moveToFolder, copyToFolder, delete, permanentDelete, markAsRead, forwardTo, assignCategories }
    actions: text('actions').notNull(), // JSON string

    // Normalized fields for quick querying (extracted from criteria)
    matchSender: text('match_sender'), // Primary sender filter if any
    matchSubject: text('match_subject'), // Primary subject filter if any

    syncedAt: text('synced_at'), // ISO timestamp - last synced with provider
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('mail_rules_account_idx').on(table.mailAccountId),
    index('mail_rules_provider_rule_idx').on(table.providerRuleId),
    index('mail_rules_enabled_idx').on(table.mailAccountId, table.isEnabled),
    index('mail_rules_sender_idx').on(table.mailAccountId, table.matchSender),
  ]
)

export type MailRule = typeof mailRules.$inferSelect
export type NewMailRule = typeof mailRules.$inferInsert

/**
 * Deleted emails table - "Eternal Memory" archive
 * Stores metadata of permanently deleted emails forever
 * Mirrors emails table (minus synced_at and is_trash) plus deleted_at
 */
export const deletedEmails = sqliteTable(
  'deleted_emails',
  {
    messageId: text('message_id').notNull(),
    mailAccountId: text('mail_account_id')
      .notNull()
      .references(() => mailAccounts.id, { onDelete: 'cascade' }),
    threadId: text('thread_id'),
    subject: text('subject'),
    snippet: text('snippet'),
    fromEmail: text('from_email').notNull(),
    fromName: text('from_name'),
    labels: text('labels'),
    category: text('category'),
    sizeBytes: integer('size_bytes'),
    hasAttachments: integer('has_attachments').default(0),
    attachments: text('attachments'), // JSON array of {filename, mimeType, size}
    isUnread: integer('is_unread').default(0),
    isStarred: integer('is_starred').default(0),
    isSpam: integer('is_spam').default(0),
    isImportant: integer('is_important').default(0),
    internalDate: integer('internal_date'),
    unsubscribeLink: text('unsubscribe_link'),
    deletedAt: text('deleted_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex('deleted_emails_message_account_unique').on(table.messageId, table.mailAccountId),
    index('deleted_emails_account_idx').on(table.mailAccountId),
    index('deleted_emails_account_from_idx').on(table.mailAccountId, table.fromEmail),
    index('deleted_emails_account_date_idx').on(table.mailAccountId, table.internalDate),
    index('deleted_emails_deleted_at_idx').on(table.mailAccountId, table.deletedAt),
  ]
)

export type DeletedEmail = typeof deletedEmails.$inferSelect
export type NewDeletedEmail = typeof deletedEmails.$inferInsert

/**
 * Chat message role enum
 */
export type ChatMessageRole = 'user' | 'assistant' | 'tool'

// AIProvider type is imported from '../services/ai/types'
export type { AIProvider }

/**
 * AI Chat conversations table - stores AI chat conversations per mail account
 * Conversations are scoped to a specific mail account
 */
export const aiChatConversations = sqliteTable(
  'ai_chat_conversations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mailAccountId: text('mail_account_id')
      .notNull()
      .references(() => mailAccounts.id, { onDelete: 'cascade' }),
    title: text('title'), // Auto-generated from first message, nullable
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('ai_chat_conversations_user_id_idx').on(table.userId),
    index('ai_chat_conversations_mail_account_idx').on(table.mailAccountId),
    index('ai_chat_conversations_created_at_idx').on(table.createdAt),
  ]
)

/**
 * AI Chat messages table - stores individual messages within a conversation
 * Includes tool calls, results, and approval state for AI SDK v6
 */
export const aiChatMessages = sqliteTable(
  'ai_chat_messages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => aiChatConversations.id, { onDelete: 'cascade' }),
    role: text('role').$type<ChatMessageRole>().notNull(),
    content: text('content').notNull(),
    provider: text('provider').$type<AIProvider>(), // Provider used for this message (nullable for user messages)
    model: text('model'), // Model ID used for this message (nullable for user messages)
    toolCalls: text('tool_calls'), // JSON: Array of tool invocations by assistant
    toolResults: text('tool_results'), // JSON: Array of tool execution results
    approvalState: text('approval_state'), // JSON: AI SDK v6 tool approval state
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('ai_chat_messages_conversation_idx').on(table.conversationId),
    index('ai_chat_messages_created_at_idx').on(table.createdAt),
  ]
)

export type AIChatConversation = typeof aiChatConversations.$inferSelect
export type NewAIChatConversation = typeof aiChatConversations.$inferInsert

export type AIChatMessage = typeof aiChatMessages.$inferSelect
export type NewAIChatMessage = typeof aiChatMessages.$inferInsert

/**
 * AI Query Cache table - stores query results for trash/delete tools
 * Persists queryId -> filters mapping so it survives server restarts
 * Entries expire after 24 hours and should be cleaned up periodically
 */
export const aiQueryCache = sqliteTable(
  'ai_query_cache',
  {
    queryId: text('query_id').primaryKey(),
    mailAccountId: text('mail_account_id')
      .notNull()
      .references(() => mailAccounts.id, { onDelete: 'cascade' }),
    filters: text('filters').notNull(), // JSON: ExplorerFilters
    count: integer('count').notNull(),
    totalSize: integer('total_size').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index('ai_query_cache_account_idx').on(table.mailAccountId)]
)

export type AIQueryCache = typeof aiQueryCache.$inferSelect
export type NewAIQueryCache = typeof aiQueryCache.$inferInsert
