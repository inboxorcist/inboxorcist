import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import { join } from 'path'
import { initializeBinaryEnvironment, isCompiledBinary, getAppDir } from './lib/startup'

// Initialize binary environment FIRST (before any other imports that use env vars)
// This auto-generates .env and loads it from binary directory
initializeBinaryEnvironment()

import { validateEnv } from './lib/env'
import { dbType, checkDatabaseHealth } from './db'
import authRoutes from './routes/auth'
import oauthRoutes from './routes/oauth'
import gmailRoutes from './routes/gmail'
import explorerRoutes from './routes/explorer'
import setupRoutes from './routes/setup'
import { initializeQueue, getQueueStatus, queueType } from './services/queue'
import { registerSyncWorker, resumeInterruptedJobs } from './services/sync'
import { startScheduler } from './services/scheduler'
import { securityHeaders } from './middleware/security-headers'
import { printBanner, printStartupInfo } from './lib/banner'
import { logger } from './lib/logger'

// Get the directory where the binary/script is located
const APP_DIR = getAppDir()

// Check if running in production mode (Docker or compiled binary)
const isProduction = process.env.NODE_ENV === 'production'

// Check if this is first run (no Google OAuth configured yet)
const isFirstRun = !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET

// Print banner for compiled binary
if (isCompiledBinary()) {
  printBanner()
}

// Validate required environment variables before anything else
validateEnv()

const app = new Hono()

// Initialize queue and register workers
initializeQueue()
registerSyncWorker()
logger.debug('[App] Queue and workers initialized')

// Start the scheduler for periodic delta sync
startScheduler()
logger.debug('[App] Scheduler started')

// Resume any interrupted jobs from previous run (async, don't block startup)
resumeInterruptedJobs().catch((error) => {
  console.error('[App] Failed to resume interrupted jobs:', error)
})

// CORS configuration
// In production (SPA mode), frontend is served from same origin
// In development, allow the Vite dev server origin
const isDev = process.env.NODE_ENV !== 'production'
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
app.use(
  '*',
  cors({
    origin: isDev ? frontendUrl : '*', // Allow all in production (same-origin SPA)
    credentials: true,
  })
)

// Security headers
app.use('*', securityHeaders())

// Root endpoint (only in development - in production/Docker, SPA serves /)
if (!isProduction) {
  app.get('/', (c) =>
    c.json({
      name: 'Inboxorcist API',
      message: 'The power of delete compels you',
    })
  )
}

// Health check
app.get('/health', async (c) => {
  const dbHealthy = await checkDatabaseHealth()
  const queueStatus = await getQueueStatus()

  return c.json({
    status: dbHealthy ? 'possessed' : 'exorcised',
    database: {
      type: dbType,
      connected: dbHealthy,
    },
    queue: queueStatus,
  })
})

// API routes - all under /api prefix
app.route('/api/setup', setupRoutes)
app.route('/api/auth', authRoutes)
app.route('/api/oauth', oauthRoutes)
app.route('/api/gmail', gmailRoutes)
app.route('/api/explorer', explorerRoutes)

// Static file serving for SPA (production mode - Docker or compiled binary)
// In development, Vite dev server handles this
if (isProduction) {
  // Path to public folder - relative to binary/script location
  const publicDir = join(APP_DIR, 'public')
  const indexPath = join(publicDir, 'index.html')

  logger.debug(`[SPA] Serving static files from: ${publicDir}`)
  logger.debug(`[SPA] Index fallback: ${indexPath}`)

  // Serve static assets from /assets folder
  app.use('/assets/*', serveStatic({ root: publicDir }))

  // Custom handler: serve static file if exists, otherwise serve index.html (SPA fallback)
  app.get('*', async (c) => {
    const path = new URL(c.req.url).pathname

    // Don't serve static files for paths that look like client-side routes (no extension)
    const hasExtension = path.includes('.') && !path.endsWith('/')

    if (hasExtension) {
      // Try to serve the static file
      const filePath = join(publicDir, path)
      const file = Bun.file(filePath)
      if (await file.exists()) {
        return new Response(file, {
          headers: { 'Content-Type': file.type },
        })
      }
    }

    // SPA fallback - serve index.html for all client-side routes
    const indexFile = Bun.file(indexPath)
    const content = await indexFile.text()
    return c.html(content)
  })
}

const port = process.env.PORT ? parseInt(process.env.PORT) : 6616

// Start the server
if (isCompiledBinary()) {
  // Production binary - use Bun.serve directly (no "development server" message)
  Bun.serve({
    port,
    fetch: app.fetch,
    development: false,
  })

  // Print startup info
  printStartupInfo({
    port,
    isFirstRun,
    dbType,
    queueType,
  })

  // Auto-open browser after a short delay to ensure server is ready
  setTimeout(() => {
    const url = isFirstRun ? `http://localhost:${port}/setup` : `http://localhost:${port}`
    const platform = process.platform

    try {
      if (platform === 'darwin') {
        Bun.spawn(['open', url])
      } else if (platform === 'win32') {
        Bun.spawn(['cmd', '/c', 'start', url])
      } else {
        // Linux and others
        Bun.spawn(['xdg-open', url])
      }
    } catch {
      // Silently fail if browser can't be opened
    }
  }, 500)
}

// Default export for development mode (bun --hot)
// When running as compiled binary, Bun.serve() above handles the server
// and this export is ignored since the process doesn't exit
export default isCompiledBinary()
  ? undefined
  : {
      port,
      fetch: app.fetch,
    }
