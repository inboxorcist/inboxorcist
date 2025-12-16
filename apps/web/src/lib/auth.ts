/**
 * Client-side auth functions
 *
 * These functions make API calls to the backend.
 * The backend handles setting/clearing cookies via Set-Cookie headers.
 */

interface ExchangeResult {
  success: boolean
  type?: 'login' | 'account_added'
  isNewUser?: boolean
  isNewAccount?: boolean
  isNew?: boolean
  accountId?: string
  redirectUrl?: string
  error?: string
  message?: string
}

interface RefreshResult {
  success: boolean
  error?: string
}

interface LogoutResult {
  success: boolean
}

/**
 * Exchange OAuth code for tokens
 * Backend sets cookies automatically
 */
export async function exchangeOAuthCode(code: string, state: string): Promise<ExchangeResult> {
  try {
    const response = await fetch('/api/auth/google/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code, state }),
    })

    const result: ExchangeResult = await response.json()

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'auth_failed',
        message: result.message || 'Authentication failed',
      }
    }

    return result
  } catch (error) {
    console.error('[Auth] Exchange error:', error)
    return {
      success: false,
      error: 'network_error',
      message: 'Failed to connect to server',
    }
  }
}

/**
 * Refresh access token
 * Backend reads cookies and sets new ones
 */
export async function refreshAuthToken(): Promise<RefreshResult> {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'refresh_failed' }
    }

    return { success: true }
  } catch (error) {
    console.error('[Auth] Refresh error:', error)
    return { success: false, error: 'network_error' }
  }
}

/**
 * Logout - revoke session and clear cookies
 * Backend handles everything
 */
export async function logoutAuth(): Promise<LogoutResult> {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })

    await response.json()
    return { success: true }
  } catch (error) {
    console.error('[Auth] Logout error:', error)
    // Even if the request fails, consider logout successful
    // (cookies might be cleared anyway, session will expire)
    return { success: true }
  }
}

/**
 * Check if session hint cookie exists
 * Used to avoid unnecessary /me calls when not logged in
 */
export function hasSessionHint(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.includes('_s=1')
}
