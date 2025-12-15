# Authentication System

> Complete documentation of the auth flow, token management, and API authorization in Inboxorcist

---

## Architecture Overview

### Key Design Decision: Frontend Sets Cookies

The backend **never sets cookies directly**. Instead:
1. Backend returns tokens as JSON in the response body
2. Frontend server functions (TanStack Start `createServerFn`) receive the tokens
3. Frontend server functions set httpOnly cookies on the same origin

**Why?** The frontend uses Nitro to proxy `/api/**` requests to the backend. Proxy servers don't reliably forward `Set-Cookie` headers. By having the frontend server set cookies, we ensure cookies are always set on the correct origin.

### Token Architecture

| Token | Storage | Lifetime | Purpose |
|-------|---------|----------|---------|
| Access Token | httpOnly cookie (`sid` / `__Host-sid`) | 1 hour | Authorize API requests |
| Refresh Token | httpOnly cookie (`rid` / `__Host-rid`) | 7 days | Get new access tokens |
| Fingerprint | httpOnly cookie (`fgp` / `__Host-fgp`) | 7 days | Bind tokens to browser (sidejacking protection) |
| Session Hint | JS cookie (`_s`) | 7 days | Frontend optimization - skip /me if no session |

Cookie names use `__Host-` prefix in production (requires `Secure`, `Path=/`, no `Domain`). The `_s` hint is intentionally JS-accessible and contains no sensitive data.

---

## Authentication Flow

### 1. Initial Page Load

```
Browser loads app
    ↓
__root.tsx renders → useAuth() hook fires
    ↓
useAuth checks: does `_s` cookie exist? (JS-accessible)
    ↓
If NO → Skip /me call, return null immediately → Show login page
    ↓
If YES → Call GET /api/auth/me (cookies sent automatically)
    ↓
Backend auth middleware checks:
  - Access token present? → Verify JWT signature + expiry
  - Fingerprint header matches cookie?
    ↓
If valid → Returns user object → App renders dashboard
If invalid/expired → Returns 401 → Trigger refresh flow
```

**Optimization:** The `_s` cookie is a JS-accessible hint. If it's missing, we know there's no session and skip the `/me` API call entirely.

### 2. Login Flow (Google OAuth)

```
User clicks "Sign in with Google" on /login
    ↓
Frontend calls GET /api/auth/google
    ↓
Backend generates:
  - PKCE code_verifier + code_challenge
  - State token (contains redirect URL, PKCE verifier, timestamp)
  - Encrypts state with ENCRYPTION_KEY
    ↓
Backend redirects to Google OAuth consent screen
  - Scopes: openid, email, profile, gmail.modify, gmail.readonly
    ↓
User consents → Google redirects to /auth/google/callback
    ↓
Callback component extracts code + state from URL
    ↓
Callback calls exchangeOAuthCode() server function
    ↓
Server function POSTs to backend /api/auth/google/exchange
    ↓
Backend:
  1. Decrypts + validates state
  2. Exchanges code for Google tokens (with PKCE verifier)
  3. Fetches Google user profile
  4. Creates or fetches user in DB
  5. Creates or updates Gmail account (stores encrypted Google tokens)
  6. Creates session in DB (refresh token hash, fingerprint hash)
  7. Signs JWT access token
  8. Returns JSON: { success, tokens: { accessToken, refreshToken, fingerprint }, ... }
    ↓
Server function receives tokens
    ↓
Server function sets three httpOnly cookies:
  - sid: accessToken (1 hour)
  - rid: refreshToken (7 days)
  - fgp: fingerprint (7 days)
    ↓
Callback component navigates to dashboard
    ↓
useAuth refetches → User is now authenticated
```

### 3. Adding Another Gmail Account

```
User clicks "Add account" in dashboard
    ↓
Frontend calls GET /api/oauth/gmail (different endpoint)
    ↓
Backend redirects to /auth/google?add_account=true
    ↓
Same OAuth flow, but callback behavior differs:
  - If add_account=true AND user already authenticated:
    - Links new Gmail account to existing user
    - Does NOT create new session
    - Returns existing tokens (no cookie changes needed)
```

### 4. Token Refresh (Automatic)

```
API request returns 401 (access token expired)
    ↓
axios interceptor catches 401
    ↓
Checks: Is this a retry? Is refresh already in progress?
    ↓
If another request is already refreshing → Wait for it
    ↓
Calls refreshAuthToken() server function
    ↓
Server function reads refresh token + fingerprint from cookies
    ↓
POSTs to backend /api/auth/refresh with { refreshToken, fingerprint }
    ↓
Backend:
  1. Finds session by refresh token hash
  2. Verifies fingerprint hash matches
  3. Verifies session not expired/revoked
  4. Generates NEW refresh token (rotation)
  5. Updates session with new token hash
  6. Signs new JWT access token
  7. Returns new tokens as JSON
    ↓
Server function sets new cookies (sid, rid, fgp)
    ↓
axios retries original request with new token
    ↓
If refresh fails → Redirect to /login
```

**Concurrency handling:** If multiple requests fail with 401 simultaneously, only one refresh happens. Others wait for it and retry if successful.

### 5. Logout

