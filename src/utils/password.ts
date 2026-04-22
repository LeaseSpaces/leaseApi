/* eslint-disable */

import crypto from "crypto";

const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;
const FORMAT = "scrypt"; // prefix so we can change algo later

/**
 * Hash a password for storage. Returns a string "scrypt:base64salt:base64hash".
 * Use when creating an admin user (backend/seed only).
 */
export function hashPassword(plainPassword: string): string {
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = crypto.scryptSync(plainPassword, salt, SCRYPT_KEYLEN);
  return `${FORMAT}:${salt.toString("base64")}:${hash.toString("base64")}`;
}

/**
 * Verify a plain password against a stored hash string from User.password.
 */
export function verifyPassword(plainPassword: string, stored: string): boolean {
  if (!stored || !stored.startsWith(`${FORMAT}:`)) return false;
  const parts = stored.split(":");
  if (parts.length !== 3) return false;
  const salt = Buffer.from(parts[1], "base64");
  const expectedHash = Buffer.from(parts[2], "base64");
  const hash = crypto.scryptSync(plainPassword, salt, SCRYPT_KEYLEN);
  return crypto.timingSafeEqual(hash, expectedHash);
}
