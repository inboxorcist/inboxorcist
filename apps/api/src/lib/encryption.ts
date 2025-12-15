import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

/**
 * Get the encryption key from environment.
 * Must be exactly 32 bytes for AES-256.
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required')
  }

  // If key is hex-encoded (64 chars = 32 bytes)
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex')
  }

  // If key is base64-encoded
  if (key.length === 44 && key.endsWith('=')) {
    return Buffer.from(key, 'base64')
  }

  // Use key directly (must be 32 chars)
  if (key.length === 32) {
    return Buffer.from(key, 'utf8')
  }

  // Hash the key to get consistent 32 bytes
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(key)
  return Buffer.from(hasher.digest())
}

/**
 * Encrypt a string value.
 * Returns format: iv:authTag:encryptedData (all base64 encoded)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const authTag = cipher.getAuthTag()

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
}

/**
 * Decrypt an encrypted string.
 * Expects format: iv:authTag:encryptedData (all base64 encoded)
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey()
  const [ivBase64, authTagBase64, encryptedData] = ciphertext.split(':')

  if (!ivBase64 || !authTagBase64 || !encryptedData) {
    throw new Error('Invalid encrypted data format')
  }

  const iv = Buffer.from(ivBase64, 'base64')
  const authTag = Buffer.from(authTagBase64, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedData, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Generate a random encryption key (for initial setup).
 * Returns a 64-character hex string.
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex')
}
