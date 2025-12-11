import { Hono } from "hono";
import {
  getAuthUrl,
  exchangeCodeForTokens,
  getUserEmail,
  saveGmailAccount,
  getConnectedAccounts,
  deleteGmailAccount,
} from "../services/oauth";

const oauth = new Hono();

/**
 * GET /oauth/gmail
 * Returns the OAuth authorization URL to redirect the user to
 */
oauth.get("/gmail", (c) => {
  try {
    const authUrl = getAuthUrl();
    return c.json({ url: authUrl });
  } catch (error) {
    console.error("[OAuth] Error generating auth URL:", error);
    return c.json(
      { error: "Failed to generate authorization URL" },
      500
    );
  }
});

/**
 * GET /oauth/gmail/callback
 * Handles the OAuth callback from Google
 */
oauth.get("/gmail/callback", async (c) => {
  const code = c.req.query("code");
  const error = c.req.query("error");
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  if (error) {
    console.error("[OAuth] Authorization denied:", error);
    return c.redirect(`${frontendUrl}?oauth=error&message=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return c.redirect(`${frontendUrl}?oauth=error&message=No authorization code received`);
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Missing required tokens from Google");
    }

    // Get user email
    const email = await getUserEmail(tokens.access_token);

    // Save account and tokens
    await saveGmailAccount(email, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date || Date.now() + 3600 * 1000,
      scope: tokens.scope || "",
      token_type: tokens.token_type || "Bearer",
    });

    console.log(`[OAuth] Successfully connected Gmail account: ${email}`);

    // Redirect to frontend with success
    return c.redirect(`${frontendUrl}?oauth=success&email=${encodeURIComponent(email)}`);
  } catch (error) {
    console.error("[OAuth] Error during callback:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.redirect(`${frontendUrl}?oauth=error&message=${encodeURIComponent(message)}`);
  }
});

/**
 * GET /oauth/gmail/accounts
 * Returns all connected Gmail accounts
 */
oauth.get("/gmail/accounts", async (c) => {
  try {
    const accounts = await getConnectedAccounts();
    return c.json({
      accounts: accounts.map((account) => ({
        id: account.id,
        email: account.email,
        connectedAt: account.createdAt,
      })),
    });
  } catch (error) {
    console.error("[OAuth] Error fetching accounts:", error);
    return c.json({ error: "Failed to fetch connected accounts" }, 500);
  }
});

/**
 * DELETE /oauth/gmail/accounts/:id
 * Disconnect a Gmail account
 */
oauth.delete("/gmail/accounts/:id", async (c) => {
  const accountId = c.req.param("id");

  try {
    await deleteGmailAccount(accountId);
    return c.json({ success: true });
  } catch (error) {
    console.error("[OAuth] Error deleting account:", error);
    return c.json({ error: "Failed to disconnect account" }, 500);
  }
});

export default oauth;
