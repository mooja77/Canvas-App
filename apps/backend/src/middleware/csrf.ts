import type { Request, Response, NextFunction } from 'express';
import { getAllowedOrigins, isAllowedOrigin } from '../utils/origins.js';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF protection middleware via Origin header validation.
 * In production, mutating requests must include a valid Origin header
 * or a same-origin Sec-Fetch-Site / Referer header.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (!MUTATION_METHODS.has(req.method)) {
    return next();
  }

  const origin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins();

  // In development (no allowed origins configured), allow all requests
  if (allowedOrigins.length === 0) {
    return next();
  }

  // If Origin header is present, validate it against allowed origins
  if (origin) {
    if (isAllowedOrigin(origin)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      error: 'CSRF validation failed: origin not allowed',
    });
  }

  // No Origin header — check Sec-Fetch-Site for same-origin requests
  const secFetchSite = req.headers['sec-fetch-site'] as string | undefined;
  if (secFetchSite === 'same-origin' || secFetchSite === 'same-site') {
    return next();
  }

  // Fall back to Referer header check
  const referer = req.headers.referer || req.headers.referrer;
  if (referer && typeof referer === 'string') {
    try {
      const refererOrigin = new URL(referer).origin;
      if (isAllowedOrigin(refererOrigin)) {
        return next();
      }
    } catch {
      // Invalid referer URL — fall through to reject
    }
  }

  // No valid origin verification — reject the request
  return res.status(403).json({
    success: false,
    error: 'CSRF validation failed: unable to verify request origin',
  });
}
