import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { sql, eq, and, or, gt, lt, gte, lte, like, desc, asc, count, inArray } from "drizzle-orm";
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

import * as schema from "../db/schema.emails";
import { emails, senders } from "../db/schema.emails";

/**
 * Email metadata stored in per-account SQLite database
 */
export interface EmailRecord {
  gmail_id: string;
  thread_id: string;
  subject: string | null;
  snippet: string | null;
  from_email: string;
  from_name: string | null;
  labels: string; // JSON array
  category: string | null;
  size_bytes: number;
  has_attachments: number; // 0 or 1
  is_unread: number; // 0 or 1
  is_starred: number; // 0 or 1
  is_trash: number; // 0 or 1
  is_spam: number; // 0 or 1
  is_important: number; // 0 or 1
  internal_date: number; // Unix timestamp in ms
  synced_at: number; // Unix timestamp in ms
}

/**
 * Sender aggregation stored after sync completes
 */
export interface SenderRecord {
  email: string;
  name: string | null;
  count: number;
  total_size: number;
}

// Type for the Drizzle database instance
type EmailsDatabase = BunSQLiteDatabase<typeof schema>;

// Cache of open database connections
const dbCache = new Map<string, { sqlite: Database; drizzle: EmailsDatabase }>();

/**
 * Get the path to the emails database for an account
 */
export function getEmailsDbPath(accountId: string): string {
  const dataDir = process.env.DATA_DIR || join(process.cwd(), "../../data");
  return join(dataDir, accountId, "emails.db");
}

/**
 * Open or create the emails database for an account
 * Returns both the raw SQLite database (for transactions) and the Drizzle instance
 */
export function openEmailsDb(accountId: string): Database {
  // Return cached connection if available
  const cached = dbCache.get(accountId);
  if (cached) {
    return cached.sqlite;
  }

  const dbPath = getEmailsDbPath(accountId);

  // Ensure directory exists
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  console.log(`[EmailsDB] Opening database for account ${accountId} at ${dbPath}`);

  const sqlite = new Database(dbPath);

  // Enable WAL mode for better performance
  sqlite.run("PRAGMA journal_mode = WAL;");
  sqlite.run("PRAGMA synchronous = NORMAL;");
  sqlite.run("PRAGMA foreign_keys = OFF;"); // No foreign keys in emails db

  // Create Drizzle instance
  const db = drizzle(sqlite, { schema });

  // Create tables using Drizzle's schema push
  createTables(sqlite);

  // Cache the connection
  dbCache.set(accountId, { sqlite, drizzle: db });

  return sqlite;
}

/**
 * Get the Drizzle instance for an account
 */
export function getDrizzleDb(accountId: string): EmailsDatabase {
  const cached = dbCache.get(accountId);
  if (!cached) {
    // Open the database if not already open
    openEmailsDb(accountId);
    const newCached = dbCache.get(accountId);
    if (!newCached) {
      throw new Error(`Failed to open emails database for account ${accountId}`);
    }
    return newCached.drizzle;
  }
  return cached.drizzle;
}

/**
 * Create tables using raw SQL (Drizzle doesn't have runtime schema push for SQLite)
 */
function createTables(sqlite: Database): void {
  // Emails table
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS emails (
      gmail_id TEXT PRIMARY KEY,
      thread_id TEXT,
      subject TEXT,
      snippet TEXT,
      from_email TEXT NOT NULL,
      from_name TEXT,
      labels TEXT,
      category TEXT,
      size_bytes INTEGER,
      has_attachments INTEGER DEFAULT 0,
      is_unread INTEGER DEFAULT 0,
      is_starred INTEGER DEFAULT 0,
      is_trash INTEGER DEFAULT 0,
      is_spam INTEGER DEFAULT 0,
      is_important INTEGER DEFAULT 0,
      internal_date INTEGER,
      synced_at INTEGER
    )
  `);

  // Senders table (computed after sync)
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS senders (
      email TEXT PRIMARY KEY,
      name TEXT,
      count INTEGER,
      total_size INTEGER
    )
  `);

  // Create indexes for efficient queries
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_from_email ON emails(from_email)`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_category ON emails(category)`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_internal_date ON emails(internal_date)`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_size_bytes ON emails(size_bytes)`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_is_unread ON emails(is_unread)`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_is_starred ON emails(is_starred)`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_has_attachments ON emails(has_attachments)`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_is_trash ON emails(is_trash)`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_is_spam ON emails(is_spam)`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_is_important ON emails(is_important)`);
}

