const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

/**
 * API client for backend requests
 */
async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Request failed: ${response.statusText}`);
  }

  return response.json();
}

export interface GmailAccount {
  id: string;
  email: string;
  connectedAt: string;
}

export interface AccountsResponse {
  accounts: GmailAccount[];
}

export interface AuthUrlResponse {
  url: string;
}

/**
 * Get OAuth authorization URL
 */
export async function getAuthUrl(): Promise<string> {
  const { url } = await request<AuthUrlResponse>("/oauth/gmail");
  return url;
}

/**
 * Get connected Gmail accounts
 */
export async function getAccounts(): Promise<GmailAccount[]> {
  const { accounts } = await request<AccountsResponse>("/oauth/gmail/accounts");
  return accounts;
}

/**
 * Disconnect a Gmail account
 */
export async function disconnectAccount(accountId: string): Promise<void> {
  await request(`/oauth/gmail/accounts/${accountId}`, {
    method: "DELETE",
  });
}

/**
 * Check API health
 */
export async function checkHealth(): Promise<{
  status: string;
  database: { type: string; connected: boolean };
}> {
  return request("/api/health");
}
