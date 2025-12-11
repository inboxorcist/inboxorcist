import { useState, useEffect, useCallback } from "react";
import {
  getAccounts,
  getAuthUrl,
  disconnectAccount,
  type GmailAccount,
} from "@/lib/api";

interface UseGmailAccountsReturn {
  accounts: GmailAccount[];
  isLoading: boolean;
  error: string | null;
  connectAccount: () => Promise<void>;
  removeAccount: (accountId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useGmailAccounts(): UseGmailAccountsReturn {
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setError(null);
      const data = await getAccounts();
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch accounts");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Handle OAuth callback results from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get("oauth");

    if (oauthStatus === "success") {
      // Refresh accounts list after successful OAuth
      fetchAccounts();
      // Clear URL params
      window.history.replaceState({}, "", window.location.pathname);
    } else if (oauthStatus === "error") {
      const message = params.get("message") || "OAuth failed";
      setError(message);
      // Clear URL params
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [fetchAccounts]);

  const connectAccount = useCallback(async () => {
    try {
      setError(null);
      const authUrl = await getAuthUrl();
      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start OAuth flow"
      );
    }
  }, []);

  const removeAccount = useCallback(
    async (accountId: string) => {
      try {
        setError(null);
        await disconnectAccount(accountId);
        setAccounts((prev) => prev.filter((acc) => acc.id !== accountId));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to disconnect account"
        );
      }
    },
    []
  );

  return {
    accounts,
    isLoading,
    error,
    connectAccount,
    removeAccount,
    refresh: fetchAccounts,
  };
}