/**
 * Clear all emails from the database (for full re-sync)
 */
export function clearEmails(db: Database): void {
  const accountId = getAccountIdFromDb(db);
  if (accountId) {
    const drizzleDb = getDrizzleDb(accountId);
    drizzleDb.delete(emails).run();
    drizzleDb.delete(senders).run();
  } else {
    // Fallback to raw SQL if account ID not found
    db.run("DELETE FROM emails");
    db.run("DELETE FROM senders");
  }
}

/**
 * Get account ID from a raw database instance
 */
function getAccountIdFromDb(db: Database): string | null {
  for (const [accountId, cached] of dbCache) {
    if (cached.sqlite === db) {
      return accountId;
    }
  }
  return null;
}

/**
 * Safely convert to number for SQLite INTEGER columns
 */
function toSafeInt(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? Math.floor(num) : 0;
}

/**
 * Insert a batch of emails into the database
 */
export function insertEmails(db: Database, emailRecords: EmailRecord[]): void {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    throw new Error("Database not found in cache");
  }

  const drizzleDb = getDrizzleDb(accountId);

  // Use a transaction for batch insert
  const insertMany = db.transaction(() => {
    for (const email of emailRecords) {
      drizzleDb
        .insert(emails)
        .values({
          gmailId: String(email.gmail_id || ""),
          threadId: String(email.thread_id || ""),
          subject: email.subject ?? null,
          snippet: email.snippet ?? null,
          fromEmail: String(email.from_email || "unknown@unknown.com"),
          fromName: email.from_name ?? null,
          labels: String(email.labels || "[]"),
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
        })
        .onConflictDoUpdate({
          target: emails.gmailId,
          set: {
            threadId: String(email.thread_id || ""),
            subject: email.subject ?? null,
            snippet: email.snippet ?? null,
            fromEmail: String(email.from_email || "unknown@unknown.com"),
            fromName: email.from_name ?? null,
            labels: String(email.labels || "[]"),
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
          },
        })
        .run();
    }
  });

  insertMany();
}

/**
 * Build sender aggregates from the emails table
 */
export function buildSenderAggregates(db: Database): void {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    throw new Error("Database not found in cache");
  }

  const drizzleDb = getDrizzleDb(accountId);

  // Clear existing senders
  drizzleDb.delete(senders).run();

  // Aggregate from emails using raw SQL (complex aggregation)
  db.run(`
    INSERT INTO senders (email, name, count, total_size)
    SELECT
      from_email,
      MAX(from_name),
      COUNT(*),
      SUM(size_bytes)
    FROM emails
    GROUP BY from_email
    ORDER BY COUNT(*) DESC
  `);
}

/**
 * Convert Drizzle result to SenderRecord
 */
function toSenderRecord(row: schema.Sender): SenderRecord {
  return {
    email: row.email,
    name: row.name,
    count: row.count ?? 0,
    total_size: row.totalSize ?? 0,
  };
}

/**
 * Convert Drizzle result to EmailRecord
 */
