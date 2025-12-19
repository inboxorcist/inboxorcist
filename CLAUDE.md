# CLAUDE.md

> Context file for Claude Code. Helps Claude understand the Inboxorcist codebase.

## Project Overview

**Inboxorcist** — Self-hosted, privacy-first Gmail cleanup tool. Bulk delete emails from Promotions, Social, Updates. Handles 100k+ emails that Gmail's UI cannot.

**Tagline:** "The power of delete compels you"

**Principles:** Zero data leaves user's machine • Single binary or Docker • Clean UI for non-technical users

## Tech Stack

| Layer | Technology | Fallback |
|-------|------------|----------|
| Runtime | Bun | — |
| Backend | Hono | — |
| Frontend | React 19 + Vite + TailwindCSS + shadcn/ui | — |
| Documentation | Fumadocs | — |
| ORM | Drizzle | — |
| Database | PostgreSQL | SQLite (if no `DATABASE_URL`) |
| Queue | In-memory | — |
| Gmail | googleapis | — |

## Deployment Options

| Method | Database | Recommendation |
|--------|----------|----------------|
| Binary | SQLite (default) or PostgreSQL | **Recommended** - simplest |
| Docker | SQLite or PostgreSQL | Easy containerized deployment |
| Cloud (Railway, Render, etc.) | Managed PostgreSQL | One-click deploy available |

## Project Structure

```
inboxorcist/
├── apps/
│   ├── api/                    # Hono backend
│   │   ├── src/
│   │   │   ├── index.ts        # Entry point
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts     # User authentication
│   │   │   │   ├── oauth.ts    # Gmail OAuth
│   │   │   │   ├── gmail.ts    # Gmail operations
│   │   │   │   ├── explorer.ts # Email explorer
│   │   │   │   └── setup.ts    # First-run setup
│   │   │   ├── services/
│   │   │   │   ├── auth.ts     # Auth service
│   │   │   │   ├── gmail.ts    # Gmail API wrapper
│   │   │   │   ├── emails.ts   # Email operations
│   │   │   │   ├── sync/       # Email sync workers
│   │   │   │   └── queue/      # Job queue (in-memory)
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts     # JWT authentication
│   │   │   │   ├── gmail-connected.ts
│   │   │   │   └── security-headers.ts
│   │   │   ├── db/
│   │   │   │   ├── index.ts    # Connection (Postgres/SQLite)
│   │   │   │   ├── schema.pg.ts    # PostgreSQL schema
│   │   │   │   └── schema.sqlite.ts # SQLite schema
│   │   │   └── lib/
│   │   │       ├── startup.ts  # Environment detection, browser open
│   │   │       ├── banner.ts   # CLI banner
│   │   │       ├── env.ts      # Environment validation
│   │   │       ├── jwt.ts      # Token handling
│   │   │       └── logger.ts   # Logging utility
│   │   ├── drizzle/
│   │   │   ├── pg/             # PostgreSQL migrations
│   │   │   └── sqlite/         # SQLite migrations
│   │   └── package.json
│   │
│   ├── web/                    # React frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/         # shadcn components
│   │   │   │   └── domain/     # App components
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── routes/         # TanStack Router
│   │   └── package.json
│   │
│   └── docs/                   # Documentation site (Fumadocs)
│       ├── content/docs/       # MDX documentation
│       └── package.json
│
├── scripts/
│   └── build-binary.sh         # Binary build script
├── deploy/                     # Platform deploy configs
│   ├── fly.toml
│   ├── render.yaml
│   └── do-app-spec.yaml
├── Dockerfile
├── docker-compose.yml
├── entrypoint.sh
└── package.json
```

## Environment Detection

The app uses `isDevelopment()` from `lib/startup.ts` to determine behavior:

```typescript
isDevelopment() // returns true only if INBOXORCIST_ENV === 'development'
```

**Behavior differences:**

