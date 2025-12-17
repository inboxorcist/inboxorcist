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

### Prerequisites

- A Google account with Gmail
- Google OAuth credentials ([setup guide](docs/GOOGLE_OAUTH_SETUP.md))

### Option A: One-Line Install (Recommended)

**Linux & macOS:**
```bash
curl -fsSL https://inboxorcist.com/install.sh | bash
```

This installs to `~/.local/share/inboxorcist`. Then start:
```bash
~/.local/share/inboxorcist/inboxorcist
```

**Windows (PowerShell):**
```powershell
irm inboxorcist.com/install.ps1 | iex
```

This installs to `%USERPROFILE%\inboxorcist`. Then start:
```powershell
& "$env:USERPROFILE\inboxorcist\inboxorcist.exe"
```

On first run, the browser opens automatically to the setup page. Secure secrets are generated automatically.

---

### Option B: Manual Download

Download the latest release for your platform from [GitHub Releases](https://github.com/inboxorcist/inboxorcist/releases).

**macOS Apple Silicon (M1/M2/M3):**
```bash
curl -LO https://github.com/inboxorcist/inboxorcist/releases/latest/download/inboxorcist-darwin-arm64.tar.gz
tar -xzf inboxorcist-darwin-arm64.tar.gz
cd inboxorcist
./inboxorcist
```

**macOS Intel:**
```bash
curl -LO https://github.com/inboxorcist/inboxorcist/releases/latest/download/inboxorcist-darwin-x64.tar.gz
tar -xzf inboxorcist-darwin-x64.tar.gz
cd inboxorcist
./inboxorcist
```

**Linux x64:**
```bash
curl -LO https://github.com/inboxorcist/inboxorcist/releases/latest/download/inboxorcist-linux-x64.tar.gz
tar -xzf inboxorcist-linux-x64.tar.gz
cd inboxorcist
./inboxorcist
```

**Linux ARM64 (Raspberry Pi, AWS Graviton):**
```bash
curl -LO https://github.com/inboxorcist/inboxorcist/releases/latest/download/inboxorcist-linux-arm64.tar.gz
tar -xzf inboxorcist-linux-arm64.tar.gz
cd inboxorcist
./inboxorcist
```

**Windows:**
1. Download [`inboxorcist-windows-x64.zip`](https://github.com/inboxorcist/inboxorcist/releases/latest/download/inboxorcist-windows-x64.zip)
2. Extract the ZIP file
3. Open the extracted folder
4. Double-click `inboxorcist.exe`

---

### Option C: Docker

```bash
# Create a directory
mkdir inboxorcist && cd inboxorcist

# Download docker-compose.yml
curl -O https://raw.githubusercontent.com/inboxorcist/inboxorcist/main/docker-compose.yml

# Generate secrets and create .env file
cat > .env << EOF
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
EOF

# Start Inboxorcist
docker compose up -d
```

Open [http://localhost:6616](http://localhost:6616) in your browser.

---

### What Gets Started

| Method | URL | Database | Queue |
|--------|-----|----------|-------|
| Binary | http://localhost:6616 | SQLite (auto) | In-memory |
| Docker | http://localhost:6616 | PostgreSQL | In-memory |

### Connect Your Gmail

1. Open http://localhost:6616 in your browser
2. Click **Connect Gmail**
3. Sign in with your Google account
4. Grant the requested permissions
5. Start cleaning your inbox!

### Google OAuth Setup

See the [Google OAuth Setup guide](docs/GOOGLE_OAUTH_SETUP.md) for step-by-step instructions on creating OAuth credentials.

You need:
- **Client ID** - From Google Cloud Console
- **Client Secret** - From Google Cloud Console

Enter these on the `/setup` page or in your `.env` file.

## Deployment Options

| Platform | Deploy | Difficulty |
|----------|--------|------------|
| **Binary** | Download and run `./inboxorcist` | Easiest |
| Docker | `docker compose up -d` | Easy |
| Railway | [![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/inboxorcist?referralCode=-IUyz4&utm_medium=integration&utm_source=template&utm_campaign=generic) | Easy |
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
# Default: PostgreSQL + in-memory queue
docker compose up -d

# With Redis queue (production-ready)
docker compose --profile redis up -d
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for advanced Docker configurations.

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
├── Dockerfile        # Docker configuration
├── docker-compose.yml
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
