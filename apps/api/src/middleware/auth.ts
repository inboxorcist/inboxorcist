import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { verifyJWT, type AccessTokenPayload } from '../lib/jwt'
import { verifyFingerprint, hashForLog } from '../lib/hash'

/**
 * Auth context variables set by middleware.
 */
export interface AuthVariables {
  userId: string
  sessionId: string
}

/**
 * Cookie names for auth tokens.
 * In production (HTTPS), use __Host- prefix for maximum security.
 * In development (HTTP), use regular names since __Host- requires Secure flag.
 */
const isDev = process.env.NODE_ENV !== 'production'
export const COOKIE_NAMES = {
  ACCESS_TOKEN: isDev ? 'sid' : '__Host-sid',
  REFRESH_TOKEN: isDev ? 'rid' : '__Host-rid',
  FINGERPRINT: isDev ? 'fgp' : '__Host-fgp',
} as const

/**
 * Extract bearer token from Authorization header.
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  return authHeader.slice(7)
}

/**
 * Auth middleware - verifies JWT access token and fingerprint.
 *
 * Sets context variables:
 * - userId: The authenticated user's ID
 * - sessionId: The current session ID
 *
 * Returns 401 if:
 * - No access token provided
 * - Token is invalid or expired
 * - Fingerprint validation fails
 */
export const auth = () => {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    // Get access token from cookie or Authorization header
    const accessToken =
      getCookie(c, COOKIE_NAMES.ACCESS_TOKEN) || extractBearerToken(c.req.header('Authorization'))

    if (!accessToken) {
      console.log('[Auth] No access token provided')
      return c.json({ error: 'unauthorized', message: 'Authentication required' }, 401)
    }

    // Verify token
    const result = verifyJWT<AccessTokenPayload>(accessToken)

    if (!result.valid || !result.payload) {
      console.log(`[Auth] Invalid token: ${result.error}`)
      return c.json({ error: 'unauthorized', message: result.error || 'Invalid token' }, 401)
    }

    // Verify token type
    if (result.payload.type !== 'access') {
      console.log('[Auth] Wrong token type')
      return c.json({ error: 'unauthorized', message: 'Invalid token type' }, 401)
    }

    // Get fingerprint from header or cookie and verify against token's hash
    const fingerprint = c.req.header('X-Fingerprint') || getCookie(c, COOKIE_NAMES.FINGERPRINT)
    if (!fingerprint) {
      console.log('[Auth] No fingerprint provided')
      return c.json({ error: 'unauthorized', message: 'Invalid session' }, 401)
    }

    if (!verifyFingerprint(fingerprint, result.payload.fgp)) {
      console.log(`[Auth] Fingerprint mismatch for user ${hashForLog(result.payload.sub)}`)
      return c.json({ error: 'unauthorized', message: 'Invalid session' }, 401)
    }

    // Set context variables
    c.set('userId', result.payload.sub)
    c.set('sessionId', result.payload.sid)

    await next()
  })
}

/**
 * Optional auth middleware - same as auth but doesn't return 401.
 * Sets userId to null if not authenticated.
 * Useful for routes that have different behavior for authenticated vs anonymous users.
 */
export const optionalAuth = () => {
  return createMiddleware<{ Variables: Partial<AuthVariables> }>(async (c, next) => {
    const accessToken =
      getCookie(c, COOKIE_NAMES.ACCESS_TOKEN) || extractBearerToken(c.req.header('Authorization'))

    if (!accessToken) {
      await next()
      return
    }

    const result = verifyJWT<AccessTokenPayload>(accessToken)

    if (!result.valid || !result.payload || result.payload.type !== 'access') {
      await next()
      return
    }

    const fingerprint = c.req.header('X-Fingerprint') || getCookie(c, COOKIE_NAMES.FINGERPRINT)
    if (!fingerprint || !verifyFingerprint(fingerprint, result.payload.fgp)) {
      await next()
      return
    }

    c.set('userId', result.payload.sub)
    c.set('sessionId', result.payload.sid)

    await next()
  })
}

/**
 * Utility to check if request is authenticated.
 */
export function isAuthenticated(c: { get: (key: string) => unknown }): boolean {
  return typeof c.get('userId') === 'string'
}
