import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required. Set it before starting the server.');
}

const JWT_SECRET: string = process.env.JWT_SECRET;
const JWT_EXPIRY = '24h';

interface JwtPayload {
  accountId: string;
  role: string;
}

/**
 * Sign a JWT for a researcher.
 */
export function signResearcherToken(accountId: string, role: string): string {
  return jwt.sign({ accountId, role } satisfies JwtPayload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

/**
 * Verify a researcher JWT. Returns payload or null if invalid/expired.
 */
export function verifyResearcherToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (payload.accountId && payload.role) {
      return payload;
    }
    return null;
  } catch {
    return null;
  }
}
