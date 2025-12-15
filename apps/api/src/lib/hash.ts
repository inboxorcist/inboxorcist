import { createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * SHA-256 hashing utilities for tokens and fingerprints.
 */

/**
 * Create a SHA-256 hash of a string.
 * Returns hex-encoded hash.
 */
export function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Create a SHA-256 hash of a string.
 * Returns base64url-encoded hash (shorter than hex).
 */
export function sha256Base64(data: string): string {
  return createHash("sha256").update(data).digest("base64url");
}

/**
 * Generate a cryptographically secure random string.
 * Used for session IDs, fingerprints, PKCE verifiers, etc.
 *
 * @param bytes - Number of random bytes (default: 32 = 256 bits)
 * @param encoding - Output encoding (default: hex)
 */
export function generateRandomString(bytes = 32, encoding: "hex" | "base64" | "base64url" = "hex"): string {
  return randomBytes(bytes).toString(encoding);
}

/**
 * Generate a fingerprint for token sidejacking protection.
 * Returns an object with the raw value (for cookie) and hash (for JWT).
 */
export function generateFingerprint(): { raw: string; hash: string } {
  const raw = generateRandomString(32, "hex");
  const hash = sha256(raw);
  return { raw, hash };
}

/**
 * Verify a fingerprint against its hash.
 * Uses timing-safe comparison.
 */
export function verifyFingerprint(raw: string, expectedHash: string): boolean {
  const actualHash = sha256(raw);

  // Convert to buffers for timing-safe comparison
  const actualBuffer = Buffer.from(actualHash, "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  // Buffers must be same length for timingSafeEqual
  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

/**
 * Hash a refresh token for secure storage.
 * Never store raw refresh tokens in the database.
 */
export function hashRefreshToken(token: string): string {
  return sha256(token);
}

/**
 * Verify a refresh token against its stored hash.
 */
export function verifyRefreshToken(token: string, storedHash: string): boolean {
  const hash = hashRefreshToken(token);

  const actualBuffer = Buffer.from(hash, "hex");
  const expectedBuffer = Buffer.from(storedHash, "hex");

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

/**
 * Hash sensitive data for logging (e.g., email addresses, session IDs).
 * Uses a shorter hash for readability in logs.
 */
export function hashForLog(data: string): string {
  return sha256(data).substring(0, 16);
}
