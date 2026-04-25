import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from './errorHandler.js';
import { sha256, verifyAccessCode } from '../utils/hashing.js';
import { verifyToken, isUserPayload, isLegacyPayload } from '../utils/jwt.js';

export async function auth(req: Request, res: Response, next: NextFunction) {
  // Auth sources, in priority order:
  //   1. `jwt` httpOnly cookie — set by login endpoints, used by the web app
  //      and WebSocket handshake. XSS can't read httpOnly cookies, which is
  //      why we migrated the frontend away from localStorage JWTs.
  //   2. Authorization: Bearer header / x-dashboard-code — retained for
  //      server-to-server clients, integration tests, and CLI tools. The
  //      frontend no longer sends these (see apps/frontend/src/services/api.ts).
  const cookieJwt = (req as Request & { cookies?: Record<string, string> }).cookies?.jwt;
  const authHeader = req.headers['authorization'] as string | undefined;
  const dashboardCode = req.headers['x-dashboard-code'] as string;
  const token = cookieJwt || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : dashboardCode);

  if (!token) {
    return next(new AppError('Authentication required', 401));
  }

  // Try JWT verification
  const jwtPayload = verifyToken(token);
  if (jwtPayload) {
    // Email-authenticated user
    if (isUserPayload(jwtPayload)) {
      const user = await prisma.user.findUnique({
        where: { id: jwtPayload.userId },
        include: { dashboardAccess: true },
      });
      if (user) {
        // Session invalidation: if the user rotated credentials after this
        // JWT was issued, reject the token so stolen/shared tokens can't
        // outlive a password reset or email change.
        if (user.sessionsInvalidAt && jwtPayload.iat) {
          const jwtIssuedMs = jwtPayload.iat * 1000;
          if (jwtIssuedMs < user.sessionsInvalidAt.getTime()) {
            return next(new AppError('Session has been invalidated. Please log in again.', 401));
          }
        }

        // Trial overlay: free-tier users with an active trialEndsAt are
        // treated as 'pro' for plan-limit purposes. We don't mutate
        // user.plan in the DB during the trial — that stays 'free' until
        // the user actually pays, so a stale trialEndsAt can't accidentally
        // promote someone after they've cancelled. Paid users (plan='pro'
        // or 'team') ignore this overlay entirely.
        const trialActive =
          user.plan === 'free' && user.trialEndsAt instanceof Date && user.trialEndsAt.getTime() > Date.now();
        const effectivePlan = trialActive ? 'pro' : user.plan;

        req.userId = user.id;
        req.userPlan = effectivePlan;
        res.setHeader('X-User-Plan', effectivePlan);
        req.userRole = user.role;

        if (user.dashboardAccess) {
          req.dashboardAccessId = user.dashboardAccess.id;
          req.dashboardAccess = user.dashboardAccess;
        }
        res.setHeader('X-Session-Timeout', '1800');
        return next();
      }
    }

    // Legacy access-code user
    if (isLegacyPayload(jwtPayload)) {
      const access = await prisma.dashboardAccess.findFirst({
        where: { id: jwtPayload.accountId },
      });
      if (access) {
        req.dashboardAccessId = access.id;
        req.dashboardAccess = access;
        // Legacy users are grandfathered to pro
        req.userPlan = 'pro';
        res.setHeader('X-Session-Timeout', '1800');
        return next();
      }
    }
  }

  // Fallback: try raw access code (SHA-256 + bcrypt)
  const sha256Index = sha256(token);
  const access = await prisma.dashboardAccess.findUnique({
    where: { accessCode: sha256Index },
  });

  if (!access) {
    return next(new AppError('Invalid credentials', 401));
  }

  if (!access.accessCodeHash) {
    return next(new AppError('Account requires migration — please contact support', 401));
  }

  const valid = await verifyAccessCode(token, access.accessCodeHash);
  if (!valid) {
    return next(new AppError('Invalid credentials', 401));
  }

  if (new Date() > access.expiresAt) {
    return next(new AppError('Access code has expired', 401));
  }

  req.dashboardAccessId = access.id;
  req.dashboardAccess = access;
  req.userPlan = 'pro'; // Legacy users grandfathered

  res.setHeader('X-Session-Timeout', '1800');
  next();
}
