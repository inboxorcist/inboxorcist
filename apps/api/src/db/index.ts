import { drizzle as drizzlePg, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { drizzle as drizzleSqlite } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import postgres from 'postgres'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

import * as pgSchema from './schema.pg'
import * as sqliteSchema from './schema.sqlite'

// Type alias for the database - use Postgres type for IntelliSense
// Both SQLite and Postgres have the same runtime API
type AppDatabase = PostgresJsDatabase<typeof pgSchema>

// Determine which database to use based on DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL
const isPostgres = !!DATABASE_URL

// SQLite database path (relative to project root)
const SQLITE_PATH = process.env.SQLITE_PATH || join(process.cwd(), '../../data/inboxorcist.db')

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
 * Initialize the database connection
 */
function initDatabase() {
  if (isPostgres) {
    console.log('[DB] Connecting to PostgreSQL...')
    const client = postgres(DATABASE_URL!)
    const db = drizzlePg(client, { schema: pgSchema })
    return { db, client, type: 'postgres' as const, schema: pgSchema }
  } else {
    console.log(`[DB] Using SQLite at ${SQLITE_PATH}`)

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
    return { db, client: sqlite, type: 'sqlite' as const, schema: sqliteSchema }
  }
}

// Initialize database connection
const { db: dbInstance, client, type, schema } = initDatabase()

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
    }
  : {
      users: sqliteSchema.users,
      sessions: sqliteSchema.sessions,
      gmailAccounts: sqliteSchema.gmailAccounts,
      oauthTokens: sqliteSchema.oauthTokens,
      jobs: sqliteSchema.jobs,
    }

export const tables = tablesImpl as {
  users: typeof pgSchema.users
  sessions: typeof pgSchema.sessions
  gmailAccounts: typeof pgSchema.gmailAccounts
  oauthTokens: typeof pgSchema.oauthTokens
  jobs: typeof pgSchema.jobs
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