function toEmailRecord(row: schema.Email): EmailRecord {
  return {
    gmail_id: row.gmailId,
    thread_id: row.threadId ?? "",
    subject: row.subject,
    snippet: row.snippet,
    from_email: row.fromEmail,
    from_name: row.fromName,
    labels: row.labels ?? "[]",
    category: row.category,
    size_bytes: row.sizeBytes ?? 0,
    has_attachments: row.hasAttachments ?? 0,
    is_unread: row.isUnread ?? 0,
    is_starred: row.isStarred ?? 0,
    is_trash: row.isTrash ?? 0,
    is_spam: row.isSpam ?? 0,
    is_important: row.isImportant ?? 0,
    internal_date: row.internalDate ?? 0,
    synced_at: row.syncedAt ?? 0,
  };
}

/**
 * Get top senders by email count
 */
export function getTopSenders(db: Database, limit = 50): SenderRecord[] {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return [];
  }

  const drizzleDb = getDrizzleDb(accountId);
  const results = drizzleDb
    .select()
    .from(senders)
    .orderBy(desc(senders.count))
    .limit(limit)
    .all();

  return results.map(toSenderRecord);
}

/**
 * Get email count by category
 */
export function getEmailCountByCategory(db: Database): Record<string, number> {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return {};
  }

  const drizzleDb = getDrizzleDb(accountId);
  const results = drizzleDb
    .select({
      category: emails.category,
      count: count(),
    })
    .from(emails)
    .where(sql`${emails.category} IS NOT NULL`)
    .groupBy(emails.category)
    .all();

  const result: Record<string, number> = {};
  for (const row of results) {
    if (row.category) {
      result[row.category] = row.count;
    }
  }

  return result;
}

/**
 * Get total email count
 */
export function getEmailCount(db: Database): number {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return 0;
  }

  const drizzleDb = getDrizzleDb(accountId);
  const result = drizzleDb.select({ count: count() }).from(emails).get();

  return result?.count ?? 0;
}

/**
 * Get emails by sender
 */
export function getEmailsBySender(
  db: Database,
  senderEmail: string,
  limit = 100,
  offset = 0
): EmailRecord[] {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return [];
  }

  const drizzleDb = getDrizzleDb(accountId);
  const results = drizzleDb
    .select()
    .from(emails)
    .where(eq(emails.fromEmail, senderEmail))
    .orderBy(desc(emails.internalDate))
    .limit(limit)
    .offset(offset)
    .all();

  return results.map(toEmailRecord);
}

/**
 * Get emails by category
 */
export function getEmailsByCategory(
  db: Database,
  category: string,
  limit = 100,
  offset = 0
): EmailRecord[] {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return [];
  }

  const drizzleDb = getDrizzleDb(accountId);
  const results = drizzleDb
    .select()
    .from(emails)
    .where(eq(emails.category, category))
    .orderBy(desc(emails.internalDate))
    .limit(limit)
    .offset(offset)
    .all();

  return results.map(toEmailRecord);
}

/**
 * Get emails larger than a certain size
 */
export function getEmailsLargerThan(
  db: Database,
  sizeBytes: number,
  limit = 100,
  offset = 0
): EmailRecord[] {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return [];
  }

  const drizzleDb = getDrizzleDb(accountId);
  const results = drizzleDb
    .select()
    .from(emails)
    .where(gt(emails.sizeBytes, sizeBytes))
    .orderBy(desc(emails.sizeBytes))
    .limit(limit)
    .offset(offset)
    .all();

  return results.map(toEmailRecord);
}

/**
 * Get emails older than a certain date
 */
export function getEmailsOlderThan(
  db: Database,
  dateMs: number,
  limit = 100,
  offset = 0
): EmailRecord[] {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return [];
  }

  const drizzleDb = getDrizzleDb(accountId);
  const results = drizzleDb
    .select()
    .from(emails)
    .where(lt(emails.internalDate, dateMs))
    .orderBy(asc(emails.internalDate))
    .limit(limit)
    .offset(offset)
    .all();

  return results.map(toEmailRecord);
}

/**
 * Get unread emails
 */