```
User clicks "Sign out"
    ↓
Frontend calls logoutAuth() server function
    ↓
Server function:
  1. Reads refresh token from cookie
  2. POSTs to backend /api/auth/logout
  3. Backend marks session as revoked (soft delete)
  4. Server function deletes all three cookies
    ↓
useAuth refetches → Returns null → Redirect to /login
```

---

## API Authorization

### How Requests Are Authorized

Every API request (except `/auth/google`, `/auth/google/callback`, `/auth/refresh`):

```
Request arrives at backend
    ↓
Auth middleware extracts:
  - Access token from cookie (sid / __Host-sid)
  - Fingerprint from header (X-Fingerprint) ← set by axios interceptor
    ↓
Middleware verifies:
  1. JWT signature valid (using JWT_SECRET)
  2. JWT not expired
  3. Fingerprint in JWT payload matches header
    ↓
If valid → Sets c.set("userId", payload.sub) → Request proceeds
If invalid → Returns 401 Unauthorized
```

### Ownership Verification

For routes that access user-specific resources (Gmail accounts, jobs):

```
Request: GET /api/gmail/accounts/:accountId/stats
    ↓
Auth middleware passes (user authenticated)
    ↓
Ownership middleware:
  1. Extracts accountId from params
  2. Queries DB for gmail_accounts where id = accountId
  3. Verifies account.userId === authenticated userId
    ↓
If owned → Request proceeds
If not owned → Returns 403 Forbidden
```

### Cookie + Header Flow

```
Browser                     Frontend Server              Backend
   │                              │                         │
   │── GET /api/gmail/stats ─────▶│                         │
   │   (cookies auto-attached)    │                         │
   │                              │── Proxy to backend ────▶│
   │                              │   + X-Fingerprint header │
   │                              │                         │
   │                              │◀── JSON response ───────│
   │◀── JSON response ────────────│                         │
```

The frontend Nitro proxy automatically forwards cookies. The axios interceptor adds the `X-Fingerprint` header by reading from the `fgp` cookie.

---

## Session Management

### Session Storage

Sessions are stored in the `sessions` table:
- `refreshTokenHash` - SHA-256 hash of refresh token (never store plaintext)
- `fingerprintHash` - SHA-256 hash of fingerprint
- `expiresAt` - Rolling expiry (7 days from last refresh)
- `absoluteExpiresAt` - Hard limit (30 days from creation)
- `revokedAt` - Set when session is logged out

### Multiple Sessions

Users can have multiple active sessions (different browsers/devices). Each session:
- Has its own refresh token
- Can be individually revoked from Settings
- Shows user agent + last used time

### Token Rotation

On every refresh:
1. Old refresh token is invalidated (by updating hash)
2. New refresh token is issued
3. If old token is reused → Session is revoked (potential theft detected)

---

## Security Features

| Feature | Implementation |
|---------|----------------|
| PKCE | Required for all OAuth flows (prevents code interception) |
| State encryption | OAuth state encrypted with AES (prevents CSRF) |
| Fingerprint binding | Random value in cookie + JWT (prevents token sidejacking) |
| Token rotation | New refresh token on each use (limits exposure window) |
| httpOnly cookies | Tokens inaccessible to JavaScript (prevents XSS theft) |
| SameSite=Strict | Cookies not sent cross-origin (prevents CSRF) |
| __Host- prefix | Ensures Secure + Path=/ (prevents cookie tossing) |
| Session hard limit | 30 days max regardless of activity |

---

## Environment Variables

```bash
# Required
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback

# Required - generate with: openssl rand -base64 32
JWT_SECRET=your-256-bit-secret

# Required - generate with: openssl rand -hex 32
ENCRYPTION_KEY=your-32-byte-hex-key

# URLs
FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:3001  # Used by frontend server functions
PORT=3001
```

---

## Key Files

### Backend
- `src/routes/auth.ts` - All auth endpoints
- `src/middleware/auth.ts` - JWT + fingerprint verification
- `src/middleware/ownership.ts` - Resource ownership checks
- `src/services/auth.ts` - Session creation, token generation
- `src/lib/jwt.ts` - JWT sign/verify utilities

### Frontend
- `src/lib/auth.server.ts` - Server functions that set cookies
- `src/hooks/useAuth.ts` - React Query hook for auth state
- `src/routes/auth/$provider/callback.tsx` - OAuth callback handler
- `src/routes/__root.tsx` - Auth context + route protection
- `src/lib/axios.ts` - HTTP client with 401 handling

---

## Common Scenarios

### User opens app after being away
1. Cookies still present → `GET /api/auth/me`
2. Access token expired → 401
3. Auto-refresh triggered → New tokens set
4. Retry succeeds → User sees dashboard

### User's refresh token expired (7+ days inactive)
1. `GET /api/auth/me` → 401
2. Refresh attempt → 401 (refresh token expired)
3. All cookies cleared → Redirect to /login

### User logs out on one device
1. Session revoked in DB
2. Cookies cleared on that device
3. Other devices unaffected (different sessions)

### User revokes all sessions from Settings
1. All sessions except current marked revoked
2. Other devices' next request → 401 → Forced to re-login
