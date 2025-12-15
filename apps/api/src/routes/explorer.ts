/**
 * Explorer API Routes
 *
 * Endpoints for browsing emails with filters and bulk operations
 */

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, tables } from "../db";
import type { GmailAccount } from "../db";
import {
  openEmailsDb,
  queryEmails,
  countFilteredEmails,
  sumFilteredEmailsSize,
  markEmailsAsTrashed,
  deleteEmailsByIds,
  getSenderSuggestions,
  getDistinctCategories,
  type ExplorerFilters,
} from "../lib/emails-db";
import { trashMessages, batchDeleteMessages, getGmailClient } from "../services/gmail";
import { createGmailThrottle } from "../lib/throttle";

const explorer = new Hono();

// ============================================================================
// Helper: Get account and verify ownership
// ============================================================================

async function getAccountById(accountId: string): Promise<GmailAccount | null> {
  const [account] = await db
    .select()
    .from(tables.gmailAccounts)
    .where(eq(tables.gmailAccounts.id, accountId))
    .limit(1);

  return account || null;
}

// ============================================================================
// Helper: Parse query params to filters
// ============================================================================

function parseFilters(query: Record<string, string | undefined>): ExplorerFilters {
  const filters: ExplorerFilters = {};

  if (query.sender) {
    filters.sender = query.sender;
  }

  if (query.senderDomain) {
    filters.senderDomain = query.senderDomain;
  }

  if (query.category) {
    filters.category = query.category;
  }

  if (query.dateFrom) {
    const parsed = parseInt(query.dateFrom, 10);
    if (!isNaN(parsed)) {
      filters.dateFrom = parsed;
    }
  }

  if (query.dateTo) {
    const parsed = parseInt(query.dateTo, 10);
    if (!isNaN(parsed)) {
      filters.dateTo = parsed;
    }
  }

  if (query.sizeMin) {
    const parsed = parseInt(query.sizeMin, 10);
    if (!isNaN(parsed)) {
      filters.sizeMin = parsed;
    }
  }

  if (query.sizeMax) {
    const parsed = parseInt(query.sizeMax, 10);
    if (!isNaN(parsed)) {
      filters.sizeMax = parsed;
    }
  }

  if (query.isUnread !== undefined) {
    filters.isUnread = query.isUnread === "true";
  }

  if (query.isStarred !== undefined) {
    filters.isStarred = query.isStarred === "true";
  }

  if (query.hasAttachments !== undefined) {
    filters.hasAttachments = query.hasAttachments === "true";
  }

  if (query.isTrash !== undefined) {
    filters.isTrash = query.isTrash === "true";
  }

  if (query.isSpam !== undefined) {
    filters.isSpam = query.isSpam === "true";
  }

  if (query.isImportant !== undefined) {
    filters.isImportant = query.isImportant === "true";
  }

  if (query.search) {
    filters.search = query.search;
  }

  if (query.sortBy && ["date", "size", "sender"].includes(query.sortBy)) {
    filters.sortBy = query.sortBy as "date" | "size" | "sender";
  }

  if (query.sortOrder && ["asc", "desc"].includes(query.sortOrder)) {
    filters.sortOrder = query.sortOrder as "asc" | "desc";
  }

  return filters;
}

// ============================================================================
// Email Query Endpoints
// ============================================================================

/**
 * GET /api/explorer/accounts/:id/emails
 * Query emails with filters and pagination
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Page size (default: 50, max: 100 for browse, 5000 for cleanup)
 * - mode: "browse" (default) or "cleanup" - affects max limit
 * - ... filter params
 */
