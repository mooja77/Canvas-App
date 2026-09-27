import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from './errorHandler.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Path segments after /canvas/ that are NOT canvas ids (public/clone flows).
const NON_ID_SEGMENTS = new Set(['clone', 'shared', 'trash']);

function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * Enforce read-only access for collaborators invited with role 'viewer'.
 *
 * getOwnedCanvas grants collaborators access to canvas routes but has no
 * notion of HTTP method, so write enforcement lives here as a single
 * chokepoint instead of threading a read/write flag through ~100 call
 * sites. Mounted after `auth` on every canvas-scoped router.
 *
 * Cost: one indexed point lookup (canvasId+userId unique) per write request,
 * and only for email-auth users on /canvas/:id paths — owners are never
 * their own collaborators (the invite route rejects self-adds), so a
 * missing row means "owner or stranger" and the route's own access check
 * decides.
 */
export async function viewerWriteGuard(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!WRITE_METHODS.has(req.method)) return next();
    const userId = req.userId;
    if (!userId) return next(); // legacy access-code users can't be collaborators

    // Match the path the way Express routes it: case-insensitively, with the
    // id percent-decoded as Express decodes req.params. Matching the raw path
    // exactly let a viewer write through `/CANVAS/<id>/...` or
    // `/canvas/%63<rest-of-id>/...`, which the guard skipped but the canvas
    // routers still served.
    const match = req.path.match(/^\/canvas\/([^/]+)(\/|$)/i);
    if (!match) return next();
    const canvasId = decodeSegment(match[1]);
    if (canvasId === null) return next(new AppError('Malformed request path', 400));
    if (NON_ID_SEGMENTS.has(canvasId.toLowerCase())) return next();
    // A training attempt writes only the current user's answer record; it
    // does not mutate the shared canvas. Viewers are valid trainees.
    if (/^\/canvas\/[^/]+\/training\/[^/]+\/attempt\/?$/i.test(req.path)) {
      return next();
    }

    const collaborator = await prisma.canvasCollaborator.findUnique({
      where: { canvasId_userId: { canvasId, userId } },
      select: { role: true },
    });
    if (collaborator?.role === 'viewer') {
      return next(new AppError('You have view-only access to this canvas. Ask the owner for coder access.', 403));
    }
    return next();
  } catch (err) {
    return next(err);
  }
}
