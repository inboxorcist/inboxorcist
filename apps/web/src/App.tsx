import { useState, useEffect, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useGmailAccounts } from "@/hooks/useGmailAccounts";
import { useStats } from "@/hooks/useStats";
import { useSyncProgress } from "@/hooks/useSyncProgress";
import { ConnectAccount } from "@/components/domain/ConnectAccount";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { OverviewPage } from "@/components/domain/OverviewPage";
import { ExplorerPage } from "@/components/domain/ExplorerPage";
import { CleanupPage } from "@/components/domain/CleanupPage";
import { SettingsPage } from "@/components/domain/SettingsPage";
import { Loader2 } from "lucide-react";

const SELECTED_ACCOUNT_KEY = "inboxorcist:selectedAccountId";

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    accounts,
    isLoading: accountsLoading,
    error: accountsError,
    oauthCallback,
    clearOAuthCallback,
    connectAccount,
    removeAccount,
  } = useGmailAccounts();

  // Selected account for dashboard - initialize from localStorage
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(() => {
    return localStorage.getItem(SELECTED_ACCOUNT_KEY);
  });

  // Wrapper to persist selection to localStorage
  const selectAccount = useCallback((accountId: string | null) => {
    setSelectedAccountId(accountId);
    if (accountId) {
      localStorage.setItem(SELECTED_ACCOUNT_KEY, accountId);
    } else {
      localStorage.removeItem(SELECTED_ACCOUNT_KEY);
    }
  }, []);

  // Stats and sync for selected account
  const {
    stats,
    syncStatus,
    syncStartedAt,
    syncCompletedAt,
    error: statsError,
    refetch: refetchStats,
  } = useStats(selectedAccountId);

  const {
    progress,
    isLoading: syncLoading,
    error: syncError,
    resume: resumeSync,
  } = useSyncProgress(selectedAccountId);

  // Handle OAuth callback - select the account that was just added/reconnected
  useEffect(() => {
    if (oauthCallback) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: syncing state from OAuth callback
      selectAccount(oauthCallback.accountId);

      // Show toast/alert for duplicate account
      if (!oauthCallback.isNew) {
        // This is a reconnected existing account, could show a notification
        console.log(`Account ${oauthCallback.email} was already connected. Tokens refreshed.`);
      }

      clearOAuthCallback();
    }
  }, [oauthCallback, selectAccount, clearOAuthCallback]);

  // Auto-select account when accounts load
  useEffect(() => {
    if (accounts.length === 0) return;

    // If we have a saved selection, verify it still exists
    if (selectedAccountId) {
      const accountExists = accounts.some((a) => a.id === selectedAccountId);
      if (accountExists) return; // Keep current selection
    }

    // Select first account if no valid selection
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: auto-select first account on initial load
    selectAccount(accounts[0].id);
  }, [accounts, selectedAccountId, selectAccount]);

  // Redirect to /get-started if no accounts
  useEffect(() => {
    if (accountsLoading) return;

    if (accounts.length === 0 && location.pathname !== "/get-started") {
      navigate("/get-started", { replace: true });
    }
  }, [accounts, accountsLoading, location.pathname, navigate]);

  // Get selected account details
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  // Loading state - also wait for selectedAccountId to be set when accounts exist
  const isInitializing = accountsLoading || (accounts.length > 0 && !selectedAccountId);

  // Sync state helpers (auth_expired is not syncing)
  const isSyncing = syncStatus !== "completed" && syncStatus !== "idle" && syncStatus !== "auth_expired";

  // Handler for disconnecting account
  const handleDisconnect = useCallback(() => {
    if (selectedAccount) {
      removeAccount(selectedAccount.id);
      selectAccount(null);
    }
  }, [selectedAccount, removeAccount, selectAccount]);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/get-started"
        element={<ConnectAccount onConnect={connectAccount} />}
      />

      {/* Dashboard routes with shared layout */}
      {selectedAccount ? (
        <Route
          element={
            <DashboardLayout
              accounts={accounts}
              selectedAccountId={selectedAccountId!}
              onSelectAccount={selectAccount}
              syncStatus={syncStatus}
              syncProgress={progress}
              isSyncLoading={syncLoading}
              statsError={accountsError || statsError}
              syncError={syncError}
              onResumeSync={resumeSync}
              onAddAccount={connectAccount}
            />
          }
        >
          <Route
            index
            element={
              <OverviewPage
                accountId={selectedAccountId!}
                stats={stats}
                syncProgress={progress}
                syncStatus={syncStatus}
                syncStartedAt={syncStartedAt}
                syncCompletedAt={syncCompletedAt}
                isSyncing={isSyncing}
                onSyncComplete={refetchStats}
              />
            }
          />
          <Route
            path="explorer"
            element={
              <ExplorerPage
                accountId={selectedAccountId!}
                syncStatus={syncStatus}
                syncStartedAt={syncStartedAt}
                syncCompletedAt={syncCompletedAt}
                onSyncComplete={refetchStats}
              />
            }
          />
          <Route
            path="cleanup"
            element={
              <CleanupPage
                stats={stats}
                syncProgress={progress}
                isSyncing={isSyncing}
              />
            }
          />
          <Route
            path="settings"
            element={
              <SettingsPage
                account={selectedAccount}
                onDisconnect={handleDisconnect}
              />
            }
          />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/get-started" replace />} />
      )}

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
