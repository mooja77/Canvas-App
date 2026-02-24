import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

/**
 * SHA-256 hash for O(1) database lookups.
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Hash an access code for storage.
 * Returns both an SHA-256 index (for lookup) and a bcrypt hash (for verification).
 */
export async function hashAccessCode(plaintext: string): Promise<{ sha256Index: string; bcryptHash: string }> {
  const sha256Index = sha256(plaintext);
  const bcryptHash = await bcrypt.hash(plaintext, BCRYPT_ROUNDS);
  return { sha256Index, bcryptHash };
}

/**
 * Verify a plaintext access code against a bcrypt hash.
 */
export async function verifyAccessCode(plaintext: string, bcryptHash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, bcryptHash);
}