export function getUnreadEmails(
  db: Database,
  limit = 100,
  offset = 0
): EmailRecord[] {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return [];
  }

  const drizzleDb = getDrizzleDb(accountId);
  const results = drizzleDb
    .select()
    .from(emails)
    .where(eq(emails.isUnread, 1))
    .orderBy(desc(emails.internalDate))
    .limit(limit)
    .offset(offset)
    .all();

  return results.map(toEmailRecord);
}

/**
 * Get Gmail IDs by sender (for bulk operations)
 */
export function getGmailIdsBySender(db: Database, senderEmail: string): string[] {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return [];
  }

  const drizzleDb = getDrizzleDb(accountId);
  const results = drizzleDb
    .select({ gmailId: emails.gmailId })
    .from(emails)
    .where(eq(emails.fromEmail, senderEmail))
    .all();

  return results.map((r) => r.gmailId);
}

/**
 * Get Gmail IDs by category (for bulk operations)
 */
export function getGmailIdsByCategory(db: Database, category: string): string[] {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return [];
  }

  const drizzleDb = getDrizzleDb(accountId);
  const results = drizzleDb
    .select({ gmailId: emails.gmailId })
    .from(emails)
    .where(eq(emails.category, category))
    .all();

  return results.map((r) => r.gmailId);
}

/**
 * Close the database connection for an account
 */
export function closeEmailsDb(accountId: string): void {
  const cached = dbCache.get(accountId);
  if (cached) {
    cached.sqlite.close();
    dbCache.delete(accountId);
  }
}

/**
 * Close all cached database connections
 */
export function closeAllEmailsDbs(): void {
  for (const [accountId, cached] of dbCache) {
    cached.sqlite.close();
    dbCache.delete(accountId);
  }
}

// ============================================================================
// Analysis Functions (run after sync completes)
// ============================================================================

/**
 * Analysis results computed from synced email metadata
 */
export interface AnalysisResults {
  size: {
    larger5MB: number;
    larger10MB: number;
    totalStorageBytes: number;
  };
  age: {
    olderThan1Year: number;
    olderThan2Years: number;
    olderThan3Years: number;
  };
}

/**
 * Compute analysis stats from synced email metadata
 */
export function computeAnalysis(db: Database): AnalysisResults {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return {
      size: { larger5MB: 0, larger10MB: 0, totalStorageBytes: 0 },
      age: { olderThan1Year: 0, olderThan2Years: 0, olderThan3Years: 0 },
    };
  }

  const drizzleDb = getDrizzleDb(accountId);

  const now = Date.now();
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
  const twoYearsAgo = now - 2 * 365 * 24 * 60 * 60 * 1000;
  const threeYearsAgo = now - 3 * 365 * 24 * 60 * 60 * 1000;

  const FIVE_MB = 5 * 1024 * 1024;
  const TEN_MB = 10 * 1024 * 1024;

  // Size stats
  const sizeStats = drizzleDb
    .select({
      larger5MB: sql<number>`SUM(CASE WHEN ${emails.sizeBytes} > ${FIVE_MB} THEN 1 ELSE 0 END)`,
      larger10MB: sql<number>`SUM(CASE WHEN ${emails.sizeBytes} > ${TEN_MB} THEN 1 ELSE 0 END)`,
      totalStorageBytes: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)`,
    })
    .from(emails)
    .get();

  // Age stats
  const ageStats = drizzleDb
    .select({
      olderThan1Year: sql<number>`SUM(CASE WHEN ${emails.internalDate} < ${oneYearAgo} THEN 1 ELSE 0 END)`,
      olderThan2Years: sql<number>`SUM(CASE WHEN ${emails.internalDate} < ${twoYearsAgo} THEN 1 ELSE 0 END)`,
      olderThan3Years: sql<number>`SUM(CASE WHEN ${emails.internalDate} < ${threeYearsAgo} THEN 1 ELSE 0 END)`,
    })
    .from(emails)
    .get();

  return {
    size: {
      larger5MB: sizeStats?.larger5MB ?? 0,
      larger10MB: sizeStats?.larger10MB ?? 0,
      totalStorageBytes: sizeStats?.totalStorageBytes ?? 0,
    },
    age: {
      olderThan1Year: ageStats?.olderThan1Year ?? 0,
      olderThan2Years: ageStats?.olderThan2Years ?? 0,
      olderThan3Years: ageStats?.olderThan3Years ?? 0,
    },
  };
}

/**
 * Get total storage used by all emails
 */
export function getTotalStorageBytes(db: Database): number {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return 0;
  }

  const drizzleDb = getDrizzleDb(accountId);
  const result = drizzleDb
    .select({ total: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)` })
    .from(emails)
    .get();

  return result?.total ?? 0;
}

