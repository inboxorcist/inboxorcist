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
 * 1. Fetch quick stats (Step 1) - ~5-15 seconds
 * 2. Start full metadata sync (Step 2) - runs in background
 *
 * This runs in the background after OAuth callback returns.
 */
export async function triggerPostOAuthSync(accountId: string): Promise<void> {
  console.log(`[AutoTrigger] Starting post-OAuth sync for account ${accountId}`);

  try {
    // Step 1: Fetch quick stats
    console.log(`[AutoTrigger] Step 1: Fetching quick stats...`);
    const stats = await getQuickStats(accountId);

    // Save stats to database
    const now = dbType === "postgres" ? new Date() : new Date().toISOString();
    await db
      .update(tables.gmailAccounts)
      .set({
        statsJson: stats,
        statsFetchedAt: now as Date,
        totalEmails: stats.total,
        syncStatus: "stats_only",
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
 * Trigger only Step 1 (quick stats) without full sync
 */
export async function triggerQuickStatsOnly(accountId: string): Promise<void> {
  console.log(`[AutoTrigger] Fetching quick stats for account ${accountId}`);

  try {
    const stats = await getQuickStats(accountId);

    const now = dbType === "postgres" ? new Date() : new Date().toISOString();
    await db
      .update(tables.gmailAccounts)
      .set({
        statsJson: stats,
        statsFetchedAt: now as Date,
        totalEmails: stats.total,
        syncStatus: "stats_only",
        updatedAt: now as Date,
      })
      .where(eq(tables.gmailAccounts.id, accountId));

    console.log(`[AutoTrigger] Quick stats complete: ${stats.total} emails`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[AutoTrigger] Quick stats failed:`, message);
    throw error;
  }
}

/**
 * Trigger only Step 2 (full sync) - requires stats to exist
 */
export async function triggerFullSyncOnly(accountId: string): Promise<void> {
  console.log(`[AutoTrigger] Starting full sync for account ${accountId}`);

  // Get current stats to know total count
  const [account] = await db
    .select()
    .from(tables.gmailAccounts)
    .where(eq(tables.gmailAccounts.id, accountId))
    .limit(1);

  if (!account) {
    throw new Error("Account not found");
  }

  let totalEmails = account.totalEmails;

  // If no stats, fetch them first
  if (!totalEmails) {
    console.log(`[AutoTrigger] No stats found, fetching first...`);
    const stats = await getQuickStats(accountId);
    totalEmails = stats.total;

    const now = dbType === "postgres" ? new Date() : new Date().toISOString();
    await db
      .update(tables.gmailAccounts)
      .set({
        statsJson: stats,
        statsFetchedAt: now as Date,
        totalEmails: stats.total,
        updatedAt: now as Date,
      })
      .where(eq(tables.gmailAccounts.id, accountId));
  }

  const job = await startMetadataSync(accountId, totalEmails);
  console.log(`[AutoTrigger] Sync job ${job.id} started`);
}
