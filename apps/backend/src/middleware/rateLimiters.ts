import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';

// Skip rate limiting in test/E2E environments
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.E2E_TEST === 'true';

type KeyFn = (req: Request) => string;

const byUserOrIp: KeyFn = (req) => {
  // Prefer authenticated user id so a single user can't circumvent the limit
  // by changing IP. Fall back to IP for unauthenticated endpoints.
  return req.userId || req.dashboardAccessId || req.ip || req.socket.remoteAddress || 'unknown';
};

function build(max: number, windowMs: number, errorMessage: string, keyGenerator: KeyFn = byUserOrIp) {
  const limiter = rateLimit({
    windowMs,
    max,
    keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ success: false, error: errorMessage });
    },
  });
  return isTestEnv ? (_req: Request, _res: Response, next: NextFunction) => next() : limiter;
}

// Mutation-heavy routes a user might legitimately hit a lot but not thousands of
// times — calendar events, notifications, ethics records, etc.
export const mutationLimiter = build(60, 5 * 60 * 1000, 'Too many requests — slow down and try again shortly.');

// Sensitive validation endpoints that make external calls (AI provider test).
// Tight limit to block brute-force of LLM keys via the validation endpoint.
export const sensitiveValidationLimiter = build(
  5,
  15 * 60 * 1000,
  'Too many validation attempts. Try again in 15 minutes.',
);