| Feature | Development | Production (default) |
|---------|-------------|---------------------|
| Auto migrations | ❌ Manual | ✅ Automatic |
| SPA serving | ❌ Vite handles | ✅ Hono serves |
| CORS | localhost:3000 + APP_URL | APP_URL only |
| HSTS headers | ❌ Disabled | ✅ Enabled |
| Secure cookies | ❌ Regular | ✅ __Host- prefix |
| Hot reload | ✅ export default | ❌ Bun.serve() |

## API Routes

All API routes use `/api` prefix:

```
Setup:     GET|POST /api/setup/config|status
Auth:      GET|POST /api/auth/google|refresh|logout|me|sessions
OAuth:     GET /api/oauth/gmail/*
Gmail:     GET /api/gmail/accounts|stats
Explorer:  GET|POST|DELETE /api/explorer/*
Health:    GET /health

Frontend routes (handled by SPA):
           /setup - First-run configuration
           /auth/google/callback - OAuth callback
           /* - All other routes
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts |
| `sessions` | Active sessions with refresh tokens |
| `gmail_accounts` | Connected Gmail accounts per user |
| `oauth_tokens` | Gmail OAuth tokens (encrypted) |
| `jobs` | Sync/deletion job state and progress |
| `emails` | Cached email metadata |
| `senders` | Aggregated sender statistics |
| `app_config` | App configuration (Google OAuth, etc.) |
| `unsubscribed_senders` | Senders user has unsubscribed from |

## Commands

```bash
# Development
bun install              # Install deps
bun run dev              # Start API + Vite dev server
bun run dev:api          # API only (localhost:6616)
bun run dev:web          # Vite dev server (localhost:3000)

# Database
bun run db:generate      # Generate migrations
bun run db:migrate       # Run migrations
bun run db:push          # Push schema changes
bun run db:studio        # Drizzle Studio

# Build
bun run build            # Production build (API + Web)
bun run build:binary     # Build single binary for current platform
bun run build:binary:linux       # Linux x64
bun run build:binary:linux-arm   # Linux ARM64
bun run build:binary:macos       # macOS Apple Silicon
bun run build:binary:macos-intel # macOS Intel
bun run build:binary:windows     # Windows x64

# Quality
bun run lint             # Run ESLint
bun run format           # Run Prettier
```

## Environment Variables

```bash
# Required for Docker/Cloud (auto-generated for binary)
JWT_SECRET=              # min 32 chars
ENCRYPTION_KEY=          # 64 hex chars

# Optional - Google OAuth (can configure via /setup UI instead)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Optional
APP_URL=http://localhost:6616   # Public URL
DATABASE_URL=postgres://...     # Use PostgreSQL (default: SQLite)
PORT=6616
```

## Key Files

### `lib/startup.ts`
- `isDevelopment()` - Check if in dev mode
- `hasDisplay()` - Check if GUI available (for browser auto-open)
- `openBrowser(url)` - Open browser if display available
- `getAppDir()` - Get app directory (handles binary vs source)
- `initializeBinaryEnvironment()` - Auto-generate .env for binary

### `lib/banner.ts`
- `printBanner()` - ASCII art banner (always shown)
- `printStartupInfo()` - Server status, URL, config info

### `db/index.ts`
- Dual database support (PostgreSQL + SQLite)
- Auto-detects based on `DATABASE_URL`
- `runMigrations()` - Run Drizzle migrations

## Key Constraints

- Max 1000 messages per Gmail batchDelete call
- Gmail API: 250 quota units/second — implement exponential backoff
- Access tokens expire in 1 hour — always handle refresh
- Jobs must be resumable if interrupted
- Never log tokens or email content

## Naming Conventions

- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Routes/services: `camelCase.ts`

## UI Copy (On-brand)

- "Begin the ritual" → Start deletion
- "Demons" → Unwanted email count
- "Exorcism complete" → Success
- "Holy water" → Empty trash
- "Wards" → Auto-delete rules (future)

## Don'ts

- Don't store email content, only metadata
- Don't log tokens or email addresses
- Don't use `any` type
- Don't check `isProduction` or `isCompiledBinary` — use `isDevelopment()` instead
