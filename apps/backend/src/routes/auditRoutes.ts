import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthId, getAuthUserId, getOwnedCanvas } from '../utils/routeHelpers.js';
import { validateParams, canvasIdParam } from '../middleware/validation.js';

/**
 * Sprint E — user-facing audit-trail endpoint.
 *
 * Returns the most-recent audit events for a canvas the requester owns.
 * Scoped by ownership: a user can only see events whose `resourceId` is
 * their canvas. Path-based events (transcript reads, coding writes) all
 * record their parent canvas id in `resourceId` so this single lookup
 * covers the full per-canvas audit trail.
 *
 * Surface this from the Quality panel ("View audit trail for this
 * canvas") — institutional buyers will use it during procurement
 * reviews; healthcare-adjacent users will use it to satisfy IRB
 * requirements.
 */
export const auditRoutes = Router();

auditRoutes.get(
  '/canvas/:id/audit',
  validateParams(canvasIdParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      // Ownership check — refuses 403 if the requester doesn't own the canvas.
      await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      const rawLimit = parseInt(req.query.limit as string, 10);
      const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 100, 1), 500);

      const events = await prisma.auditLog.findMany({
        where: { resourceId: req.params.id },
        orderBy: { timestamp: 'desc' },
        take: limit,
        select: {
          id: true,
          timestamp: true,
          action: true,
          resource: true,
          actorType: true,
          method: true,
          path: true,
          statusCode: true,
          meta: true,
        },
      });

      res.json({ success: true, data: events });
    } catch (err) {
      next(err);
    }
  },
);
