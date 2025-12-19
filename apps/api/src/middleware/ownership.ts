import { eq, and } from 'drizzle-orm'
import { db, tables } from '../db'
import type { MailAccount } from '../db'

/**
 * Verify that a user owns a mail account.
 * Returns the account if ownership is verified, null otherwise.
 */
export async function verifyAccountOwnership(
  userId: string,
  accountId: string
): Promise<MailAccount | null> {
  const [account] = await db
    .select()
    .from(tables.mailAccounts)
    .where(and(eq(tables.mailAccounts.id, accountId), eq(tables.mailAccounts.userId, userId)))
    .limit(1)

  return account || null
}

/**
 * Get all mail accounts owned by a user.
 */
export async function getUserAccounts(userId: string): Promise<MailAccount[]> {
  return db
    .select()
    .from(tables.mailAccounts)
    .where(eq(tables.mailAccounts.userId, userId))
    .orderBy(tables.mailAccounts.createdAt)
}
