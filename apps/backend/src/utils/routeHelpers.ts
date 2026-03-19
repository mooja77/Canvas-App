import type { Request } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

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

/** Verify a canvas exists and belongs to the authenticated user, or throw 404/403. */
export async function getOwnedCanvas(canvasId: string, dashboardAccessId: string, userId?: string | null) {
  const canvas = await prisma.codingCanvas.findUnique({ where: { id: canvasId } });
  if (!canvas) throw new AppError('Canvas not found', 404);

  // Check ownership: either via userId (email auth) or dashboardAccessId (legacy)
  const ownsViaUser = userId && canvas.userId === userId;
  const ownsViaDashboard = canvas.dashboardAccessId === dashboardAccessId;

  if (!ownsViaUser && !ownsViaDashboard) throw new AppError('Access denied', 403);
  return canvas;
}
