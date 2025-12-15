import { createServerFn } from '@tanstack/react-start'
import { setCookie, getCookie, deleteCookie } from '@tanstack/react-start/server'

const API_URL = process.env.API_URL || 'http://localhost:3001'

// Cookie configuration
const isDev = process.env.NODE_ENV !== 'production'

// Cookie names (match backend)
const COOKIE_NAMES = {
  ACCESS_TOKEN: isDev ? 'sid' : '__Host-sid',
  REFRESH_TOKEN: isDev ? 'rid' : '__Host-rid',
  FINGERPRINT: isDev ? 'fgp' : '__Host-fgp',
  SESSION_HINT: '_s',
}

// Token expiry times (in seconds)
const TOKEN_EXPIRY = {
  accessToken: 60 * 60, // 1 hour
  refreshToken: 7 * 24 * 60 * 60, // 7 days
}

interface AuthTokens {
  accessToken: string
  refreshToken: string
  fingerprint: string
  expiresIn: number
}

interface ExchangeResult {
  success: boolean
  type?: 'login' | 'account_added'
  isNewUser?: boolean
  isNewAccount?: boolean
  isNew?: boolean
  accountId?: string
  redirectUrl?: string
  tokens?: AuthTokens
  error?: string
  message?: string
}

/**
 * Exchange OAuth code for tokens and set cookies
 */
export const exchangeOAuthCode = createServerFn({ method: 'POST' })
  .inputValidator((data: { code: string; state: string }) => data)
  .handler(async ({ data }): Promise<ExchangeResult> => {
    // Forward auth cookies to backend (needed for add_account flow)
    const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN)
    const fingerprint = getCookie(COOKIE_NAMES.FINGERPRINT)

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }

    // Forward cookies as Cookie header if present (for add_account auth verification)
    if (accessToken && fingerprint) {
      headers['Cookie'] =
        `${COOKIE_NAMES.ACCESS_TOKEN}=${accessToken}; ${COOKIE_NAMES.FINGERPRINT}=${fingerprint}`
    }

    const response = await fetch(`${API_URL}/auth/google/exchange`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code: data.code, state: data.state }),
    })

    const result: ExchangeResult = await response.json()

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'auth_failed',
        message: result.message || 'Authentication failed',
      }
    }

    // Set cookies from tokens
    if (result.tokens) {
      setCookie(COOKIE_NAMES.ACCESS_TOKEN, result.tokens.accessToken, {
        httpOnly: true,
        secure: !isDev,
        sameSite: 'strict',
        path: '/',
        maxAge: TOKEN_EXPIRY.accessToken,
      })
      setCookie(COOKIE_NAMES.REFRESH_TOKEN, result.tokens.refreshToken, {
        httpOnly: true,
        secure: !isDev,
        sameSite: 'strict',
        path: '/',
        maxAge: TOKEN_EXPIRY.refreshToken,
      })
      setCookie(COOKIE_NAMES.FINGERPRINT, result.tokens.fingerprint, {
        httpOnly: true,
        secure: !isDev,
        sameSite: 'strict',
        path: '/',
        maxAge: TOKEN_EXPIRY.refreshToken,
      })
      // Session hint - JS-accessible so frontend can skip /me if no session
      setCookie(COOKIE_NAMES.SESSION_HINT, '1', {
        httpOnly: false,
        secure: !isDev,
        sameSite: 'strict',
        path: '/',
        maxAge: TOKEN_EXPIRY.refreshToken,
      })
    }

    return {
      success: true,
      type: result.type,
      isNewUser: result.isNewUser,
      isNewAccount: result.isNewAccount,
      isNew: result.isNew,
      accountId: result.accountId,
      redirectUrl: result.redirectUrl,
    }
  })

/**
 * Refresh access token
 */
export const refreshAuthToken = createServerFn({ method: 'POST' }).handler(
  async (): Promise<{ success: boolean; error?: string }> => {
    const refreshToken = getCookie(COOKIE_NAMES.REFRESH_TOKEN)
    const fingerprint = getCookie(COOKIE_NAMES.FINGERPRINT)

    if (!refreshToken || !fingerprint) {
      clearAuthCookies()
      return { success: false, error: 'no_session' }
    }

    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken, fingerprint }),
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      clearAuthCookies()
      return { success: false, error: result.error || 'refresh_failed' }
    }

    // Set new cookies
    if (result.tokens) {
      setCookie(COOKIE_NAMES.ACCESS_TOKEN, result.tokens.accessToken, {
        httpOnly: true,
        secure: !isDev,
        sameSite: 'strict',
        path: '/',
        maxAge: TOKEN_EXPIRY.accessToken,
      })
      setCookie(COOKIE_NAMES.REFRESH_TOKEN, result.tokens.refreshToken, {
        httpOnly: true,
        secure: !isDev,
        sameSite: 'strict',
        path: '/',
        maxAge: TOKEN_EXPIRY.refreshToken,
      })
      setCookie(COOKIE_NAMES.FINGERPRINT, result.tokens.fingerprint, {
        httpOnly: true,
        secure: !isDev,
        sameSite: 'strict',
        path: '/',
        maxAge: TOKEN_EXPIRY.refreshToken,
      })
      // Refresh session hint expiry
      setCookie(COOKIE_NAMES.SESSION_HINT, '1', {
        httpOnly: false,
        secure: !isDev,
        sameSite: 'strict',
        path: '/',
        maxAge: TOKEN_EXPIRY.refreshToken,
      })
    }

    return { success: true }
  }
)

/**
 * Logout - revoke session and clear cookies
 */
export const logoutAuth = createServerFn({ method: 'POST' }).handler(
  async (): Promise<{ success: boolean }> => {
    const refreshToken = getCookie(COOKIE_NAMES.REFRESH_TOKEN)

    // Call backend to revoke session
    if (refreshToken) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {}) // Ignore errors
    }

    // Clear cookies
    clearAuthCookies()

    return { success: true }
  }
)

/**
 * Helper to clear all auth cookies
 */
function clearAuthCookies() {
  deleteCookie(COOKIE_NAMES.ACCESS_TOKEN)
  deleteCookie(COOKIE_NAMES.REFRESH_TOKEN)
  deleteCookie(COOKIE_NAMES.FINGERPRINT)
  deleteCookie(COOKIE_NAMES.SESSION_HINT)
}