/**
 * Get count of emails larger than a given size
 */
export function getEmailCountLargerThan(db: Database, sizeBytes: number): number {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return 0;
  }

  const drizzleDb = getDrizzleDb(accountId);
  const result = drizzleDb
    .select({ count: count() })
    .from(emails)
    .where(gt(emails.sizeBytes, sizeBytes))
    .get();

  return result?.count ?? 0;
}

/**
 * Get count of emails older than a given timestamp
 */
export function getEmailCountOlderThan(db: Database, timestampMs: number): number {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return 0;
  }

  const drizzleDb = getDrizzleDb(accountId);
  const result = drizzleDb
    .select({ count: count() })
    .from(emails)
    .where(lt(emails.internalDate, timestampMs))
    .get();

  return result?.count ?? 0;
}

/**
 * Get count of unique senders
 */
export function getUniqueSenderCount(db: Database): number {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return 0;
  }

  const drizzleDb = getDrizzleDb(accountId);
  const result = drizzleDb.select({ count: count() }).from(senders).get();

  return result?.count ?? 0;
}

// ============================================================================
// Explorer Query Functions
// ============================================================================

/**
 * Filter options for querying emails
 */
export interface ExplorerFilters {
  sender?: string; // Comma-separated email addresses
  senderDomain?: string; // Comma-separated domains (e.g., "github.com,spotify.com")
  category?: string;
  dateFrom?: number; // Unix timestamp ms
  dateTo?: number; // Unix timestamp ms
  sizeMin?: number; // bytes
  sizeMax?: number; // bytes
  isUnread?: boolean;
  isStarred?: boolean;
  hasAttachments?: boolean;
  isTrash?: boolean;
  isSpam?: boolean;
  isImportant?: boolean;
  search?: string; // Subject search
  sortBy?: "date" | "size" | "sender";
  sortOrder?: "asc" | "desc";
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Build WHERE conditions from filters
 */
function buildWhereConditions(filters: ExplorerFilters) {
  const conditions = [];

  // Handle sender emails and domains together with OR logic
  const senderConditions = [];

  if (filters.sender) {
    // Support multiple senders (comma-separated)
    const senderList = filters.sender.split(",").map((s) => s.trim()).filter(Boolean);
    if (senderList.length === 1) {
      // Single sender - use LIKE for partial match
      senderConditions.push(like(emails.fromEmail, `%${senderList[0]}%`));
    } else if (senderList.length > 1) {
      // Multiple senders - use IN for exact match
      senderConditions.push(inArray(emails.fromEmail, senderList));
    }
  }

  if (filters.senderDomain) {
    // Support multiple domains (comma-separated)
    const domainList = filters.senderDomain.split(",").map((d) => d.trim()).filter(Boolean);
    for (const domain of domainList) {
      // Filter by domain - matches @domain.com at the end of email
      senderConditions.push(like(emails.fromEmail, `%@${domain}`));
    }
  }

  // Combine sender conditions with OR (any matching email OR domain)
  if (senderConditions.length === 1) {
    conditions.push(senderConditions[0]);
  } else if (senderConditions.length > 1) {
    conditions.push(or(...senderConditions));
  }

  if (filters.category) {
    conditions.push(eq(emails.category, filters.category));
  }

  if (filters.dateFrom !== undefined) {
    conditions.push(gte(emails.internalDate, filters.dateFrom));
  }

  if (filters.dateTo !== undefined) {
    conditions.push(lte(emails.internalDate, filters.dateTo));
  }

  if (filters.sizeMin !== undefined) {
    conditions.push(gte(emails.sizeBytes, filters.sizeMin));
  }

  if (filters.sizeMax !== undefined) {
    conditions.push(lte(emails.sizeBytes, filters.sizeMax));
  }

  if (filters.isUnread !== undefined) {
    conditions.push(eq(emails.isUnread, filters.isUnread ? 1 : 0));
  }

  if (filters.isStarred !== undefined) {
    conditions.push(eq(emails.isStarred, filters.isStarred ? 1 : 0));
  }

  if (filters.hasAttachments !== undefined) {
    conditions.push(eq(emails.hasAttachments, filters.hasAttachments ? 1 : 0));
  }

  if (filters.isTrash !== undefined) {
    conditions.push(eq(emails.isTrash, filters.isTrash ? 1 : 0));
  }

  if (filters.isSpam !== undefined) {
    conditions.push(eq(emails.isSpam, filters.isSpam ? 1 : 0));
  }

  if (filters.isImportant !== undefined) {
    conditions.push(eq(emails.isImportant, filters.isImportant ? 1 : 0));
  }

  if (filters.search) {
    conditions.push(like(emails.subject, `%${filters.search}%`));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

/**
 * Get ORDER BY column and direction from filters
 */
function getOrderBy(filters: ExplorerFilters) {
  const sortBy = filters.sortBy || "date";
  const sortOrder = filters.sortOrder || "desc";

  const columnMap = {
    date: emails.internalDate,
    size: emails.sizeBytes,
    sender: emails.fromEmail,
  };

  const column = columnMap[sortBy] || emails.internalDate;
  return sortOrder === "asc" ? asc(column) : desc(column);
}

/**
 * Query emails with filters and pagination
 */
export function queryEmails(
  db: Database,
  filters: ExplorerFilters,
  pagination: PaginationOptions
): EmailRecord[] {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return [];
  }

  const drizzleDb = getDrizzleDb(accountId);
  const whereCondition = buildWhereConditions(filters);
  const orderBy = getOrderBy(filters);
  const offset = (pagination.page - 1) * pagination.limit;

  let query = drizzleDb.select().from(emails);

  if (whereCondition) {
    query = query.where(whereCondition) as typeof query;
  }

  const results = query
    .orderBy(orderBy)
    .limit(pagination.limit)
    .offset(offset)
    .all();

  return results.map(toEmailRecord);
}

/**
 * Count emails matching filters
 */
export function countFilteredEmails(db: Database, filters: ExplorerFilters): number {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return 0;
  }

  const drizzleDb = getDrizzleDb(accountId);
  const whereCondition = buildWhereConditions(filters);

  let query = drizzleDb.select({ count: count() }).from(emails);

  if (whereCondition) {
    query = query.where(whereCondition) as typeof query;
  }

  const result = query.get();
  return result?.count ?? 0;
}

/**
 * Sum total size of emails matching filters
 */
export function sumFilteredEmailsSize(db: Database, filters: ExplorerFilters): number {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return 0;
  }

