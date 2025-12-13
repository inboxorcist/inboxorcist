import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthExpiredBanner } from "@/components/domain/AuthExpiredBanner";
import { AlertCircle } from "lucide-react";
import type { GmailAccount, SyncProgress as SyncProgressType } from "@/lib/api";

interface DashboardLayoutProps {
  accounts: GmailAccount[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
  syncStatus: string | null;
  syncProgress: SyncProgressType | null;
  isSyncLoading: boolean;
  statsError: string | null;
  syncError: string | null;
  onResumeSync: () => void;
  onAddAccount: () => void;
}

export function DashboardLayout({
  accounts,
  selectedAccountId,
  onSelectAccount,
  syncStatus,
  syncProgress,
  isSyncLoading,
  statsError,
  syncError,
  onResumeSync,
  onAddAccount,
}: DashboardLayoutProps) {
  // Get selected account
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  // Check if auth is expired (from accounts list which updates faster)
  const isAuthExpired = selectedAccount?.syncStatus === "auth_expired" || syncStatus === "auth_expired";

  // Sync is happening unless explicitly completed or auth expired
  const isSyncing = syncStatus !== "completed" && syncStatus !== "idle" && syncStatus !== "auth_expired";

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sidebar */}
      <Sidebar
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onSelectAccount={onSelectAccount}
        onAddAccount={onAddAccount}
      />

      {/* Main Content */}
      <main className="ml-64 min-h-screen">
        <div className="p-8">
          {/* Auth Expired Banner */}
          {isAuthExpired && selectedAccount && (
            <div className="mb-6">
              <AuthExpiredBanner
                email={selectedAccount.email}
                onReconnect={onAddAccount}
              />
            </div>
          )}

          {/* Error Alerts (hide if auth expired since we have a dedicated banner) */}
          {!isAuthExpired && (statsError || syncError) && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{statsError || syncError}</AlertDescription>
            </Alert>
          )}

          {/* Page Content */}
          <Outlet context={{ syncProgress, isSyncLoading, onResumeSync, isSyncing }} />
        </div>
      </main>
    </div>
  );
}
