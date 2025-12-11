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
): Promise<GmailAccount> {
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

  if (existingAccount.length > 0) {
    gmailAccount = existingAccount[0];
    // Update the timestamp
    const now = dbType === "postgres" ? new Date() : new Date().toISOString();
    await db
      .update(tables.gmailAccounts)
      .set({ updatedAt: now as Date & string })
      .where(eq(tables.gmailAccounts.id, gmailAccount.id));
  } else {
    // Create new account
    const [newAccount] = await db
      .insert(tables.gmailAccounts)
      .values({ userId, email })
      .returning();
    gmailAccount = newAccount;
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
        expiresAt: expiresAt as Date & string,
        updatedAt: now as Date & string,
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
      expiresAt: expiresAt as Date & string,
    });
  }

  return gmailAccount;
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
 * Get a valid access token for a Gmail account.
 * Refreshes the token if expired.
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
      expiresAt: newExpiresAt as Date & string,
      updatedAt: now as Date & string,
    })
    .where(eq(tables.oauthTokens.gmailAccountId, accountId));

  return credentials.access_token;
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
 * Get OAuth2 client with valid credentials for an account
 */
export async function getAuthenticatedClient(accountId: string) {
  const accessToken = await getValidAccessToken(accountId);
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  return oauth2Client;
}