  const drizzleDb = getDrizzleDb(accountId);
  const whereCondition = buildWhereConditions(filters);

  let query = drizzleDb
    .select({ totalSize: sql<number>`COALESCE(SUM(${emails.sizeBytes}), 0)` })
    .from(emails);

  if (whereCondition) {
    query = query.where(whereCondition) as typeof query;
  }

  const result = query.get();
  return result?.totalSize ?? 0;
}

/**
 * Delete emails by Gmail IDs from local database
 */
export function deleteEmailsByIds(db: Database, gmailIds: string[]): number {
  if (gmailIds.length === 0) return 0;

  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return 0;
  }

  // Use raw SQL for delete to get the changes count
  // Drizzle's .run() returns void in bun-sqlite
  const placeholders = gmailIds.map(() => "?").join(", ");
  const stmt = db.prepare(`DELETE FROM emails WHERE gmail_id IN (${placeholders})`);
  const result = stmt.run(...gmailIds);

  return result.changes;
}

/**
 * Mark emails as trashed in local database (set is_trash = 1)
 * This keeps the data consistent with Gmail instead of deleting
 */
export function markEmailsAsTrashed(db: Database, gmailIds: string[]): number {
  if (gmailIds.length === 0) return 0;

  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return 0;
  }

  // Use raw SQL for update to get the changes count
  const placeholders = gmailIds.map(() => "?").join(", ");
  const stmt = db.prepare(`UPDATE emails SET is_trash = 1 WHERE gmail_id IN (${placeholders})`);
  const result = stmt.run(...gmailIds);

  return result.changes;
}

