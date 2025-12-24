import { db, tables, dbType } from '../db'
import { eq, sql } from 'drizzle-orm'
import { encrypt, decrypt } from '../lib/encryption'
import { AI_PROVIDER_IDS, type AIProvider } from './ai/types'

/**
 * Configuration keys that can be stored in database
 */
export type ConfigKey =
  | 'google_client_id'
  | 'google_client_secret'
  | 'app_url'
  | 'setup_completed'
  // AI Provider API Keys
  | 'openai_api_key'
  | 'anthropic_api_key'
  | 'google_ai_api_key'
  | 'vercel_api_key'
  // AI Defaults
  | 'default_ai_provider'
  | 'default_ai_model'

/**
 * AI Provider types - re-exported from ai/types for backwards compatibility
 */
export type AIProviderType = AIProvider

/**
 * Keys that should be encrypted when stored in database
 */
const ENCRYPTED_KEYS: ConfigKey[] = [
  'google_client_secret',
  'openai_api_key',
  'anthropic_api_key',
  'google_ai_api_key',
  'vercel_api_key',
]

/**
 * Mapping from config keys to environment variable names
 */
const ENV_VAR_MAP: Record<ConfigKey, string> = {
  google_client_id: 'GOOGLE_CLIENT_ID',
  google_client_secret: 'GOOGLE_CLIENT_SECRET',
  app_url: 'APP_URL',
  setup_completed: '', // No env var equivalent
  // AI Provider API Keys
  openai_api_key: 'OPENAI_API_KEY',
  anthropic_api_key: 'ANTHROPIC_API_KEY',
  google_ai_api_key: 'GOOGLE_AI_API_KEY',
  vercel_api_key: 'AI_GATEWAY_API_KEY',
  // AI Defaults
  default_ai_provider: 'DEFAULT_AI_PROVIDER',
  default_ai_model: 'DEFAULT_AI_MODEL',
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
    'openai_api_key',
    'anthropic_api_key',
    'google_ai_api_key',
    'default_ai_provider',
    'default_ai_model',
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

// ============================================================================
// AI Provider Configuration
// ============================================================================

/**
 * Mapping from AI provider to config key
 */
const AI_PROVIDER_KEY_MAP: Record<AIProviderType, ConfigKey> = {
  openai: 'openai_api_key',
  anthropic: 'anthropic_api_key',
  google: 'google_ai_api_key',
  vercel: 'vercel_api_key',
}

/**
 * Get API key for a specific AI provider
 */
export async function getAIApiKey(provider: AIProviderType): Promise<string | null> {
  const configKey = AI_PROVIDER_KEY_MAP[provider]
  const config = await getConfig(configKey)
  return config.value
}

/**
 * Set API key for a specific AI provider
 */
export async function setAIApiKey(provider: AIProviderType, apiKey: string): Promise<void> {
  const configKey = AI_PROVIDER_KEY_MAP[provider]
  await setConfig(configKey, apiKey)
}

/**
 * Delete API key for a specific AI provider
 */
export async function deleteAIApiKey(provider: AIProviderType): Promise<void> {
  const configKey = AI_PROVIDER_KEY_MAP[provider]
  await deleteConfig(configKey)
}

/**
 * Check if a specific AI provider has an API key configured
 */
export async function hasAIApiKey(provider: AIProviderType): Promise<boolean> {
  const apiKey = await getAIApiKey(provider)
  return apiKey !== null && apiKey.length > 0
}

/**
 * Get list of AI providers that have API keys configured
 */
export async function getConfiguredAIProviders(): Promise<AIProviderType[]> {
  const configured: AIProviderType[] = []

  for (const provider of AI_PROVIDER_IDS) {
    if (await hasAIApiKey(provider)) {
      configured.push(provider)
    }
  }

  return configured
}

/**
 * Check if at least one AI provider is configured
 */
export async function hasAnyAIProvider(): Promise<boolean> {
  const configured = await getConfiguredAIProviders()
  return configured.length > 0
}

/**
 * Get the default AI provider (from config or first configured)
 */
export async function getDefaultAIProvider(): Promise<AIProviderType | null> {
  const defaultProvider = await getConfig('default_ai_provider')

  if (defaultProvider.value) {
    // Verify the default provider has an API key
    const hasKey = await hasAIApiKey(defaultProvider.value as AIProviderType)
    if (hasKey) {
      return defaultProvider.value as AIProviderType
    }
  }

  // Fall back to first configured provider
  const configured = await getConfiguredAIProviders()
  return configured[0] || null
}

/**
 * Get the default AI model
 */
export async function getDefaultAIModel(): Promise<string | null> {
  const defaultModel = await getConfig('default_ai_model')
  return defaultModel.value
}

/**
 * Set the default AI provider and model
 */
export async function setDefaultAI(provider: AIProviderType, model: string): Promise<void> {
  await setConfig('default_ai_provider', provider)
  await setConfig('default_ai_model', model)
}

/**
 * Get full AI configuration status
 */
export async function getAIConfig(): Promise<{
  isConfigured: boolean
  configuredProviders: AIProviderType[]
  defaultProvider: AIProviderType | null
  defaultModel: string | null
}> {
  const configuredProviders = await getConfiguredAIProviders()
  const defaultProvider = await getDefaultAIProvider()
  const defaultModel = await getDefaultAIModel()

  return {
    isConfigured: configuredProviders.length > 0,
    configuredProviders,
    defaultProvider,
    defaultModel,
  }
}
