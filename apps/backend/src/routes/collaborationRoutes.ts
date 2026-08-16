import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { getAuthId, getAuthUserId, getOwnedCanvas } from '../utils/routeHelpers.js';
import { getPlanLimits } from '../config/plans.js';
import { validateParams, canvasIdParam, canvasIdUserIdParams } from '../middleware/validation.js';
import { revokeCanvasAccess } from '../lib/socket.js';

export const collaborationRoutes = Router();

// ─── POST /api/canvas/:id/collaborators — Invite a collaborator ───
// Accepts either an email (the Share-modal invite flow — researchers know
// their colleague's email, not their internal user id) or a raw userId.
collaborationRoutes.post('/canvas/:id/collaborators', validateParams(canvasIdParam), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const userId = getAuthUserId(req);
    const canvas = await getOwnedCanvas(req.params.id, dashboardAccessId, userId, { requireOwner: true });

    const { userId: bodyUserId, email, role } = req.body;
    let targetUserId: string | undefined = typeof bodyUserId === 'string' ? bodyUserId : undefined;
    if (!targetUserId && typeof email === 'string' && email.trim()) {
      const byEmail = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: { id: true },
      });
      if (!byEmail) {
        throw new AppError(
          'No QualCanvas account found with that email. Ask your colleague to sign up first, then invite them.',
          404,
        );
      }
      targetUserId = byEmail.id;
    }
    if (!targetUserId) {
      throw new AppError('email or userId is required', 400);
    }

    const validRoles = ['editor', 'viewer'];
    const assignedRole = validRoles.includes(role) ? role : 'editor';

    // Check plan limits
    const plan = req.userPlan || 'free';
    const limits = getPlanLimits(plan);
    const currentCount = await prisma.canvasCollaborator.count({
      where: { canvasId: canvas.id },
    });
    if (currentCount >= limits.maxCollaborators) {
      return res.status(403).json({
        success: false,
        error: `Your ${plan} plan allows up to ${limits.maxCollaborators} collaborators per canvas`,
        code: 'PLAN_LIMIT_EXCEEDED',
        limit: 'maxCollaborators',
        current: currentCount,
        max: limits.maxCollaborators,
        upgrade: true,
      });
    }

    // Verify the target user exists
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      throw new AppError('User not found', 404);
    }

    // Cannot add yourself
    if (userId && targetUserId === userId) {
      throw new AppError('Cannot add yourself as a collaborator', 400);
    }

    // Upsert collaborator (update role if already exists)
    const collaborator = await prisma.canvasCollaborator.upsert({
      where: {
        canvasId_userId: { canvasId: canvas.id, userId: targetUserId },
      },
      update: { role: assignedRole },
      create: {
        canvasId: canvas.id,
        userId: targetUserId,
        role: assignedRole,
        invitedBy: userId || dashboardAccessId,
      },
    });
    // If this was a role change, force any existing socket to rejoin with the
    // new authorization state before it can publish another mutation.
    await revokeCanvasAccess(canvas.id, targetUserId);

    res.status(201).json({ success: true, data: collaborator });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/canvas/:id/collaborators — List collaborators ───
collaborationRoutes.get('/canvas/:id/collaborators', validateParams(canvasIdParam), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const userId = getAuthUserId(req);
    const canvas = await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

    const collaborators = await prisma.canvasCollaborator.findMany({
      where: { canvasId: canvas.id },
      orderBy: { createdAt: 'asc' },
    });

    // Enrich with user names
    const userIds = collaborators.map((c) => c.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map<string, { id: string; name: string; email: string }>(users.map((u) => [u.id, u]));

    const enriched = collaborators.map((c) => ({
      ...c,
      userName: userMap.get(c.userId)?.name || 'Unknown',
      userEmail: userMap.get(c.userId)?.email || '',
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/canvas/:id/collaborators/:userId — Remove collaborator ───
collaborationRoutes.delete(
  '/canvas/:id/collaborators/:userId',
  validateParams(canvasIdUserIdParams),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      const canvas = await getOwnedCanvas(req.params.id, dashboardAccessId, userId, { requireOwner: true });

      const targetUserId = req.params.userId;

      const existing = await prisma.canvasCollaborator.findUnique({
        where: {
          canvasId_userId: { canvasId: canvas.id, userId: targetUserId },
        },
      });

      if (!existing) {
        throw new AppError('Collaborator not found', 404);
      }

      await prisma.canvasCollaborator.delete({
        where: { id: existing.id },
      });
      await revokeCanvasAccess(canvas.id, targetUserId);

      res.json({ success: true, message: 'Collaborator removed' });
    } catch (err) {
      next(err);
    }
  },
);