/**
 * Get distinct senders for autocomplete
 */
export function getDistinctSenders(db: Database, search?: string, limit = 20): string[] {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return [];
  }

  const drizzleDb = getDrizzleDb(accountId);

  if (search) {
    const results = drizzleDb
      .selectDistinct({ fromEmail: emails.fromEmail })
      .from(emails)
      .where(like(emails.fromEmail, `%${search}%`))
      .orderBy(emails.fromEmail)
      .limit(limit)
      .all();

    return results.map((r) => r.fromEmail);
  } else {
    const results = drizzleDb
      .select({ email: senders.email })
      .from(senders)
      .orderBy(desc(senders.count))
      .limit(limit)
      .all();

    return results.map((r) => r.email);
  }
}

export interface SenderSuggestion {
  type: "domain" | "email";
  value: string; // domain or email address
  label: string; // display label
  count: number; // number of emails (for domain) or from this sender
}

/**
 * Get sender suggestions with domain grouping
 * When searching, returns matching domains (if multiple emails match) followed by individual emails
 */
export function getSenderSuggestions(db: Database, search?: string, limit = 20): SenderSuggestion[] {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return [];
  }

  const suggestions: SenderSuggestion[] = [];

  if (search && search.length > 0) {
    // Search mode: find matching emails and group by domain
    const domainResults = db.prepare(`
      SELECT
        SUBSTR(from_email, INSTR(from_email, '@') + 1) as domain,
        COUNT(DISTINCT from_email) as email_count,
        COUNT(*) as total_emails
      FROM emails
      WHERE from_email LIKE ?
      GROUP BY domain
      HAVING email_count > 1
      ORDER BY total_emails DESC
      LIMIT ?
    `).all(`%${search}%`, Math.floor(limit / 2)) as Array<{ domain: string; email_count: number; total_emails: number }>;

    // Add domain suggestions (only if multiple emails from same domain match)
    for (const row of domainResults) {
      suggestions.push({
        type: "domain",
        value: row.domain,
        label: `@${row.domain} (${row.email_count} addresses)`,
        count: row.total_emails,
      });
    }

    // Add individual email suggestions
    const emailResults = db.prepare(`
      SELECT from_email, COUNT(*) as count
      FROM emails
      WHERE from_email LIKE ?
      GROUP BY from_email
      ORDER BY count DESC
      LIMIT ?
    `).all(`%${search}%`, limit - suggestions.length) as Array<{ from_email: string; count: number }>;

    for (const row of emailResults) {
      suggestions.push({
        type: "email",
        value: row.from_email,
        label: row.from_email,
        count: row.count,
      });
    }
  } else {
    // No search: return top senders by count
    const results = db.prepare(`
      SELECT email, name, count
      FROM senders
      ORDER BY count DESC
      LIMIT ?
    `).all(limit) as Array<{ email: string; name: string | null; count: number }>;

    for (const row of results) {
      suggestions.push({
        type: "email",
        value: row.email,
        label: row.email,
        count: row.count,
      });
    }
  }

  return suggestions;
}

/**
 * Get distinct categories for filter dropdown
 */
