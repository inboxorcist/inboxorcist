import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { refreshAuthToken } from "./auth.server";

/**
 * Axios instance with default configuration.
 * Uses relative URLs - requests are proxied to backend via Nitro devProxy.
 * Cookies are set by frontend server functions, sent by browser with requests.
 */
export const api = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
  withCredentials: true,
});

// Track refresh state to prevent multiple concurrent refreshes
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Response interceptor for error handling with automatic token refresh
 */
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error?: string; message?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized - try to refresh token first
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry refresh endpoint itself
      if (originalRequest.url?.includes("/auth/refresh")) {
        redirectToLogin();
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      // If already refreshing, wait for that to complete
      if (isRefreshing && refreshPromise) {
        const success = await refreshPromise;
        if (success) {
          return api(originalRequest);
        }
        redirectToLogin();
        return Promise.reject(error);
      }

      // Start refresh
      isRefreshing = true;
      refreshPromise = refreshAuthToken()
        .then((result) => result.success)
        .catch(() => false)
        .finally(() => {
          isRefreshing = false;
          refreshPromise = null;
        });

      const success = await refreshPromise;

      if (success) {
        // Retry original request with new token
        return api(originalRequest);
      }

      // Refresh failed - redirect to login
      redirectToLogin();
      return Promise.reject(error);
    }

    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "An unexpected error occurred";

    return Promise.reject(new Error(message));
  }
);

/**
 * Redirect to login page
 */
function redirectToLogin() {
  if (typeof window !== "undefined" && window.location.pathname !== "/login" && !window.location.pathname.startsWith("/auth/")) {
    window.location.href = "/login";
  }
}

export default api;
