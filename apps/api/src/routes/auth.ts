import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { auth, COOKIE_NAMES, type AuthVariables } from '../middleware/auth'
import { authSecurityHeaders } from '../middleware/security-headers'
import {
  verifyJWT,
  getAccessTokenExpiry,
  getRefreshTokenExpiry,
  type RefreshTokenPayload,
} from '../lib/jwt'
import { verifyFingerprint } from '../lib/hash'
import {
  generateAuthUrl,
  parseOAuthState,
  exchangeAuthCode,
  findUserByGoogleId,
  findUserById,
  createUser,
  connectGmailAccount,
  createSession,
  refreshSession,
  revokeSession,
  revokeOtherSessions,
  revokeAllSessions,
  getUserSessions,
  deleteUser,
} from '../services/auth'
import { triggerPostOAuthSync } from '../services/sync/autoTrigger'

const authRoutes = new Hono<{ Variables: AuthVariables }>()

// Apply security headers to all auth routes
authRoutes.use('*', authSecurityHeaders())

/**
 * Token expiry times for frontend to set cookies
 */
export const TOKEN_EXPIRY = {
  accessToken: getAccessTokenExpiry(),
  refreshToken: getRefreshTokenExpiry(),
}

/**
 * GET /auth/google
 * Returns OAuth URL for frontend to navigate to
 */
authRoutes.get('/google', (c) => {
  const redirect = c.req.query('redirect') || '/'
  const isAddAccount = c.req.query('add_account') === 'true'

  const { url, state } = generateAuthUrl({ redirectUrl: redirect, isAddAccount })

  return c.json({ url, state })
})

/**
 * POST /auth/google/exchange
 * Exchanges OAuth code for tokens and creates session
 * Frontend calls this after Google redirects back with code
 */
authRoutes.post('/google/exchange', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { code, state: stateParam, error } = body

  // Handle OAuth errors
  if (error) {
    console.error(`[Auth] OAuth error: ${error}`)
    return c.json({ error: 'oauth_error', message: error }, 400)
  }

  if (!code || !stateParam) {
    return c.json({ error: 'missing_params', message: 'Missing code or state' }, 400)
  }

  try {
    // Parse state from request body
    const state = parseOAuthState(stateParam)

    // Exchange code for tokens
    const { tokens, userInfo } = await exchangeAuthCode(code, state.pkceVerifier)

    // Check if this is adding an additional account to existing user
    if (state.isAddAccount) {
      // Verify user is authenticated
      const accessToken = getCookie(c, COOKIE_NAMES.ACCESS_TOKEN)
      const fingerprint = getCookie(c, COOKIE_NAMES.FINGERPRINT)

      if (!accessToken || !fingerprint) {
        return c.json({ error: 'not_authenticated', message: 'Please log in first' }, 401)
      }

      const tokenResult = verifyJWT(accessToken)
      if (!tokenResult.valid || !tokenResult.payload) {
        return c.json({ error: 'invalid_session', message: 'Session expired' }, 401)
      }

      if (!verifyFingerprint(fingerprint, tokenResult.payload.fgp)) {
        return c.json({ error: 'invalid_session', message: 'Invalid session' }, 401)
      }

      const userId = tokenResult.payload.sub

      // Connect the additional Gmail account
      const { accountId, isNew } = await connectGmailAccount(userId, userInfo.email!, tokens)

      // Trigger background sync for the account
      await triggerPostOAuthSync(accountId)

      return c.json({
        success: true,
        type: 'account_added',
        accountId,
        isNew,
        redirectUrl: state.redirectUrl || '/',
      })
    }

    // Regular login/signup flow
    let user = await findUserByGoogleId(userInfo.id!)
    let isNewUser = false

    if (!user) {
      // Create new user
      user = await createUser({
        googleId: userInfo.id!,
        email: userInfo.email!,
        name: userInfo.name,
        picture: userInfo.picture,
      })

      isNewUser = true
    }

    // Connect/update Gmail account
    const { accountId, isNew: isNewAccount } = await connectGmailAccount(
      user.id,
      userInfo.email!,
      tokens
    )

    // Create session
    const session = await createSession(user.id, {
      userAgent: c.req.header('User-Agent'),
      ipAddress: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP'),
    })

    // Trigger background sync for the account
    await triggerPostOAuthSync(accountId)

    // Return tokens in JSON - frontend server action will set cookies
    return c.json({
      success: true,
      type: 'login',
      isNewUser,
      isNewAccount,
      accountId,
      redirectUrl: state.redirectUrl || '/',
      tokens: {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        fingerprint: session.fingerprint,
        expiresIn: session.expiresIn,
      },
    })
  } catch (err) {
    console.error('[Auth] Callback error:', err)
    return c.json({ error: 'auth_failed', message: 'Authentication failed' }, 500)
  }
})

