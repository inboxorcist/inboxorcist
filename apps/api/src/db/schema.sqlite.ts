import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { nanoid, LOCAL_USER_ID } from "../lib/id";

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
export type SyncStatus = "idle" | "stats_only" | "syncing" | "completed" | "error" | "auth_expired";

/**
 * Gmail accounts connected by users.
 * Supports multiple Gmail accounts per user.
 */
export const gmailAccounts = sqliteTable(
  "gmail_accounts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id").notNull().default(LOCAL_USER_ID),
    email: text("email").notNull(),

    // Sync status fields
    syncStatus: text("sync_status").$type<SyncStatus>().notNull().default("idle"),
    syncStartedAt: text("sync_started_at"), // ISO timestamp
    syncCompletedAt: text("sync_completed_at"), // ISO timestamp
    syncError: text("sync_error"),

    // Total emails count (updated after sync)
    totalEmails: integer("total_emails"),

    // For incremental sync (future)
    historyId: integer("history_id"),

    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("gmail_accounts_user_id_idx").on(table.userId),
    index("gmail_accounts_email_idx").on(table.email),
    index("gmail_accounts_sync_status_idx").on(table.syncStatus),
    uniqueIndex("gmail_accounts_user_email_unique").on(table.userId, table.email),
  ]
);

/**
 * OAuth tokens for Gmail accounts.
 * Tokens are encrypted before storage.
 */
export const oauthTokens = sqliteTable(
  "oauth_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    gmailAccountId: text("gmail_account_id")
      .notNull()
      .references(() => gmailAccounts.id, { onDelete: "cascade" }),
    accessToken: text("access_token").notNull(), // Encrypted
    refreshToken: text("refresh_token").notNull(), // Encrypted
    tokenType: text("token_type").notNull().default("Bearer"),
    scope: text("scope").notNull(),
    expiresAt: text("expires_at").notNull(), // ISO timestamp
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("oauth_tokens_gmail_account_idx").on(table.gmailAccountId),
    index("oauth_tokens_expires_at_idx").on(table.expiresAt),
  ]
);

/**
 * Job status enum values
 */
export type JobStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Job types for different operations
 */
export type JobType = "delete" | "trash" | "archive" | "sync";

/**
 * Deletion/cleanup jobs.
 * Jobs are resumable if interrupted.
 */
export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id").notNull().default(LOCAL_USER_ID),
    gmailAccountId: text("gmail_account_id")
      .notNull()
      .references(() => gmailAccounts.id, { onDelete: "cascade" }),
    type: text("type").$type<JobType>().notNull().default("delete"),
    status: text("status").$type<JobStatus>().notNull().default("pending"),

    // Query parameters for the job (null for sync jobs)
    query: text("query"), // Gmail search query
    labelIds: text("label_ids", { mode: "json" }).$type<string[]>().default([]),

    // Progress tracking
    totalMessages: integer("total_messages").notNull().default(0),
    processedMessages: integer("processed_messages").notNull().default(0),
    failedMessages: integer("failed_messages").notNull().default(0),

    // Pagination state for resumability
    nextPageToken: text("next_page_token"),

    // Error handling
    lastError: text("last_error"),
    retryCount: integer("retry_count").notNull().default(0),

    // Resume tracking (for accurate ETA after resume)
    resumedAt: text("resumed_at"), // ISO timestamp when job was last resumed
    processedAtResume: integer("processed_at_resume"), // Messages already processed when resumed (null = 0)

    // Timestamps (stored as ISO strings in SQLite)
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("jobs_user_id_idx").on(table.userId),
    index("jobs_gmail_account_idx").on(table.gmailAccountId),
    index("jobs_status_idx").on(table.status),
    index("jobs_type_idx").on(table.type),
    index("jobs_user_status_idx").on(table.userId, table.status),
    index("jobs_account_type_status_idx").on(table.gmailAccountId, table.type, table.status),
    index("jobs_created_at_idx").on(table.createdAt),
  ]
);

// Type exports for use throughout the application
export type GmailAccount = typeof gmailAccounts.$inferSelect;
export type NewGmailAccount = typeof gmailAccounts.$inferInsert;

export type OAuthToken = typeof oauthTokens.$inferSelect;
export type NewOAuthToken = typeof oauthTokens.$inferInsert;

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
