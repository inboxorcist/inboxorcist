import { google } from "googleapis";
import { eq, and } from "drizzle-orm";
import { db, tables, dbType } from "../db";
import { encrypt, decrypt } from "../lib/encryption";
import { getCurrentUserId } from "../lib/id";
import type { GmailAccount, OAuthToken } from "../db";

// Gmail API scopes required for email management
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

/**
 * Get OAuth2 client configured with credentials
 */
export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing Google OAuth credentials. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI"
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generate the OAuth authorization URL
 */
export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Force consent to get refresh token
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Get user email from access token
 */
export async function getUserEmail(accessToken: string): Promise<string> {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();

  if (!data.email) {
    throw new Error("Could not retrieve user email from Google");
  }

  return data.email;
}

/**
 * Store or update Gmail account and OAuth tokens
 * Returns the account and whether it's newly created
 */
export async function saveGmailAccount(
  email: string,
  tokens: {
    access_token: string;
    refresh_token: string;
    expiry_date: number;
    scope: string;
    token_type: string;
  }
): Promise<{ account: GmailAccount; isNew: boolean }> {
  const userId = getCurrentUserId();

  // Check if account already exists for this user
  const existingAccount = await db
    .select()
    .from(tables.gmailAccounts)
    .where(
      and(
        eq(tables.gmailAccounts.userId, userId),
        eq(tables.gmailAccounts.email, email)
      )
    )
    .limit(1);

  let gmailAccount: GmailAccount;
  let isNew = false;

  const existingAcc = existingAccount[0];
  if (existingAcc) {
    gmailAccount = existingAcc;
    // Update timestamp and set to syncing (will re-sync on reconnect)
    const now = (dbType === "postgres" ? new Date() : new Date().toISOString()) as Date;
    await db
      .update(tables.gmailAccounts)
      .set({
        syncStatus: "syncing",
        updatedAt: now,
      })
      .where(eq(tables.gmailAccounts.id, gmailAccount.id));
  } else {
    // Create new account with syncStatus: "syncing" immediately
    const [newAccount] = await db
      .insert(tables.gmailAccounts)
      .values({
        userId,
        email,
        syncStatus: "syncing",
      })
      .returning();
    if (!newAccount) {
      throw new Error("Failed to create Gmail account");
    }
    gmailAccount = newAccount;
    isNew = true;
  }

  // Encrypt tokens before storage
  const encryptedAccessToken = encrypt(tokens.access_token);
  const encryptedRefreshToken = encrypt(tokens.refresh_token);

  // Check if token record exists for this account
  const existingToken = await db
    .select()
    .from(tables.oauthTokens)
    .where(eq(tables.oauthTokens.gmailAccountId, gmailAccount.id))
    .limit(1);

  const expiresAt =
    dbType === "postgres"
      ? new Date(tokens.expiry_date)
      : new Date(tokens.expiry_date).toISOString();

  const now = dbType === "postgres" ? new Date() : new Date().toISOString();

  if (existingToken.length > 0) {
    // Update existing token
    await db
      .update(tables.oauthTokens)
      .set({
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenType: tokens.token_type || "Bearer",
        scope: tokens.scope,
        expiresAt: expiresAt as Date,
        updatedAt: now as Date,
      })
      .where(eq(tables.oauthTokens.gmailAccountId, gmailAccount.id));
  } else {
    // Create new token record
    await db.insert(tables.oauthTokens).values({
      gmailAccountId: gmailAccount.id,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenType: tokens.token_type || "Bearer",
      scope: tokens.scope,
      expiresAt: expiresAt as Date,
    });
  }

  return { account: gmailAccount, isNew };
}

/**
 * Get all connected Gmail accounts for the current user
 */
export async function getConnectedAccounts(): Promise<GmailAccount[]> {
  const userId = getCurrentUserId();
  return db
    .select()
    .from(tables.gmailAccounts)
    .where(eq(tables.gmailAccounts.userId, userId))
    .orderBy(tables.gmailAccounts.createdAt);
}

/**
 * Get OAuth tokens for a Gmail account
 */
export async function getAccountTokens(
  accountId: string
): Promise<OAuthToken | null> {
  const [token] = await db
    .select()
    .from(tables.oauthTokens)
    .where(eq(tables.oauthTokens.gmailAccountId, accountId))
    .limit(1);

  return token || null;
}

/**
 * Custom error for expired/revoked authentication
 */
export class AuthExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthExpiredError";
  }
}

/**
 * Mark an account as having expired authentication
 */
async function markAccountAuthExpired(accountId: string, errorMessage: string): Promise<void> {
  const now = dbType === "postgres" ? new Date() : new Date().toISOString();

  await db
    .update(tables.gmailAccounts)
    .set({
      syncStatus: "auth_expired",
      syncError: errorMessage,
      updatedAt: now as Date,
    })
    .where(eq(tables.gmailAccounts.id, accountId));

  console.log(`[OAuth] Marked account ${accountId} as auth_expired: ${errorMessage}`);
}

