import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

// Skip rate limiting in test/E2E environments
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.E2E_TEST === 'true';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  // Scope attempts to both the endpoint and the supplied account identifier.
  // A university or company NAT can therefore serve many legitimate users
  // without one person's failed login locking everybody else out. Hashing
  // keeps emails/access codes out of the rate-limit store.
  keyGenerator: (req) => {
    const identifier =
      typeof req.body?.email === 'string'
        ? req.body.email.toLowerCase().trim()
        : typeof req.body?.dashboardCode === 'string'
          ? req.body.dashboardCode.trim()
          : 'anonymous';
    const accountHash = createHash('sha256').update(identifier).digest('hex').slice(0, 24);
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return `${req.path}:${accountHash}:${ip}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many login attempts. Please try again in 15 minutes.',
    });
  },
});

export const authLimiter = isTestEnv ? (_req: Request, _res: Response, next: NextFunction) => next() : limiter;