/**
 * POST /auth/refresh
 * Refreshes access token using refresh token
 * Expects tokens in request body (sent by frontend server action)
 */
authRoutes.post('/refresh', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { refreshToken, fingerprint } = body

  if (!refreshToken || !fingerprint) {
    return c.json(
      { error: 'invalid_refresh_token', message: 'Session expired. Please log in again.' },
      401
    )
  }

  // Verify refresh token
  const result = verifyJWT<RefreshTokenPayload>(refreshToken)

  if (!result.valid || !result.payload || result.payload.type !== 'refresh') {
    return c.json(
      { error: 'invalid_refresh_token', message: 'Session expired. Please log in again.' },
      401
    )
  }

  // Verify fingerprint
  if (!verifyFingerprint(fingerprint, result.payload.fgp)) {
    return c.json(
      { error: 'invalid_refresh_token', message: 'Session expired. Please log in again.' },
      401
    )
  }

  // Refresh the session (with token rotation)
  const newTokens = await refreshSession(result.payload.sid, result.payload.fgp)

  if (!newTokens) {
    return c.json(
      { error: 'invalid_refresh_token', message: 'Session expired. Please log in again.' },
      401
    )
  }

  // Return new tokens in JSON - frontend server action will set cookies
  return c.json({
    success: true,
    tokens: {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      fingerprint: newTokens.fingerprint,
      expiresIn: newTokens.expiresIn,
    },
  })
})

/**
 * POST /auth/logout
 * Logs out the current session
 * Expects refresh token in request body
 */
authRoutes.post('/logout', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { refreshToken } = body

  if (refreshToken) {
    const result = verifyJWT<RefreshTokenPayload>(refreshToken)
    if (result.valid && result.payload) {
      await revokeSession(result.payload.sid)
    }
  }

  return c.json({ success: true })
})

/**
 * GET /auth/me
 * Returns current authenticated user
 */
authRoutes.get('/me', auth(), async (c) => {
  const userId = c.get('userId')
  const user = await findUserById(userId)

  if (!user) {
    return c.json({ error: 'user_not_found' }, 404)
  }

  return c.json({
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    createdAt: user.createdAt,
  })
})

/**
 * GET /auth/sessions
 * Lists all active sessions for current user
 */
authRoutes.get('/sessions', auth(), async (c) => {
  const userId = c.get('userId')
  const sessionId = c.get('sessionId')

  const sessions = await getUserSessions(userId, sessionId)

  return c.json({ sessions })
})

/**
 * DELETE /auth/sessions/:id
 * Revokes a specific session
 */
authRoutes.delete('/sessions/:id', auth(), async (c) => {
  const userId = c.get('userId')
  const _currentSessionId = c.get('sessionId')
  const targetSessionId = c.req.param('id')

  // Get session to verify ownership
  const sessions = await getUserSessions(userId)
  const targetSession = sessions.find((s) => s.id === targetSessionId)

  if (!targetSession) {
    return c.json({ error: 'session_not_found' }, 404)
  }

  // Revoke the session
  await revokeSession(targetSessionId)

  return c.json({ success: true })
})

/**
 * DELETE /auth/sessions
 * Revokes all sessions except current (logout everywhere else)
 */
authRoutes.delete('/sessions', auth(), async (c) => {
  const userId = c.get('userId')
  const currentSessionId = c.get('sessionId')

  const revokedCount = await revokeOtherSessions(userId, currentSessionId)

  return c.json({ success: true, revokedCount })
})

/**
 * DELETE /auth/account
 * Deletes user account and all associated data
 */
authRoutes.delete('/account', auth(), async (c) => {
  const userId = c.get('userId')

  // Require confirmation
  const body = await c.req.json().catch(() => ({}))
  if (body.confirmation !== 'DELETE') {
    return c.json(
      { error: 'confirmation_required', message: 'Send { confirmation: "DELETE" } to confirm' },
      400
    )
  }

  // Revoke all sessions first
  await revokeAllSessions(userId)

  // Delete the user and all associated data
  await deleteUser(userId)

  return c.json({ success: true })
})

export default authRoutes
