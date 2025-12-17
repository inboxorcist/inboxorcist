# Inboxorcist - Single Server Docker Image
# API serves both backend and SPA frontend on port 6616
# Based on official Bun Docker guide: https://bun.sh/guides/ecosystem/docker

# =============================================================================
# Base stage
# =============================================================================
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# =============================================================================
# Install dependencies for API (using Node.js for native module compilation)
# =============================================================================
FROM node:20-slim AS install-api

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install bun for package management
RUN npm install -g bun

WORKDIR /temp/dev
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
RUN bun install

# =============================================================================
# Install dependencies for Web
# =============================================================================
FROM base AS install-web
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
COPY apps/web/package.json /temp/dev/apps/web/
# Disable husky and skip scripts (no native modules needed for web)
ENV HUSKY=0
RUN cd /temp/dev && bun install --ignore-scripts

# =============================================================================
# Build Web (SPA)
# =============================================================================
FROM base AS build-web
COPY --from=install-web /temp/dev/node_modules node_modules
COPY --from=install-web /temp/dev/apps/web/node_modules apps/web/node_modules
COPY . .

WORKDIR /usr/src/app/apps/web
ENV NODE_ENV=production
ENV HUSKY=0
RUN bun run build

# =============================================================================
# Build API
# =============================================================================
FROM node:20-slim AS build-api

# Install bun for building
RUN npm install -g bun

WORKDIR /usr/src/app
COPY --from=install-api /temp/dev/node_modules node_modules
COPY --from=install-api /temp/dev/apps/api/node_modules apps/api/node_modules
COPY . .

WORKDIR /usr/src/app/apps/api
ENV NODE_ENV=production
RUN bun build src/index.ts --outdir dist --target bun

# =============================================================================
# Production release
# =============================================================================
FROM base AS release

# Install runtime dependencies (wget for healthcheck)
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

# Copy API build
COPY --from=build-api /usr/src/app/apps/api/dist ./dist
COPY --from=build-api /usr/src/app/apps/api/package.json ./

# Copy Postgres migrations and schema for drizzle-kit migrate
COPY --from=build-api /usr/src/app/apps/api/drizzle/pg ./drizzle/pg
COPY --from=build-api /usr/src/app/apps/api/drizzle.config.ts ./
COPY --from=build-api /usr/src/app/apps/api/src/db/schema.pg.ts ./src/db/

# Install drizzle-kit for migrations (Railway preDeployCommand)
# Note: Per-account email storage uses Bun's built-in SQLite (bun:sqlite)
RUN bun add drizzle-kit drizzle-orm postgres

# Copy Web build (SPA static files) to public directory
COPY --from=build-web /usr/src/app/apps/web/dist ./public

# Copy Docker configuration files
COPY docker/entrypoint.sh /entrypoint.sh

# Make entrypoint executable
RUN chmod +x /entrypoint.sh

# Create data directory for per-account email databases
RUN mkdir -p /usr/src/app/data && chmod 755 /usr/src/app/data

# Expose single port
EXPOSE 6616/tcp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:6616/health || exit 1

# Environment defaults
ENV NODE_ENV=production
ENV PORT=6616
ENV DATA_DIR=/usr/src/app/data

# Labels
LABEL org.opencontainers.image.title="Inboxorcist"
LABEL org.opencontainers.image.description="Self-hosted, privacy-first Gmail cleanup tool"

USER bun
ENTRYPOINT ["/entrypoint.sh"]
CMD ["bun", "run", "dist/index.js"]
