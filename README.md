# Inboxorcist

> The power of delete compels you

Self-hosted, privacy-first Gmail cleanup tool. Bulk delete emails from Promotions, Social, Updates, and more. Handles 100k+ emails that Gmail's UI cannot.

## Features

- **Bulk Email Cleanup** - Delete thousands of emails at once
- **Smart Filtering** - Filter by sender, category, date, size, and more
- **Privacy First** - Your data never leaves your machine
- **Self-Hosted** - Run on your own server or locally
- **Multiple Accounts** - Connect multiple Gmail accounts
- **Progress Tracking** - Real-time sync and deletion progress
- **Single Binary** - No Docker required, just download and run

## Quick Start

Choose your preferred installation method:

### Option A: One-Line Install (Recommended)

```bash
curl -fsSL https://inboxorcist.com/install.sh | bash
```

Then start:
```bash
cd ~/.local/share/inboxorcist
./run.sh
```

The browser opens automatically. Configure Google OAuth at `/setup` on first run.

---

### Option B: Manual Download

1. Download the latest release for your platform from [Releases](https://github.com/inboxorcist/inboxorcist/releases)
2. Extract to a folder of your choice
3. Run:

```bash
./run.sh   # macOS/Linux
run.bat    # Windows
```

On first run:
- Secure secrets are automatically generated
- Browser opens automatically to the setup page
- Configure your Google OAuth credentials

That's it! Start using Inboxorcist at [http://localhost:6616](http://localhost:6616).

---

### Option C: Docker

```bash
git clone https://github.com/inboxorcist/inboxorcist.git
cd inboxorcist
docker compose --profile default up -d
```

Open [http://localhost:6616/setup](http://localhost:6616/setup) to configure Google OAuth.

---

### Google OAuth Setup

Both options require Google OAuth credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing
3. Enable Gmail API
4. Create OAuth 2.0 credentials (Web application)
5. Add redirect URI: `http://localhost:6616/auth/google/callback`
6. Copy Client ID and Client Secret

See [detailed guide](docs/GOOGLE_OAUTH_SETUP.md) for step-by-step instructions.

## Deployment Options

| Platform | Deploy | Difficulty |
|----------|--------|------------|
| **Binary** | Download and run `./run.sh` | Easiest |
| Docker | `docker compose --profile default up -d` | Easy |
| Railway | [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/inboxorcist) | Easy |
| Render | [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy) | Easy |
| Fly.io | `fly launch` | Medium |
| DigitalOcean | [![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new) | Medium |

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions.

## Binary Distribution

### What's Included

```
inboxorcist/
├── inboxorcist       # Single executable (~85MB)
├── public/           # Frontend assets
├── drizzle/sqlite/   # Database migrations
├── data/             # SQLite database (auto-created)
├── run.sh            # Launcher script (macOS/Linux)
├── run.bat           # Launcher script (Windows)
└── .env.example      # Configuration reference
```

### Available Platforms

| Platform | File |
|----------|------|
| Linux x64 | `inboxorcist-linux-x64.tar.gz` |
| Linux ARM64 | `inboxorcist-linux-arm64.tar.gz` |
| macOS Apple Silicon | `inboxorcist-darwin-arm64.tar.gz` |
| macOS Intel | `inboxorcist-darwin-x64.tar.gz` |
| Windows x64 | `inboxorcist-windows-x64.zip` |

### Building from Source

```bash
# Clone the repository
git clone https://github.com/inboxorcist/inboxorcist.git
cd inboxorcist

# Install dependencies
bun install

# Build for current platform
bun run build:binary

# Build for specific platform
bun run build:binary:linux       # Linux x64
bun run build:binary:linux-arm   # Linux ARM64
bun run build:binary:macos       # macOS Apple Silicon
bun run build:binary:macos-intel # macOS Intel
bun run build:binary:windows     # Windows x64
```

Distribution will be created in the `dist/` folder.

## Docker Profiles

```bash
# Default: SQLite + in-memory queue (simplest, recommended for personal use)
docker compose --profile default up -d

# With PostgreSQL (better for multiple users)
docker compose --profile postgres up -d

# Full: PostgreSQL + Redis (production-ready)
docker compose --profile full up -d

# Separate containers (advanced, for custom deployments)
docker compose --profile separate up -d
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | Setup | Google OAuth client ID (can be set via `/setup` UI) |
| `GOOGLE_CLIENT_SECRET` | Setup | Google OAuth client secret (can be set via `/setup` UI) |
| `JWT_SECRET` | Auto | Token signing secret (auto-generated on first run) |
| `ENCRYPTION_KEY` | Auto | Encryption key (auto-generated on first run) |
| `PORT` | No | Server port (default: `6616`) |
| `APP_URL` | No | Public URL (default: `http://localhost:6616`) |
| `DATABASE_URL` | No | PostgreSQL URL (default: SQLite) |
| `REDIS_URL` | No | Redis URL (default: in-memory queue) |

**Note:** When using the binary distribution, `JWT_SECRET` and `ENCRYPTION_KEY` are automatically generated on first run. Google OAuth credentials can be configured via the web UI at `/setup`.

Generate secrets manually (if needed):
```bash
openssl rand -base64 32  # JWT_SECRET
openssl rand -hex 32     # ENCRYPTION_KEY
```

See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) for full reference.

## Development

### Prerequisites

- [Bun](https://bun.sh) v1.1+

### Setup

```bash
# Install dependencies
bun install

# Copy environment file
cp apps/api/.env.example apps/api/.env
# Edit .env with your secrets (or let the app generate them)

# Run database migrations
bun run db:migrate

# Start development servers
bun run dev
```

- API: [http://localhost:6616](http://localhost:6616)
- Web (Vite dev): [http://localhost:3000](http://localhost:3000)
- Run `bun run dev` to start both API and Vite dev server with hot reload

### Project Structure

```
inboxorcist/
├── apps/
│   ├── api/          # Hono backend (Bun)
│   ├── web/          # React frontend (Vite)
│   └── docs/         # Documentation site (Fumadocs)
├── docker/           # Docker configuration
├── deploy/           # Platform-specific deploy configs
├── docs/             # Markdown documentation
└── scripts/          # Helper scripts
```

### Commands

```bash
bun run dev              # Start API + Web in development
bun run build            # Build for production
bun run build:binary     # Build single binary distribution
bun run db:generate      # Generate database migrations
bun run db:migrate       # Run database migrations
bun run db:studio        # Open Drizzle Studio
bun run lint             # Run ESLint
bun run format           # Run Prettier
```

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Backend**: [Hono](https://hono.dev)
- **Frontend**: React 19 + Vite + TailwindCSS + shadcn/ui
- **Documentation**: [Fumadocs](https://fumadocs.vercel.app)
- **Database**: PostgreSQL or SQLite (via Drizzle ORM)
- **Queue**: Redis (BullMQ) or in-memory
- **Gmail**: Google APIs

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting a PR.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- [Documentation](docs/)
- [Issues](https://github.com/inboxorcist/inboxorcist/issues)
- [Discussions](https://github.com/inboxorcist/inboxorcist/discussions)