/**
 * Check if an error indicates the refresh token is expired/revoked
 */
function isRefreshTokenExpiredError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Google returns these errors when refresh token is invalid
    return (
      message.includes("invalid_grant") ||
      message.includes("token has been expired or revoked") ||
      message.includes("token has been revoked") ||
      message.includes("refresh token is invalid") ||
      message.includes("authorization code has expired")
    );
  }
  return false;
}

/**
 * Get a valid access token for a Gmail account.
 * Refreshes the token if expired.
 * Throws AuthExpiredError if refresh token is invalid (needs re-auth).
 */
export async function getValidAccessToken(accountId: string): Promise<string> {
  const token = await getAccountTokens(accountId);

  if (!token) {
    throw new Error("No OAuth token found for this account");
  }

  const expiresAt =
    typeof token.expiresAt === "string"
      ? new Date(token.expiresAt)
      : token.expiresAt;

  // Check if token is expired (with 5 minute buffer)
  const isExpired = expiresAt.getTime() - 5 * 60 * 1000 < Date.now();

  if (!isExpired) {
    return decrypt(token.accessToken);
  }

  // Refresh the token
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: decrypt(token.refreshToken),
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token || !credentials.expiry_date) {
      throw new Error("Failed to refresh access token");
    }

    // Update stored tokens
    const encryptedAccessToken = encrypt(credentials.access_token);
    const newExpiresAt =
      dbType === "postgres"
        ? new Date(credentials.expiry_date)
        : new Date(credentials.expiry_date).toISOString();
    const now = dbType === "postgres" ? new Date() : new Date().toISOString();

    await db
      .update(tables.oauthTokens)
      .set({
        accessToken: encryptedAccessToken,
        expiresAt: newExpiresAt as Date,
        updatedAt: now as Date,
      })
      .where(eq(tables.oauthTokens.gmailAccountId, accountId));

    console.log(`[OAuth] Successfully refreshed access token for account ${accountId}`);
    return credentials.access_token;
  } catch (error) {
    // Check if this is a refresh token expiry/revocation error
    if (isRefreshTokenExpiredError(error)) {
      const errorMessage = "Authentication expired. Please reconnect your Gmail account.";
      await markAccountAuthExpired(accountId, errorMessage);
      throw new AuthExpiredError(errorMessage);
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Delete a Gmail account and its tokens (cascade)
 * Only allows deleting accounts owned by the current user
 */
export async function deleteGmailAccount(accountId: string): Promise<void> {
  const userId = getCurrentUserId();
  await db
    .delete(tables.gmailAccounts)
    .where(
      and(
        eq(tables.gmailAccounts.id, accountId),
        eq(tables.gmailAccounts.userId, userId)
      )
    );
}

/**
 * Get OAuth2 client with valid credentials for an account.
 * Sets up automatic token refresh for long-running operations.
 * Throws AuthExpiredError if refresh token is invalid.
 */
export async function getAuthenticatedClient(accountId: string) {
  const token = await getAccountTokens(accountId);

  if (!token) {
    throw new Error("No OAuth token found for this account");
  }

  const oauth2Client = getOAuth2Client();

  // Get the current (possibly refreshed) access token
  // This may throw AuthExpiredError if refresh token is invalid
  const accessToken = await getValidAccessToken(accountId);
  const refreshToken = decrypt(token.refreshToken);

  // Set both access and refresh tokens so the client can auto-refresh
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  // Listen for token refresh events to persist new tokens
  oauth2Client.on("tokens", async (tokens) => {
    console.log("[OAuth] Token refreshed automatically");

    if (tokens.access_token) {
      const encryptedAccessToken = encrypt(tokens.access_token);
      const newExpiresAt = tokens.expiry_date
        ? dbType === "postgres"
          ? new Date(tokens.expiry_date)
          : new Date(tokens.expiry_date).toISOString()
        : dbType === "postgres"
          ? new Date(Date.now() + 3600 * 1000)
          : new Date(Date.now() + 3600 * 1000).toISOString();
      const now = dbType === "postgres" ? new Date() : new Date().toISOString();

      try {
        await db
          .update(tables.oauthTokens)
          .set({
            accessToken: encryptedAccessToken,
            expiresAt: newExpiresAt as Date,
            updatedAt: now as Date,
          })
          .where(eq(tables.oauthTokens.gmailAccountId, accountId));

        console.log("[OAuth] Refreshed token saved to database");
      } catch (error) {
        console.error("[OAuth] Failed to save refreshed token:", error);
      }
    }
  });

  // Listen for errors during automatic refresh
  // Note: OAuth2Client extends EventEmitter and can emit "error" events,
  // but TypeScript types only include "tokens". Using type assertion.
  (oauth2Client as NodeJS.EventEmitter).on("error", async (error: Error) => {
    console.error("[OAuth] Client error:", error);
    if (isRefreshTokenExpiredError(error)) {
      await markAccountAuthExpired(accountId, "Authentication expired during operation");
    }
  });

  return oauth2Client;
}
