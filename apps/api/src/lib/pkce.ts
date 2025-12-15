import { createHash, randomBytes } from "crypto";

/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth security.
 * Required by OWASP for all OAuth flows.
 */

/**
 * Generate a PKCE code verifier.
 * RFC 7636 requires 43-128 characters from [A-Z], [a-z], [0-9], "-", ".", "_", "~"
 * We use base64url encoding of 32 random bytes (43 characters).
 */
export function generateCodeVerifier(): string {
  // 32 bytes = 256 bits of entropy, base64url encoded = 43 characters
  return randomBytes(32).toString("base64url");
}

/**
 * Generate a PKCE code challenge from a code verifier.
 * Uses S256 method (SHA-256 hash, base64url encoded).
 *
 * @param verifier - The code verifier string
 * @returns base64url encoded SHA-256 hash
 */
export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Generate a PKCE pair (verifier and challenge).
 * Use this when initiating the OAuth flow.
 *
 * @returns Object with verifier (to store) and challenge (to send to OAuth provider)
 */
export function generatePKCEPair(): { verifier: string; challenge: string } {
  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);
  return { verifier, challenge };
}

/**
 * Verify that a code verifier matches a code challenge.
 * Used by OAuth server to validate the token exchange request.
 *
 * @param verifier - The code verifier from token exchange request
 * @param challenge - The code challenge from authorization request
 * @returns true if verifier produces the challenge
 */
export function verifyPKCE(verifier: string, challenge: string): boolean {
  const computedChallenge = generateCodeChallenge(verifier);
  return computedChallenge === challenge;
}

/**
 * PKCE challenge method.
 * Only S256 is supported (plain method is insecure and deprecated).
 */
export const PKCE_CHALLENGE_METHOD = "S256";
