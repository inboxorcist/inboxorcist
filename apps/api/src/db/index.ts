import { drizzle as drizzlePg, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { drizzle as drizzleSqlite } from 'drizzle-orm/bun-sqlite'
import { migrate as migrateSqlite } from 'drizzle-orm/bun-sqlite/migrator'
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator'
import { Database } from 'bun:sqlite'
import postgres from 'postgres'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

import * as pgSchema from './schema.pg'
import * as sqliteSchema from './schema.sqlite'
import { logger } from '../lib/logger'

// Type alias for the database - use Postgres type for IntelliSense
// Both SQLite and Postgres have the same runtime API
type AppDatabase = PostgresJsDatabase<typeof pgSchema>

// Determine which database to use based on DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL
const isPostgres = !!DATABASE_URL

// Detect if we're running as a compiled binary
// In compiled binaries, import.meta.dir returns virtual paths like /$bunfs/root/...
const isCompiledBinary = import.meta.dir.startsWith('/$bunfs/')

// Get the directory where the binary/script is located
// For compiled binaries, use dirname(process.execPath) to get the actual binary location
const APP_DIR = isCompiledBinary ? dirname(process.execPath) : import.meta.dir

// SQLite database path
// Priority: SQLITE_PATH env var > ./data/inboxorcist.db relative to binary
// For compiled binary: data/ folder sits next to the binary
// For development: data/ folder at project root (../../data from src/db/)
const getDefaultSqlitePath = () => {
  // In compiled mode, use path relative to binary
  if (isCompiledBinary) {
    return join(APP_DIR, 'data', 'inboxorcist.db')
  }
  // In development, use project root
  return join(process.cwd(), 'data', 'inboxorcist.db')
}

const SQLITE_PATH = process.env.SQLITE_PATH || getDefaultSqlitePath()

// Migrations path
// Priority: MIGRATIONS_PATH env var > ./drizzle/<type> relative to binary/project
const getMigrationsPath = (dbType: 'sqlite' | 'pg') => {
  if (process.env.MIGRATIONS_PATH) {
    return process.env.MIGRATIONS_PATH
  }
  // In Docker/production with Postgres, migrations are at /usr/src/app/drizzle/pg
  if (isPostgres && existsSync('/usr/src/app/drizzle/pg')) {
    return '/usr/src/app/drizzle/pg'
  }
  // In compiled mode, use path relative to binary
  if (isCompiledBinary) {
    return join(APP_DIR, 'drizzle', dbType)
  }
  // In development, use path relative to api folder
  return join(APP_DIR, '..', '..', 'drizzle', dbType)
}

const SQLITE_MIGRATIONS_PATH = getMigrationsPath('sqlite')
const PG_MIGRATIONS_PATH = getMigrationsPath('pg')

/**
 * Database connection type
 */
export type DatabaseType = 'postgres' | 'sqlite'

/**
 * Get the current database type
 */
export function getDatabaseType(): DatabaseType {
  return isPostgres ? 'postgres' : 'sqlite'
}

/**
 * Run migrations for the database
 */
async function runMigrations(
  db: ReturnType<typeof drizzlePg> | ReturnType<typeof drizzleSqlite>,
  dbType: 'postgres' | 'sqlite',
  migrationsPath: string
) {
  if (!existsSync(migrationsPath)) {
    logger.warn(`[DB] Migrations folder not found at ${migrationsPath}`)
    return
  }

  logger.info(`[DB] Running migrations from ${migrationsPath}`)
  try {
    if (dbType === 'postgres') {
      await migratePg(db as ReturnType<typeof drizzlePg>, { migrationsFolder: migrationsPath })
    } else {
      migrateSqlite(db as ReturnType<typeof drizzleSqlite>, { migrationsFolder: migrationsPath })
    }
    logger.info('[DB] Migrations completed successfully')
  } catch (error) {
    // If migrations fail due to already applied, that's OK
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (!errorMessage.includes('already been applied')) {
      logger.error('[DB] Migration error:', errorMessage)
    }
  }
}

/**
 * Initialize the database connection
 */
async function initDatabase() {
  if (isPostgres) {
    logger.info('[DB] Connecting to PostgreSQL...')
    const client = postgres(DATABASE_URL!)
    const db = drizzlePg(client, { schema: pgSchema })

    // Run migrations automatically for PostgreSQL in Docker
    await runMigrations(db, 'postgres', PG_MIGRATIONS_PATH)

    return { db, client, type: 'postgres' as const, schema: pgSchema }
  } else {
    logger.info(`[DB] Using SQLite at ${SQLITE_PATH}`)

    // Ensure data directory exists
    const dataDir = dirname(SQLITE_PATH)
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true })
    }

    const sqlite = new Database(SQLITE_PATH)
    // Enable WAL mode for better concurrent access
    sqlite.run('PRAGMA journal_mode = WAL;')
    sqlite.run('PRAGMA foreign_keys = ON;')

    const db = drizzleSqlite(sqlite, { schema: sqliteSchema })

    // Run migrations automatically for SQLite (only in compiled binary mode)
    // In development, use `bun run db:push` to apply schema changes
    if (isCompiledBinary) {
      await runMigrations(db, 'sqlite', SQLITE_MIGRATIONS_PATH)
    }

    return { db, client: sqlite, type: 'sqlite' as const, schema: sqliteSchema }
  }
}