export function getDistinctCategories(db: Database): string[] {
  const accountId = getAccountIdFromDb(db);
  if (!accountId) {
    return [];
  }

  const drizzleDb = getDrizzleDb(accountId);
  const results = drizzleDb
    .selectDistinct({ category: emails.category })
    .from(emails)
    .where(sql`${emails.category} IS NOT NULL`)
    .orderBy(emails.category)
    .all();

  return results.filter((r) => r.category !== null).map((r) => r.category as string);
}

// ============================================================================
// Stats Calculation (computed on-demand from emails table)
// ============================================================================

/**
 * Top sender info for display
 */
export interface TopSender {
  email: string;
  name: string | null;
  count: number;
}

/**
 * Calculated stats from the emails database
 */
export interface CalculatedStats {
  total: number;
  unread: number;
  categories: {
    promotions: number;
    social: number;
    updates: number;
    forums: number;
    primary: number;
  };
  size: {
    larger5MB: number;
    larger10MB: number;
    totalStorageBytes: number;
  };
  age: {
    olderThan1Year: number;
    olderThan2Years: number;
  };
  senders: {
    uniqueCount: number;
    topSender: TopSender | null;
  };
}

/**
 * Calculate all stats from the emails database
 * This replaces the cached stats_json approach with real-time calculation
 */
export function calculateStats(accountId: string): CalculatedStats {
  const db = openEmailsDb(accountId);
  const drizzleDb = getDrizzleDb(accountId);

  const now = Date.now();
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
  const twoYearsAgo = now - 2 * 365 * 24 * 60 * 60 * 1000;
  const FIVE_MB = 5 * 1024 * 1024;
  const TEN_MB = 10 * 1024 * 1024;

  // Get total count and unread count in one query
  const basicStats = drizzleDb
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
    .where(eq(emails.isTrash, 0)) // Exclude trashed emails from stats
    .get();

  // Get category counts
  const categoryResults = drizzleDb
    .select({
      category: emails.category,
      count: count(),
    })
    .from(emails)
    .where(and(
      sql`${emails.category} IS NOT NULL`,
      eq(emails.isTrash, 0)
    ))
    .groupBy(emails.category)
    .all();

  const categories = {
    promotions: 0,
    social: 0,
    updates: 0,
    forums: 0,
    primary: 0,
  };

  for (const row of categoryResults) {
    const cat = row.category;
    if (cat === "CATEGORY_PROMOTIONS") categories.promotions = row.count;
    else if (cat === "CATEGORY_SOCIAL") categories.social = row.count;
    else if (cat === "CATEGORY_UPDATES") categories.updates = row.count;
    else if (cat === "CATEGORY_FORUMS") categories.forums = row.count;
    else if (cat === "CATEGORY_PERSONAL") categories.primary = row.count;
  }

  // Get unique sender count
  const senderCountResult = drizzleDb.select({ count: count() }).from(senders).get();
  const uniqueSenderCount = senderCountResult?.count ?? 0;

  // Get top sender
  const topSenderResult = drizzleDb
    .select()
    .from(senders)
    .orderBy(desc(senders.count))
    .limit(1)
    .get();

  const topSender: TopSender | null = topSenderResult
    ? {
        email: topSenderResult.email,
        name: topSenderResult.name,
        count: topSenderResult.count ?? 0,
      }
    : null;

  return {
    total: basicStats?.total ?? 0,
    unread: basicStats?.unread ?? 0,
    categories,
    size: {
      larger5MB: basicStats?.larger5MB ?? 0,
      larger10MB: basicStats?.larger10MB ?? 0,
      totalStorageBytes: basicStats?.totalStorageBytes ?? 0,
    },
    age: {
      olderThan1Year: basicStats?.olderThan1Year ?? 0,
      olderThan2Years: basicStats?.olderThan2Years ?? 0,
    },
    senders: {
      uniqueCount: uniqueSenderCount,
      topSender,
    },
  };
}
