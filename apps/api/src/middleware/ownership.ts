import { eq, and } from 'drizzle-orm'
import { db, tables } from '../db'
import type { GmailAccount } from '../db'

/**
 * Verify that a user owns a Gmail account.
 * Returns the account if ownership is verified, null otherwise.
 */
export async function verifyAccountOwnership(
  userId: string,
  accountId: string
): Promise<GmailAccount | null> {
  const [account] = await db
    .select()
    .from(tables.gmailAccounts)
    .where(and(eq(tables.gmailAccounts.id, accountId), eq(tables.gmailAccounts.userId, userId)))
    .limit(1)

  return account || null
}

/**
 * Get all Gmail accounts owned by a user.
 */
export async function getUserAccounts(userId: string): Promise<GmailAccount[]> {
  return db
    .select()
    .from(tables.gmailAccounts)
    .where(eq(tables.gmailAccounts.userId, userId))
    .orderBy(tables.gmailAccounts.createdAt)
}
