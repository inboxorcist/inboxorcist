# CLAUDE.md

> Context file for Claude Code. Helps Claude understand the Inboxorcist codebase.

## Project Overview

**Inboxorcist** — Self-hosted, privacy-first Gmail cleanup tool. Bulk delete emails from Promotions, Social, Updates. Handles 100k+ emails that Gmail's UI cannot.

**Tagline:** "The power of delete compels you"

**Principles:** Zero data leaves user's machine • Single Docker command • Clean UI for non-technical users

## Tech Stack

| Layer | Technology | Fallback |
|-------|------------|----------|
| Runtime | Bun | — |
| Backend | Hono | — |
| Frontend | React 19 + Vite + TailwindCSS + shadcn/ui | — |
| ORM | Drizzle | — |
| Database | Postgres | SQLite (if no `DATABASE_URL`) |
| Queue | In-memory | — |
| Gmail | googleapis | — |

## Project Structure

```
inboxorcist/
├── apps/
│   ├── api/                    # Hono backend
│   │   ├── src/
│   │   │   ├── index.ts        # Entry point
│   │   │   ├── routes/
│   │   │   │   ├── oauth.ts    # Gmail OAuth
│   │   │   │   ├── gmail.ts    # Gmail operations
│   │   │   │   ├── jobs.ts     # Deletion jobs
│   │   │   │   └── _auth.ts    # RESERVED: User auth (future)
│   │   │   ├── services/
│   │   │   │   ├── gmail.ts    # Gmail API wrapper
│   │   │   │   ├── oauth.ts    # Token management
│   │   │   │   └── queue/      # Job queue (in-memory)
│   │   │   ├── middleware/
│   │   │   │   ├── gmail-connected.ts
│   │   │   │   └── _authenticated.ts  # RESERVED
│   │   │   ├── db/
│   │   │   │   ├── index.ts    # Connection (Postgres/SQLite)
│   │   │   │   └── schema.ts   # Drizzle schema
│   │   │   └── lib/
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   │
│   └── web/                    # React frontend
│       ├── src/
│       │   ├── components/
│       │   │   ├── ui/         # shadcn components
│       │   │   └── domain/     # App components
│       │   ├── hooks/
│       │   ├── lib/
│       │   └── pages/
│       └── package.json
│
├── docker/
├── data/                       # SQLite location (gitignored)
├── CLAUDE.md
└── package.json
```

## API Routes

All API routes use `/api` prefix:

```
Auth:      GET|POST /api/auth/google|refresh|logout|me
OAuth:     GET /api/oauth/gmail/*
Gmail:     GET /api/gmail/stats|emails|labels
           POST /api/gmail/trash/empty
Explorer:  GET|POST|DELETE /api/explorer/*
Health:    GET /health

Frontend routes (handled by SPA):
           /auth/google/callback - OAuth callback from Google
           /* - All other routes
```

## Database Tables

- `oauth_tokens` — Gmail OAuth tokens (encrypted)
- `jobs` — Deletion job state and progress

Both tables will get `user_id` FK when cloud version ships.

## Commands

```bash
bun install              # Install deps
bun run dev              # Start API + Vite dev server
bun run dev:api          # API only (localhost:6616)
bun run dev:web          # Vite dev server (localhost:3000 with proxy)
bun run db:generate      # Generate migrations
bun run db:migrate       # Run migrations
bun run db:studio        # Drizzle Studio
bun run build            # Production build
```

## Environment Variables

```bash
# Required
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
JWT_SECRET=          # min 32 chars
ENCRYPTION_KEY=      # 64 hex chars

# Optional
APP_URL=http://localhost:6616   # Public URL (OAuth redirect derived from this)
DATABASE_URL=postgres://...     # Fallback to SQLite if not set
PORT=6616
FRONTEND_URL=http://localhost:3000  # Dev only (Vite dev server URL)
```

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
- Reserved files: `_filename.ts` (don't implement yet)

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
- Don't hardcode single-user assumptions deep in services