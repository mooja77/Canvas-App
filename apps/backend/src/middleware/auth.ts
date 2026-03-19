import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from './errorHandler.js';
import { sha256, verifyAccessCode } from '../utils/hashing.js';
import { verifyToken, isUserPayload, isLegacyPayload } from '../utils/jwt.js';

export async function auth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Try Bearer token first (email auth sends this way)
  const authHeader = req.headers['authorization'] as string | undefined;
  const dashboardCode = req.headers['x-dashboard-code'] as string;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : dashboardCode;

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
        req.userId = user.id;
        req.userPlan = user.plan;
        res.setHeader('X-User-Plan', user.plan);
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
