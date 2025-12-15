import { customAlphabet } from "nanoid";

// Alphanumeric only (a-z, A-Z, 0-9)
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// 21 characters provides ~124 bits of entropy
export const nanoid = customAlphabet(alphabet, 21);
