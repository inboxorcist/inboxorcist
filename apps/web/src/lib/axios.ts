import axios, { AxiosError } from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

/**
 * Axios instance with default configuration
 */
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

/**
 * Request interceptor for logging and auth
 */
api.interceptors.request.use(
  (config) => {
    // Could add auth token here if needed
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor for error handling
 */
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; message?: string }>) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "An unexpected error occurred";

    return Promise.reject(new Error(message));
  }
);

export default api;
