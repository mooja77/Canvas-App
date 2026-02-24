import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from './errorHandler.js';
import { sha256, verifyAccessCode } from '../utils/hashing.js';
import { verifyResearcherToken } from '../utils/jwt.js';

export async function auth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const dashboardCode = req.headers['x-dashboard-code'] as string;

  if (!dashboardCode) {
    return next(new AppError('Dashboard access code is required', 401));
  }

  // Try JWT verification first
  const jwtPayload = verifyResearcherToken(dashboardCode);
  if (jwtPayload) {
    const access = await prisma.dashboardAccess.findFirst({
      where: { id: jwtPayload.accountId },
    });
    if (access) {
      req.dashboardAccessId = access.id;
      req.dashboardAccess = access;
      return next();
    }
  }

  // Try SHA-256 hashed lookup
  const sha256Index = sha256(dashboardCode);
  let access = await prisma.dashboardAccess.findUnique({
    where: { accessCode: sha256Index },
  });

  if (!access) {
    return next(new AppError('Invalid dashboard access code', 401));
  }

  if (!access.accessCodeHash) {
    return next(new AppError('Account requires migration — please contact support', 401));
  }

  const valid = await verifyAccessCode(dashboardCode, access.accessCodeHash);
  if (!valid) {
    return next(new AppError('Invalid dashboard access code', 401));
  }

  if (new Date() > access.expiresAt) {
    return next(new AppError('Dashboard access code has expired', 401));
  }

  req.dashboardAccessId = access.id;
  req.dashboardAccess = access;
  next();
}