explorer.get("/accounts/:id/emails", async (c) => {
  const accountId = c.req.param("id");

  try {
    const account = await getAccountById(accountId);

    if (!account) {
      return c.json({ error: "Account not found" }, 404);
    }

    if (account.syncStatus !== "completed") {
      return c.json(
        {
          error: "Sync not complete",
          syncStatus: account.syncStatus,
          message: "Full sync must complete before browsing emails",
        },
        400
      );
    }

    // Parse mode (browse or cleanup)
    const mode = c.req.query("mode") === "cleanup" ? "cleanup" : "browse";
    const maxLimit = mode === "cleanup" ? 5000 : 100;

    // Parse pagination
    const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
    const limit = Math.min(maxLimit, Math.max(1, parseInt(c.req.query("limit") || "50", 10)));

    // Parse filters
    const filters = parseFilters(c.req.query() as Record<string, string | undefined>);

    // Open emails database
    const emailsDb = openEmailsDb(accountId);

    // Query emails
    const emails = queryEmails(emailsDb, filters, { page, limit });
    const total = countFilteredEmails(emailsDb, filters);

    // Calculate total size of ALL matching emails (for storage info)
    const totalSizeBytes = sumFilteredEmailsSize(emailsDb, filters);

    return c.json({
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
      filters,
      totalSizeBytes,
    });
  } catch (error) {
    console.error("[Explorer] Error querying emails:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: `Failed to query emails: ${message}` }, 500);
  }
});

/**
 * GET /api/explorer/accounts/:id/emails/count
 * Get count of emails matching filters
 */
explorer.get("/accounts/:id/emails/count", async (c) => {
  const accountId = c.req.param("id");

  try {
    const account = await getAccountById(accountId);

    if (!account) {
      return c.json({ error: "Account not found" }, 404);
    }

    if (account.syncStatus !== "completed") {
      return c.json(
        {
          error: "Sync not complete",
          syncStatus: account.syncStatus,
        },
        400
      );
    }

    // Parse filters
    const filters = parseFilters(c.req.query() as Record<string, string | undefined>);

    // Open emails database and count
    const emailsDb = openEmailsDb(accountId);
    const count = countFilteredEmails(emailsDb, filters);

    return c.json({ count, filters });
  } catch (error) {
    console.error("[Explorer] Error counting emails:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: `Failed to count emails: ${message}` }, 500);
  }
});

// ============================================================================
// Trash Endpoint
// ============================================================================

/**
 * POST /api/explorer/accounts/:id/emails/trash
 * Move selected emails to trash
 */
explorer.post("/accounts/:id/emails/trash", async (c) => {
  const accountId = c.req.param("id");

  try {
    const account = await getAccountById(accountId);

    if (!account) {
      return c.json({ error: "Account not found" }, 404);
    }

    if (account.syncStatus !== "completed") {
      return c.json(
        {
          error: "Sync not complete",
          syncStatus: account.syncStatus,
        },
        400
      );
    }

    const body = await c.req.json<{ emailIds: string[] }>();
    const emailIds = body.emailIds;

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return c.json({ error: "No email IDs provided" }, 400);
    }

    // Limit batch size - batchModify supports 1000 per call, we allow up to 5000 (5 batches)
    const MAX_BATCH = 5000;
    if (emailIds.length > MAX_BATCH) {
      return c.json(
        {
          error: `Too many emails. Maximum ${MAX_BATCH} at once.`,
          maxBatch: MAX_BATCH,
          requested: emailIds.length,
        },
        400
      );
    }

    console.log(`[Explorer] Trashing ${emailIds.length} emails for account ${accountId}`);

    // Trash emails in Gmail
    const throttle = createGmailThrottle();
    const { succeeded, failed } = await trashMessages(accountId, emailIds, throttle);

    // Mark trashed emails in local database (set is_trash = 1)
    if (succeeded > 0) {
      const emailsDb = openEmailsDb(accountId);
      // Mark emails as trashed to keep data consistent with Gmail
      markEmailsAsTrashed(emailsDb, emailIds);
    }

    console.log(`[Explorer] Trashed ${succeeded} emails, ${failed} failed`);

    return c.json({
      success: true,
      trashedCount: succeeded,
      failedCount: failed,
      message:
        failed > 0
          ? `Trashed ${succeeded} emails, ${failed} failed`
          : `Successfully trashed ${succeeded} emails`,
    });
  } catch (error) {
    console.error("[Explorer] Error trashing emails:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: `Failed to trash emails: ${message}` }, 500);
  }
});

/**
 * POST /api/explorer/accounts/:id/emails/delete
 * Permanently delete selected emails (cannot be recovered)
 */
explorer.post("/accounts/:id/emails/delete", async (c) => {
  const accountId = c.req.param("id");

  try {
    const account = await getAccountById(accountId);

    if (!account) {
      return c.json({ error: "Account not found" }, 404);
    }

    if (account.syncStatus !== "completed") {
      return c.json(
        {
          error: "Sync not complete",
          syncStatus: account.syncStatus,
        },
        400
      );
    }

    const body = await c.req.json<{ emailIds: string[] }>();
    const emailIds = body.emailIds;

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return c.json({ error: "No email IDs provided" }, 400);
    }

    // Gmail batchDelete supports max 1000 messages
    const MAX_BATCH = 1000;
    if (emailIds.length > MAX_BATCH) {
      return c.json(
        {
          error: `Too many emails. Maximum ${MAX_BATCH} at once.`,
          maxBatch: MAX_BATCH,
          requested: emailIds.length,
        },
        400
      );
    }

    console.log(`[Explorer] Permanently deleting ${emailIds.length} emails for account ${accountId}`);

    // Permanently delete emails in Gmail
    await batchDeleteMessages(accountId, emailIds);

    // Remove deleted emails from local database
    const emailsDb = openEmailsDb(accountId);
    const deletedCount = deleteEmailsByIds(emailsDb, emailIds);

    console.log(`[Explorer] Permanently deleted ${deletedCount} emails`);

    return c.json({
      success: true,
      deletedCount,
      message: `Permanently deleted ${deletedCount} emails`,
    });
  } catch (error) {
    console.error("[Explorer] Error permanently deleting emails:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: `Failed to delete emails: ${message}` }, 500);
  }
});

// ============================================================================
// Filter Options Endpoints
// ============================================================================

/**
 * GET /api/explorer/accounts/:id/senders
 * Get sender suggestions with domain grouping for autocomplete
 */
explorer.get("/accounts/:id/senders", async (c) => {
  const accountId = c.req.param("id");

  try {
    const account = await getAccountById(accountId);

    if (!account) {
      return c.json({ error: "Account not found" }, 404);
    }

    if (account.syncStatus !== "completed") {
      return c.json(
        {
          error: "Sync not complete",
          syncStatus: account.syncStatus,
        },
        400
      );
    }

    const search = c.req.query("search");
    const limit = Math.min(50, parseInt(c.req.query("limit") || "20", 10));

    const emailsDb = openEmailsDb(accountId);
    const suggestions = getSenderSuggestions(emailsDb, search, limit);

    return c.json({ suggestions });
  } catch (error) {
    console.error("[Explorer] Error fetching senders:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: `Failed to fetch senders: ${message}` }, 500);
  }
});

/**
 * GET /api/explorer/accounts/:id/categories
 * Get distinct categories for filter dropdown
 */
explorer.get("/accounts/:id/categories", async (c) => {
  const accountId = c.req.param("id");

  try {
    const account = await getAccountById(accountId);

    if (!account) {
      return c.json({ error: "Account not found" }, 404);
    }

    if (account.syncStatus !== "completed") {
      return c.json(
        {
          error: "Sync not complete",
          syncStatus: account.syncStatus,
        },
        400
      );
    }

    const emailsDb = openEmailsDb(accountId);
    const categories = getDistinctCategories(emailsDb);

    return c.json({ categories });
  } catch (error) {
    console.error("[Explorer] Error fetching categories:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: `Failed to fetch categories: ${message}` }, 500);
  }
});

export default explorer;
