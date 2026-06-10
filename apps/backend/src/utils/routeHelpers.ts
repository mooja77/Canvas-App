import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

/** Safely parse a JSON string from the database, returning a fallback on failure. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeJsonParse(raw: string, fallback: any = {}): any {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Extract the authenticated dashboard access ID from the request, or throw 401. */
export function getAuthId(req: Request): string {
  const id = req.dashboardAccessId;
  if (!id) throw new AppError('Authentication required', 401);
  return id;
}

/** Get the authenticated user ID (email auth), or null for legacy users. */
export function getAuthUserId(req: Request): string | null {
  return req.userId || null;
}

/**
 * Verify a canvas exists and the authenticated user may work on it, or throw 404/403.
 *
 * Access is granted to the owner (via userId for email auth, or dashboardAccessId
 * for legacy) and — unless `requireOwner` is set — to invited collaborators
 * (CanvasCollaborator rows, email-auth users only). Admin operations (delete,
 * restore, share-code management, collaborator management) must pass
 * `requireOwner: true` so collaborators can code together without being able to
 * destroy or re-share someone else's project.
 *
 * By default rejects soft-deleted canvases so mutation / analysis endpoints can't
 * operate on trashed content. Trash management routes (restore, permanent delete)
 * opt in to `allowDeleted: true`.
 */
export async function getOwnedCanvas(
  canvasId: string,
  dashboardAccessId: string,
  userId?: string | null,
  options?: { allowDeleted?: boolean; requireOwner?: boolean },
) {
  const canvas = await prisma.codingCanvas.findUnique({ where: { id: canvasId } });
  if (!canvas) throw new AppError('Canvas not found', 404);

  // Check ownership: either via userId (email auth) or dashboardAccessId (legacy)
  const ownsViaUser = userId && canvas.userId === userId;
  const ownsViaDashboard = canvas.dashboardAccessId === dashboardAccessId;
  let allowed = Boolean(ownsViaUser || ownsViaDashboard);

  if (!allowed && userId) {
    const collaborator = await prisma.canvasCollaborator.findUnique({
      where: { canvasId_userId: { canvasId, userId } },
      select: { id: true },
    });
    if (collaborator) {
      if (options?.requireOwner) {
        throw new AppError('Only the canvas owner can do this', 403);
      }
      allowed = true;
    }
  }

  if (!allowed) throw new AppError('Access denied', 403);

  // Don't leak data from trashed canvases to normal operations. Return 404 —
  // treating a soft-deleted canvas as "not found" is consistent with the
  // list endpoints (which also exclude deleted).
  if (canvas.deletedAt && !options?.allowDeleted) {
    throw new AppError('Canvas not found', 404);
  }
  return canvas;
}

/** Middleware factory that verifies the authenticated user owns the canvas in req.params.id. */
export function ensureOwnsCanvas() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const canvasId = req.params.id;
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      const canvas = await getOwnedCanvas(canvasId, dashboardAccessId, userId);
      req.canvas = canvas;
      next();
    } catch (err) {
      next(err);
    }
  };
}
