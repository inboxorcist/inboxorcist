import { customAlphabet } from "nanoid";

// Alphanumeric only (a-z, A-Z, 0-9)
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// 21 characters provides ~124 bits of entropy
export const nanoid = customAlphabet(alphabet, 21);

/**
 * Default user ID for self-hosted installations.
 * In cloud version, this will be replaced with actual user IDs.
 */
export const LOCAL_USER_ID = "local";

/**
 * Get the current user ID.
 * For self-hosted, always returns LOCAL_USER_ID.
 * Cloud version will override this with actual user authentication.
 */
export function getCurrentUserId(): string {
  // TODO: In cloud version, get from auth context
  return LOCAL_USER_ID;
}
