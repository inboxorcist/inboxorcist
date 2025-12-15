/**
 * Auto-Trigger Sync Service
 *
 * Automatically triggers Step 1 (quick stats) and Step 2 (full sync)
 * after OAuth connection or on-demand.
 */

import { eq } from "drizzle-orm";
import { db, tables, dbType } from "../../db";
import { getQuickStats } from "../gmail";
import { startMetadataSync } from "./worker";

/**
 * Trigger post-OAuth sync flow
 *
 * 1. Fetch total message count
 * 2. Start full metadata sync - runs in background
 *
 * This runs in the background after OAuth callback returns.
 */
export async function triggerPostOAuthSync(accountId: string): Promise<void> {
  console.log(`[AutoTrigger] Starting post-OAuth sync for account ${accountId}`);

  try {
    // Step 1: Fetch total message count
    console.log(`[AutoTrigger] Step 1: Fetching message count...`);
    const stats = await getQuickStats(accountId);

    // Save total count to database
    const now = dbType === "postgres" ? new Date() : new Date().toISOString();
    await db
      .update(tables.gmailAccounts)
      .set({
        totalEmails: stats.total,
        syncStatus: "syncing",
        updatedAt: now as Date,
      })
      .where(eq(tables.gmailAccounts.id, accountId));

    console.log(
      `[AutoTrigger] Step 1 complete. Found ${stats.total} emails.`
    );

    // Step 2: Start full metadata sync
    console.log(`[AutoTrigger] Step 2: Starting full metadata sync...`);
    const job = await startMetadataSync(accountId, stats.total);

    console.log(
      `[AutoTrigger] Sync job ${job.id} queued for ${stats.total} emails`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[AutoTrigger] Failed for account ${accountId}:`, message);

    // Update account with error status
    const now = dbType === "postgres" ? new Date() : new Date().toISOString();
    await db
      .update(tables.gmailAccounts)
      .set({
        syncStatus: "error",
        syncError: message,
        updatedAt: now as Date,
      })
      .where(eq(tables.gmailAccounts.id, accountId));

    throw error;
  }
}

/**
 * Trigger only message count fetch without full sync
 */
export async function triggerQuickStatsOnly(accountId: string): Promise<void> {
  console.log(`[AutoTrigger] Fetching message count for account ${accountId}`);

  try {
    const stats = await getQuickStats(accountId);

    const now = dbType === "postgres" ? new Date() : new Date().toISOString();
    await db
      .update(tables.gmailAccounts)
      .set({
        totalEmails: stats.total,
        updatedAt: now as Date,
      })
      .where(eq(tables.gmailAccounts.id, accountId));

    console.log(`[AutoTrigger] Message count complete: ${stats.total} emails`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[AutoTrigger] Message count fetch failed:`, message);
    throw error;
  }
}

/**
 * Trigger full sync - fetches message count if not available
 */
export async function triggerFullSyncOnly(accountId: string): Promise<void> {
  console.log(`[AutoTrigger] Starting full sync for account ${accountId}`);

  // Get current account to know total count
  const [account] = await db
    .select()
    .from(tables.gmailAccounts)
    .where(eq(tables.gmailAccounts.id, accountId))
    .limit(1);

  if (!account) {
    throw new Error("Account not found");
  }

  let totalEmails = account.totalEmails;

  // If no count, fetch it first
  if (!totalEmails) {
    console.log(`[AutoTrigger] No message count found, fetching first...`);
    const stats = await getQuickStats(accountId);
    totalEmails = stats.total;

    const now = dbType === "postgres" ? new Date() : new Date().toISOString();
    await db
      .update(tables.gmailAccounts)
      .set({
        totalEmails: stats.total,
        updatedAt: now as Date,
      })
      .where(eq(tables.gmailAccounts.id, accountId));
  }

  const job = await startMetadataSync(accountId, totalEmails);
  console.log(`[AutoTrigger] Sync job ${job.id} started`);
}
