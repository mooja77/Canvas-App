import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required. Set it before starting the server.');
}

const JWT_SECRET: string = process.env.JWT_SECRET;
const JWT_EXPIRY = '24h';

// Legacy JWT payload (access-code auth)
interface LegacyJwtPayload {
  accountId: string;
  role: string;
  iat?: number; // issued-at (seconds since epoch); added by jsonwebtoken
  iatMs?: number; // issued-at in milliseconds; see tokenIssuedAtMs
  exp?: number;
}

// New JWT payload (email auth)
interface UserJwtPayload {
  userId: string;
  role: string;
  plan: string;
  iat?: number;
  iatMs?: number;
  exp?: number;
}

export type JwtPayload = LegacyJwtPayload | UserJwtPayload;

/**
 * When a token was issued, in milliseconds, for comparison with
 * User.sessionsInvalidAt. `iat` alone has one-second resolution, so a session
 * revoked and a new one issued in the same second (a Google sign-in that claims
 * an unverified account does exactly that) could not be told apart: either the
 * new session died or an old one issued in that second survived. Tokens carry
 * `iatMs` from now on; older tokens fall back to `iat`.
 */
export function tokenIssuedAtMs(payload: { iat?: number; iatMs?: number }): number | null {
  if (typeof payload.iatMs === 'number' && Number.isFinite(payload.iatMs)) return payload.iatMs;
  return typeof payload.iat === 'number' ? payload.iat * 1000 : null;
}

/**
 * Sign a JWT for a legacy access-code user.
 */
export function signResearcherToken(accountId: string, role: string): string {
  return jwt.sign({ accountId, role, iatMs: Date.now() } satisfies LegacyJwtPayload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

/**
 * Sign a JWT for an email-authenticated user.
 */
export function signUserToken(userId: string, role: string, plan: string): string {
  return jwt.sign({ userId, role, plan, iatMs: Date.now() } satisfies UserJwtPayload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

/**
 * Verify a researcher JWT. Returns payload or null if invalid/expired.
 */
export function verifyResearcherToken(token: string): LegacyJwtPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as LegacyJwtPayload;
    if (payload.accountId && payload.role) {
      return payload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Verify any JWT token. Returns the raw decoded payload or null.
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
  } catch {
    return null;
  }
}

/** Type guard: is this a user (email auth) JWT? */
export function isUserPayload(payload: JwtPayload): payload is UserJwtPayload {
  return 'userId' in payload;
}

/** Type guard: is this a legacy (access-code auth) JWT? */
export function isLegacyPayload(payload: JwtPayload): payload is LegacyJwtPayload {
  return 'accountId' in payload && !('userId' in payload);
}
