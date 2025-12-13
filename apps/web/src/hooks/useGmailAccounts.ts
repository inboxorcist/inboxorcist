import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAccounts,
  getAuthUrl,
  disconnectAccount,
  type GmailAccount,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

interface OAuthCallbackResult {
  accountId: string;
  email: string;
  isNew: boolean;
}

interface UseGmailAccountsReturn {
  accounts: GmailAccount[];
  isLoading: boolean;
  error: string | null;
  oauthCallback: OAuthCallbackResult | null;
  clearOAuthCallback: () => void;
  connectAccount: () => Promise<void>;
  removeAccount: (accountId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useGmailAccounts(): UseGmailAccountsReturn {
  const queryClient = useQueryClient();
  const [oauthCallback, setOAuthCallback] = useState<OAuthCallbackResult | null>(null);

  // Query for fetching accounts
  const {
    data: accounts = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: getAccounts,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Mutation for disconnecting account
  const disconnectMutation = useMutation({
    mutationFn: disconnectAccount,
    onSuccess: (_, accountId) => {
      // Optimistically update the cache
      queryClient.setQueryData<GmailAccount[]>(queryKeys.accounts, (old) =>
        old?.filter((acc) => acc.id !== accountId) ?? []
      );
      // Also invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["syncProgress"] });
    },
  });

  // Handle OAuth callback results from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get("oauth");

    if (oauthStatus === "success") {
      const accountId = params.get("accountId");
      const email = params.get("email");
      const isNew = params.get("isNew") === "true";

      // Store callback result for App to handle account selection
      if (accountId && email) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: syncing state from URL params after OAuth redirect
        setOAuthCallback({ accountId, email, isNew });
      }

      // Refresh accounts list after successful OAuth
      refetch();
      // Clear URL params
      window.history.replaceState({}, "", window.location.pathname);
    } else if (oauthStatus === "error") {
      const message = params.get("message");
      console.error("[OAuth] Error:", message);
      // Clear URL params on error too
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [refetch]);

  const clearOAuthCallback = useCallback(() => {
    setOAuthCallback(null);
  }, []);

  const connectAccount = useCallback(async () => {
    const authUrl = await getAuthUrl();
    // Redirect to Google OAuth
    window.location.href = authUrl;
  }, []);

  const removeAccount = useCallback(
    async (accountId: string) => {
      await disconnectMutation.mutateAsync(accountId);
    },
    [disconnectMutation]
  );

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    accounts,
    isLoading,
    error: error?.message ?? disconnectMutation.error?.message ?? null,
    oauthCallback,
    clearOAuthCallback,
    connectAccount,
    removeAccount,
    refresh,
  };
}
