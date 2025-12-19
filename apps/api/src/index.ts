import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import { join } from 'path'
import { initializeBinaryEnvironment, isDevelopment, getAppDir, openBrowser } from './lib/startup'

// Initialize binary environment (auto-generates .env and loads it from binary directory)
initializeBinaryEnvironment()

import { validateEnv } from './lib/env'
import { dbType, checkDatabaseHealth, runMigrations } from './db'
import { deleteConfig } from './services/config'
import authRoutes from './routes/auth'
import oauthRoutes from './routes/oauth'
import gmailRoutes from './routes/gmail'
import explorerRoutes from './routes/explorer'
import setupRoutes from './routes/setup'
import { initializeQueue, getQueueStatus, queueType } from './services/queue'
import { registerSyncWorker, resumeInterruptedJobs } from './services/sync'
import { startScheduler } from './services/scheduler'
import { securityHeaders } from './middleware/security-headers'
import { printBanner, printStartupInfo, getVersion } from './lib/banner'
import { logger } from './lib/logger'

// Get the directory where the binary/script is located
const APP_DIR = getAppDir()

// Check if this is first run (no Google OAuth configured yet)
const isFirstRun = !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET

// Print banner
printBanner()

// Validate required environment variables before anything else
validateEnv()

// Run database migrations automatically (except in development)
// In dev mode, use `bun run db:migrate` or `bun run db:push` manually
if (!isDevelopment()) {
  await runMigrations()
}

// Handle CLI arguments
const args = process.argv.slice(2)
if (args.includes('--reset-google-oauth')) {
  console.log('\n[Setup] Resetting Google OAuth configuration...')
  try {
    await deleteConfig('google_client_id')
    await deleteConfig('google_client_secret')
    await deleteConfig('setup_completed')
    console.log('[Setup] Google OAuth configuration reset successfully.')
    console.log('[Setup] Visit /setup to reconfigure.\n')
  } catch (error) {
    console.error('[Setup] Failed to reset:', error)
  }
}

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
// In development: Allow localhost:3000 (Vite) and APP_URL
// Otherwise: Same-origin SPA, allow APP_URL only
const appUrl = process.env.APP_URL || 'http://localhost:6616'
const allowedOrigins = isDevelopment() ? ['http://localhost:3000', appUrl] : [appUrl]

app.use(
  '*',
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
)

// Security headers
app.use('*', securityHeaders())

// Root endpoint (only in development - otherwise SPA serves /)
if (isDevelopment()) {
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
    version: getVersion(),
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

// Static file serving for SPA (non-development mode)
// In development, Vite dev server handles this
if (!isDevelopment()) {
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
if (!isDevelopment()) {
  // Production mode - use Bun.serve directly
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

  // Auto-open browser if display is available
  setTimeout(() => {
    const url = isFirstRun ? `http://localhost:${port}/setup` : `http://localhost:${port}`
    openBrowser(url)
  }, 500)
}

// Default export for development mode (bun --hot)
// In production, Bun.serve() above handles the server
export default isDevelopment()
  ? {
      port,
      fetch: app.fetch,
    }
  : undefined
