import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCurrentUser, getOAuthUrl, type User } from "@/lib/api";
import { logoutAuth } from "@/lib/auth.server";

const AUTH_QUERY_KEY = ["auth", "user"];

/**
 * Check if session hint cookie exists (JS-accessible)
 */
function hasSessionHint(): boolean {
  if (typeof document === "undefined") return true; // SSR - assume might have session
  return document.cookie.includes("_s=");
}

/**
 * Hook for managing authentication state
 *
 * Provides:
 * - user: Current authenticated user or null
 * - isLoading: Whether auth state is being determined
 * - isAuthenticated: Whether user is authenticated
 * - login: Function to initiate login (redirects to Google)
 * - logout: Function to log out
 */
export function useAuth() {
  const queryClient = useQueryClient();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Query for current user - skip if no session hint cookie
  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = useQuery<User | null>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      // Skip API call if no session hint - we know there's no session
      if (!hasSessionHint()) {
        return null;
      }
      return getCurrentUser();
    },
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    retry: false, // Don't retry on 401
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: logoutAuth,
    onSuccess: () => {
      // Clear all queries on logout
      queryClient.clear();
      // Redirect to login
      window.location.href = "/login";
    },
  });

  // Login - get OAuth URL from API, then navigate
  const login = async (redirect?: string) => {
    setIsLoggingIn(true);
    try {
      const { url } = await getOAuthUrl(redirect);
      window.location.href = url;
    } catch (err) {
      console.error("[Auth] Failed to get OAuth URL:", err);
      setIsLoggingIn(false);
    }
  };

  const logout = () => {
    logoutMutation.mutate();
  };

  return {
    user: user ?? null,
    isLoading: isLoading || isLoggingIn,
    isAuthenticated: !!user,
    error,
    login,
    logout,
    refetch,
    isLoggingOut: logoutMutation.isPending,
  };
}
