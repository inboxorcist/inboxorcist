import { useState, useEffect, useCallback, createContext, useContext } from "react";
import {
  createRootRoute,
  HeadContent,
  Scripts,
  Outlet,
  useNavigate,
  useLocation,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { LanguageProvider } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { useGmailAccounts } from "@/hooks/useGmailAccounts";
import { useStats } from "@/hooks/useStats";
import { useSyncProgress } from "@/hooks/useSyncProgress";
import { Loader2 } from "lucide-react";
import type { GmailAccount, QuickStats, SyncProgress, User } from "@/lib/api";

import appCss from "../index.css?url";

const SELECTED_ACCOUNT_KEY = "inboxorcist:selectedAccountId";

// Auth context for child components
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return context;
}

// App context to share state with child routes
interface AppContextType {
  accounts: GmailAccount[];
  selectedAccountId: string | null;
  selectedAccount: GmailAccount | undefined;
  selectAccount: (accountId: string | null) => void;
  stats: QuickStats | null;
  syncStatus: string | null;
  syncStartedAt: string | null;
  syncCompletedAt: string | null;
  syncProgress: SyncProgress | null;
  isSyncing: boolean;
  syncLoading: boolean;
  statsError: string | null;
  syncError: string | null;
  refetchStats: () => void;
  resumeSync: () => void;
  connectAccount: () => void;
  removeAccount: (id: string) => void;
  handleDisconnect: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return context;
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Inboxorcist",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        href: "/logo.png",
      },
    ],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </QueryClientProvider>
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "TanStack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const navigate = useNavigate();
  const location = useLocation();

  // Auth state
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();

  // Redirect unauthenticated users to login (except when on /login or /auth/* callback)
  useEffect(() => {
    if (authLoading) return;

    const isPublicRoute = location.pathname === "/login" || location.pathname.startsWith("/auth/");
    if (!isAuthenticated && !isPublicRoute) {
      navigate({ to: "/login", replace: true });
    }
  }, [authLoading, isAuthenticated, location.pathname, navigate]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, only render public routes (login, auth callback)
  if (!isAuthenticated) {
    const isPublicRoute = location.pathname === "/login" || location.pathname.startsWith("/auth/");

    if (!isPublicRoute) {
      // Show loading while redirect happens (from useEffect above)
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Redirecting...</p>
          </div>
        </div>
      );
    }

    return (
      <AuthContext.Provider value={{ user: null, isAuthenticated: false, logout }}>
        <Outlet />
      </AuthContext.Provider>
    );
  }

  // Authenticated - render the full app with contexts
  return (
    <AuthContext.Provider value={{ user, isAuthenticated, logout }}>
      <AuthenticatedApp />
    </AuthContext.Provider>
  );
}

/**
 * Inner component for authenticated users
 * Contains account selection, stats, sync state
 */
function AuthenticatedApp() {
  const navigate = useNavigate();
  const location = useLocation();
  // Auth context available for child components via useAuthContext()

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
    if (typeof window === "undefined") return null;
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
    progress: syncProgress,
    isLoading: syncLoading,
    error: syncError,
    resume: resumeSync,
  } = useSyncProgress(selectedAccountId);

  // Handle OAuth callback - select the account that was just added/reconnected
  useEffect(() => {
    if (oauthCallback) {
      selectAccount(oauthCallback.accountId);

      // Show toast/alert for duplicate account
      if (!oauthCallback.isNew) {
        console.log(`Account ${oauthCallback.email} was already connected. Tokens refreshed.`);
      }

      clearOAuthCallback();
    }
  }, [oauthCallback, selectAccount, clearOAuthCallback]);

  // Auto-select account when accounts load
  useEffect(() => {
    if (accounts.length === 0) return;

    // Don't auto-select if we're handling an OAuth callback (new account being added)
    if (oauthCallback) return;

    // If we have a saved selection, verify it still exists
    if (selectedAccountId) {
      const accountExists = accounts.some((a) => a.id === selectedAccountId);
      if (accountExists) return; // Keep current selection
    }

    // Select first account if no valid selection
    selectAccount(accounts[0].id);
  }, [accounts, selectedAccountId, selectAccount, oauthCallback]);

  // Redirect authenticated users away from login page to dashboard
  useEffect(() => {
    if (location.pathname === "/login") {
      navigate({ to: "/", replace: true });
    }
  }, [location.pathname, navigate]);

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

  const contextValue: AppContextType = {
    accounts,
    selectedAccountId,
    selectedAccount,
    selectAccount,
    stats,
    syncStatus,
    syncStartedAt,
    syncCompletedAt,
    syncProgress,
    isSyncing,
    syncLoading,
    statsError: accountsError || statsError,
    syncError,
    refetchStats,
    resumeSync,
    connectAccount,
    removeAccount,
    handleDisconnect,
  };

  return (
    <AppContext.Provider value={contextValue}>
      <Outlet />
    </AppContext.Provider>
  );
}
