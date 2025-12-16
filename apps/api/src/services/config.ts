import { db, tables, dbType } from '../db'
import { eq, sql } from 'drizzle-orm'
import { encrypt, decrypt } from '../lib/encryption'

/**
 * Configuration keys that can be stored in database
 */
export type ConfigKey = 'google_client_id' | 'google_client_secret' | 'app_url' | 'setup_completed'

/**
 * Keys that should be encrypted when stored in database
 */
const ENCRYPTED_KEYS: ConfigKey[] = ['google_client_secret']

/**
 * Mapping from config keys to environment variable names
 */
const ENV_VAR_MAP: Record<ConfigKey, string> = {
  google_client_id: 'GOOGLE_CLIENT_ID',
  google_client_secret: 'GOOGLE_CLIENT_SECRET',
  app_url: 'APP_URL',
  setup_completed: '', // No env var equivalent
}

/**
 * Source of a configuration value
 */
export type ConfigSource = 'env' | 'database' | 'default' | 'unset'

/**
 * Configuration value with its source
 */
export interface ConfigValue {
  value: string | null
  source: ConfigSource
  isEditable: boolean // false if set via env var
}

/**
 * Get a configuration value, checking env vars first, then database
 */
export async function getConfig(key: ConfigKey): Promise<ConfigValue> {
  // 1. Check environment variable first (takes precedence)
  const envVarName = ENV_VAR_MAP[key]
  if (envVarName) {
    const envValue = process.env[envVarName]
    if (envValue) {
      return {
        value: envValue,
        source: 'env',
        isEditable: false, // Cannot edit env vars through UI
      }
    }
  }

  // 2. Check database
  const dbValue = await getConfigFromDb(key)
  if (dbValue !== null) {
    return {
      value: dbValue,
      source: 'database',
      isEditable: true,
    }
  }

  // 3. Return default for app_url
  if (key === 'app_url') {
    const port = process.env.PORT || '6616'
    return {
      value: `http://localhost:${port}`,
      source: 'default',
      isEditable: true,
    }
  }

  // 4. Not set
  return {
    value: null,
    source: 'unset',
    isEditable: true,
  }
}

/**
 * Get raw value from database (handles decryption)
 */
async function getConfigFromDb(key: ConfigKey): Promise<string | null> {
  const result = await db
    .select()
    .from(tables.appConfig)
    .where(eq(tables.appConfig.key, key))
    .limit(1)

  const row = result[0]
  if (!row) {
    return null
  }

  if (row.isEncrypted) {
    try {
      return decrypt(row.value)
    } catch {
      console.error(`[Config] Failed to decrypt config key: ${key}`)
      return null
    }
  }

  return row.value
}

/**
 * Set a configuration value in the database
 * Throws if the key is set via environment variable
 */
export async function setConfig(key: ConfigKey, value: string): Promise<void> {
  // Check if set via env var - prevent overwriting
  const envVarName = ENV_VAR_MAP[key]
  if (envVarName && process.env[envVarName]) {
    throw new Error(
      `Cannot set '${key}' via UI - it is configured via environment variable ${envVarName}`
    )
  }

  const shouldEncrypt = ENCRYPTED_KEYS.includes(key)
  const storedValue = shouldEncrypt ? encrypt(value) : value

  // Upsert the value
  // Use SQL expression for updatedAt to handle both SQLite and PostgreSQL
  const now = dbType === 'sqlite' ? sql`datetime('now')` : sql`now()`

  await db
    .insert(tables.appConfig)
    .values({
      key,
      value: storedValue,
      isEncrypted: shouldEncrypt ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: tables.appConfig.key,
      set: {
        value: storedValue,
        isEncrypted: shouldEncrypt ? 1 : 0,
        updatedAt: now,
      },
    })
}

/**
 * Delete a configuration value from the database
 * Throws if the key is set via environment variable
 */
export async function deleteConfig(key: ConfigKey): Promise<void> {
  const envVarName = ENV_VAR_MAP[key]
  if (envVarName && process.env[envVarName]) {
    throw new Error(
      `Cannot delete '${key}' via UI - it is configured via environment variable ${envVarName}`
    )
  }

  await db.delete(tables.appConfig).where(eq(tables.appConfig.key, key))
}

/**
 * Get all configuration values with their sources
 */
export async function getAllConfig(): Promise<Record<ConfigKey, ConfigValue>> {
  const keys: ConfigKey[] = [
    'google_client_id',
    'google_client_secret',
    'app_url',
    'setup_completed',
  ]

  const result: Record<string, ConfigValue> = {}

  for (const key of keys) {
    result[key] = await getConfig(key)
  }

  return result as Record<ConfigKey, ConfigValue>
}

/**
 * Check if initial setup is required
 * Setup is required if Google credentials are not configured (via env or db)
 */
export async function isSetupRequired(): Promise<boolean> {
  const clientId = await getConfig('google_client_id')
  const clientSecret = await getConfig('google_client_secret')

  return clientId.value === null || clientSecret.value === null
}

/**
 * Check if setup is completed (all required config is set)
 */
export async function isSetupCompleted(): Promise<boolean> {
  const setupCompleted = await getConfig('setup_completed')
  if (setupCompleted.value === 'true') {
    return true
  }

  // Also check if required credentials are available (via env or db)
  const required = await isSetupRequired()
  return !required
}

/**
 * Mark setup as completed
 */
export async function markSetupCompleted(): Promise<void> {
  await setConfig('setup_completed', 'true')
}

/**
 * Get Google OAuth credentials (from env or db)
 * Returns null values if not configured
 */
export async function getGoogleCredentials(): Promise<{
  clientId: string | null
  clientSecret: string | null
  isConfigured: boolean
}> {
  const clientId = await getConfig('google_client_id')
  const clientSecret = await getConfig('google_client_secret')

  return {
    clientId: clientId.value,
    clientSecret: clientSecret.value,
    isConfigured: clientId.value !== null && clientSecret.value !== null,
  }
}

/**
 * Get the app URL (from env, db, or default)
 */
export async function getAppUrl(): Promise<string> {
  const config = await getConfig('app_url')
  return config.value || `http://localhost:${process.env.PORT || '6616'}`
}
