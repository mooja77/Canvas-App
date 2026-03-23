import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';

// Skip rate limiting in test/E2E environments
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.E2E_TEST === 'true';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many login attempts. Please try again in 15 minutes.',
    });
  },
});

export const authLimiter = isTestEnv
  ? (_req: Request, _res: Response, next: NextFunction) => next()
  : limiter;
