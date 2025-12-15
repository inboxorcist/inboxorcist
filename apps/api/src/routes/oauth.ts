import { Hono } from "hono";
import {
  getConnectedAccountsForUser,
  deleteGmailAccountForUser,
} from "../services/oauth";
import { auth, type AuthVariables } from "../middleware/auth";

const oauth = new Hono<{ Variables: AuthVariables }>();

// All OAuth routes require authentication (user must be logged in to add Gmail accounts)
oauth.use("*", auth());

/**
 * GET /oauth/gmail
 * Redirects to the auth flow for adding an additional Gmail account
 */
oauth.get("/gmail", (c) => {
  const redirect = c.req.query("redirect") || "/";
  // Redirect to auth endpoint with add_account flag
  return c.redirect(`/auth/google?add_account=true&redirect=${encodeURIComponent(redirect)}`);
});

/**
 * GET /oauth/gmail/accounts
 * Returns all connected Gmail accounts for the current user
 */
oauth.get("/gmail/accounts", async (c) => {
  const userId = c.get("userId");

  try {
    const accounts = await getConnectedAccountsForUser(userId);
    return c.json({
      accounts: accounts.map((account) => ({
        id: account.id,
        email: account.email,
        connectedAt: account.createdAt,
        syncStatus: account.syncStatus,
        syncError: account.syncError,
      })),
    });
  } catch (error) {
    console.error("[OAuth] Error fetching accounts:", error);
    return c.json({ error: "Failed to fetch connected accounts" }, 500);
  }
});

/**
 * DELETE /oauth/gmail/accounts/:id
 * Disconnect a Gmail account (only if owned by current user)
 */
oauth.delete("/gmail/accounts/:id", async (c) => {
  const userId = c.get("userId");
  const accountId = c.req.param("id");

  try {
    const deleted = await deleteGmailAccountForUser(userId, accountId);
    if (!deleted) {
      return c.json({ error: "Account not found" }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    console.error("[OAuth] Error deleting account:", error);
    return c.json({ error: "Failed to disconnect account" }, 500);
  }
});

export default oauth;
