/**
 * Binary startup utilities
 * Handles auto-generation of .env and loading from binary directory
 */

import { existsSync, writeFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'

/**
 * Detect if running as a compiled Bun binary
 */
export function isCompiledBinary(): boolean {
  return import.meta.dir.startsWith('/$bunfs/')
}

/**
 * Get the application directory
 * - For compiled binary: directory where binary is located
 * - For development: the source directory
 */
export function getAppDir(): string {
  if (isCompiledBinary()) {
    return dirname(process.execPath)
  }
  return import.meta.dir
}

/**
 * Generate a cryptographically secure random base64 string
 */
function generateRandomBase64(bytes: number): string {
  const array = new Uint8Array(bytes)
  crypto.getRandomValues(array)
  return Buffer.from(array).toString('base64')
}

/**
 * Generate a cryptographically secure random hex string
 */
function generateRandomHex(bytes: number): string {
  const array = new Uint8Array(bytes)
  crypto.getRandomValues(array)
  return Buffer.from(array).toString('hex')
}

/**
 * Parse a .env file content into key-value pairs
 */
function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {}
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue

    const equalIndex = trimmed.indexOf('=')
    if (equalIndex === -1) continue

    const key = trimmed.slice(0, equalIndex).trim()
    let value = trimmed.slice(equalIndex + 1).trim()

    // Remove quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    env[key] = value
  }

  return env
}

/**
 * Initialize environment for compiled binary
 * - Sets NODE_ENV to production by default
 * - Auto-generates .env with secure secrets if missing
 * - Loads .env from binary directory (not CWD)
 */
export function initializeBinaryEnvironment(): void {
  if (!isCompiledBinary()) {
    return // Only run for compiled binaries
  }

  const appDir = getAppDir()
  const envPath = join(appDir, '.env')

  // Set production mode by default for binary
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production'
  }

  // Auto-generate .env if it doesn't exist
  if (!existsSync(envPath)) {
    console.log('\n========================================')
    console.log('  First Run - Generating Secure Config')
    console.log('========================================\n')

    const jwtSecret = generateRandomBase64(32)
    const encryptionKey = generateRandomHex(32)

    const envContent = `# Inboxorcist Configuration
# Auto-generated on: ${new Date().toISOString()}

# JWT secret for signing auth tokens (auto-generated, do not share)
JWT_SECRET=${jwtSecret}

# Encryption key for OAuth tokens (auto-generated, do not share)
ENCRYPTION_KEY=${encryptionKey}

# Server port (default: 6616)
PORT=6616

# Google OAuth credentials
# Configure via http://localhost:6616/setup or uncomment and set here:
# GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
# GOOGLE_CLIENT_SECRET=your-client-secret

# App URL - used for OAuth redirect URI
# Uncomment and set if running behind a reverse proxy or custom domain:
# APP_URL=https://your-domain.com
`

    writeFileSync(envPath, envContent, 'utf-8')
    console.log(`  Created: ${envPath}`)
    console.log('  Secure secrets generated automatically.\n')
  }

  // Load .env from binary directory into process.env
  // This ensures the binary works regardless of where it's run from
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8')
    const envVars = parseEnvFile(content)

    for (const [key, value] of Object.entries(envVars)) {
      // Don't override existing env vars (allows CLI overrides)
      if (process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  }
}