// Initialize database connection (using top-level await)
const { db: dbInstance, client, type, schema } = await initDatabase()

// Export the database instance typed as Postgres for IntelliSense.
// SQLite and Postgres Drizzle instances have the same runtime API.
// Type differences (e.g., Date vs string for timestamps) are handled at call sites via dbType checks.
export const db = dbInstance as unknown as AppDatabase
export { client, schema }
export const dbType = type

// Re-export types from both schemas for convenience
export type {
  User,
  NewUser,
  Session,
  NewSession,
  GmailAccount,
  NewGmailAccount,
  OAuthToken,
  NewOAuthToken,
  Job,
  NewJob,
  JobStatus,
  JobType,
  SyncStatus,
  AppConfig,
  NewAppConfig,
  UnsubscribedSender,
  NewUnsubscribedSender,
} from './schema.pg'

// Export table references typed as Postgres for IntelliSense.
// At runtime, the correct schema (SQLite or Postgres) is used based on dbType.
const tablesImpl = isPostgres
  ? {
      users: pgSchema.users,
      sessions: pgSchema.sessions,
      gmailAccounts: pgSchema.gmailAccounts,
      oauthTokens: pgSchema.oauthTokens,
      jobs: pgSchema.jobs,
      appConfig: pgSchema.appConfig,
      unsubscribedSenders: pgSchema.unsubscribedSenders,
    }
  : {
      users: sqliteSchema.users,
      sessions: sqliteSchema.sessions,
      gmailAccounts: sqliteSchema.gmailAccounts,
      oauthTokens: sqliteSchema.oauthTokens,
      jobs: sqliteSchema.jobs,
      appConfig: sqliteSchema.appConfig,
      unsubscribedSenders: sqliteSchema.unsubscribedSenders,
    }

export const tables = tablesImpl as {
  users: typeof pgSchema.users
  sessions: typeof pgSchema.sessions
  gmailAccounts: typeof pgSchema.gmailAccounts
  oauthTokens: typeof pgSchema.oauthTokens
  jobs: typeof pgSchema.jobs
  appConfig: typeof pgSchema.appConfig
  unsubscribedSenders: typeof pgSchema.unsubscribedSenders
}

/**
 * Close database connection gracefully
 */
export function closeDatabase() {
  if (isPostgres && client) {
    ;(client as ReturnType<typeof postgres>).end()
  } else if (client) {
    ;(client as Database).close()
  }
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    if (isPostgres) {
      await (client as ReturnType<typeof postgres>)`SELECT 1`
    } else {
      ;(client as Database).query('SELECT 1').get()
    }
    return true
  } catch {
    return false
  }
}
