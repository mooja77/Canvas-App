import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { sha256, verifyAccessCode, hashAccessCode } from '../utils/hashing.js';
import { signResearcherToken } from '../utils/jwt.js';
import { logAudit } from '../middleware/auditLog.js';
import { authLimiter } from '../middleware/authLimiter.js';
import { nanoid } from 'nanoid';

export const authRoutes = Router();

// POST /api/auth — authenticate with a dashboard code, returns JWT
authRoutes.post('/auth', authLimiter, async (req, res, next) => {
  try {
    const { dashboardCode } = req.body;
    const rawIp = req.ip || req.socket.remoteAddress || 'unknown';
    const hashedIp = sha256(rawIp);

    if (!dashboardCode || typeof dashboardCode !== 'string') {
      return res.status(400).json({ success: false, error: 'Dashboard code is required' });
    }

    // Try SHA-256 hashed lookup
    const sha256Index = sha256(dashboardCode);
    let access = await prisma.dashboardAccess.findUnique({
      where: { accessCode: sha256Index },
    });

    if (!access) {
      logAudit({
        action: 'auth.failed',
        resource: 'auth',
        actorType: 'anonymous',
        ip: hashedIp,
        method: 'POST',
        path: '/api/auth',
        meta: JSON.stringify({ reason: 'unknown_code' }),
      });
      return res.status(401).json({ success: false, error: 'Invalid dashboard code' });
    }

    if (!access.accessCodeHash) {
      logAudit({
        action: 'auth.failed',
        resource: 'auth',
        actorType: 'anonymous',
        actorId: access.id,
        ip: hashedIp,
        method: 'POST',
        path: '/api/auth',
        meta: JSON.stringify({ reason: 'migration_required' }),
      });
      return res.status(401).json({ success: false, error: 'Account requires migration — please contact support' });
    }

    const valid = await verifyAccessCode(dashboardCode, access.accessCodeHash);
    if (!valid) {
      logAudit({
        action: 'auth.failed',
        resource: 'auth',
        actorType: 'anonymous',
        actorId: access.id,
        ip: hashedIp,
        method: 'POST',
        path: '/api/auth',
        meta: JSON.stringify({ reason: 'invalid_credentials' }),
      });
      return res.status(401).json({ success: false, error: 'Invalid dashboard code' });
    }

    if (new Date() > access.expiresAt) {
      logAudit({
        action: 'auth.failed',
        resource: 'auth',
        actorType: 'anonymous',
        actorId: access.id,
        ip: hashedIp,
        method: 'POST',
        path: '/api/auth',
        meta: JSON.stringify({ reason: 'expired' }),
      });
      return res.status(401).json({ success: false, error: 'Dashboard code has expired' });
    }

    const jwt = signResearcherToken(access.id, access.role);

    logAudit({
      action: 'auth.success',
      resource: 'auth',
      actorType: 'researcher',
      actorId: access.id,
      ip: hashedIp,
      method: 'POST',
      path: '/api/auth',
    });

    res.json({
      success: true,
      data: {
        jwt,
        name: access.name,
        role: access.role,
        dashboardAccessId: access.id,
      },
    });
  } catch (err) { next(err); }
});

// POST /api/auth/register — create a new dashboard access (for standalone use)
authRoutes.post('/auth/register', authLimiter, async (req, res, next) => {
  try {
    const { name, role } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const code = `CANVAS-${nanoid(8).toUpperCase().replace(/[^A-Z0-9]/g, 'X')}`;
    const { sha256Index, bcryptHash } = await hashAccessCode(code);

    const access = await prisma.dashboardAccess.create({
      data: {
        accessCode: sha256Index,
        accessCodeHash: bcryptHash,
        name,
        role: role || 'researcher',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
    });

    const jwt = signResearcherToken(access.id, access.role);

    res.status(201).json({
      success: true,
      data: {
        accessCode: code,
        jwt,
        name: access.name,
        role: access.role,
        dashboardAccessId: access.id,
      },
    });
  } catch (err) { next(err); }
});
