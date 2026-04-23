import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  validate,
  validateParams,
  createCanvasSchema,
  updateCanvasSchema,
  saveLayoutSchema,
  canvasCanvasIdParam,
  canvasIdParam,
} from '../middleware/validation.js';
import { getAuthId, getAuthUserId, getOwnedCanvas, safeJsonParse } from '../utils/routeHelpers.js';
import { checkCanvasLimit } from '../middleware/planLimits.js';
import { getPlanLimits } from '../config/plans.js';

// Sub-routers
import { transcriptRoutes } from './transcriptRoutes.js';
import { codingRoutes } from './codingRoutes.js';
import { computedRoutes } from './computedRoutes.js';
import { shareRoutes } from './shareRoutes.js';

export const canvasRoutes = Router();

// Re-export canvasPublicRoutes for backward compatibility with index.ts
export { canvasPublicRoutes } from './shareRoutes.js';

// Mount sub-routers
canvasRoutes.use(transcriptRoutes);
canvasRoutes.use(codingRoutes);
canvasRoutes.use(computedRoutes);
canvasRoutes.use(shareRoutes);

// ─── Canvas CRUD ───

// GET /canvas — list canvases (excludes soft-deleted)
canvasRoutes.get('/canvas', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const userId = getAuthUserId(req);
    // Clamp pagination to sane ranges. parseInt can return NaN or negative
    // numbers from untrusted query params — passing those to Prisma yields
    // either an error or an empty page silently.
    const rawLimit = parseInt(req.query.limit as string, 10);
    const take = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 200);
    const rawOffset = parseInt(req.query.offset as string, 10);
    const skip = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

    // Show canvases owned via dashboardAccess OR userId, excluding soft-deleted
    const ownerFilter = userId ? { OR: [{ dashboardAccessId }, { userId }] } : { dashboardAccessId };
    const where = { ...ownerFilter, deletedAt: null };

    const [canvases, total] = await Promise.all([
      prisma.codingCanvas.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: { select: { transcripts: true, questions: true, codings: true } },
        },
        take,
        skip,
      }),
      prisma.codingCanvas.count({ where }),
    ]);
    res.json({ success: true, data: canvases, total, limit: take, offset: skip });
  } catch (err) {
    next(err);
  }
});

// GET /canvas/trash — list soft-deleted canvases
canvasRoutes.get('/canvas/trash', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const userId = getAuthUserId(req);

    const ownerFilter = userId ? { OR: [{ dashboardAccessId }, { userId }] } : { dashboardAccessId };
    const where = { ...ownerFilter, deletedAt: { not: null } };

    const canvases = await prisma.codingCanvas.findMany({
      where,
      orderBy: { deletedAt: 'desc' },
      include: {
        _count: { select: { transcripts: true, questions: true, codings: true } },
      },
    });
    res.json({ success: true, data: canvases });
  } catch (err) {
    next(err);
  }
});

// POST /canvas — create canvas
canvasRoutes.post('/canvas', validate(createCanvasSchema), checkCanvasLimit(), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const userId = getAuthUserId(req);
    const { name, description } = req.body;

    const canvas = await prisma.codingCanvas.create({
      data: {
        dashboardAccessId,
        name,
        description,
        ...(userId ? { userId } : {}),
      },
    });

    // Post-create guard against the plan-limit race: two parallel requests
    // can both pass checkCanvasLimit() (count was N below limit for both)
    // and then both create, overshooting the cap. Recount and hard-delete
    // anything that pushed us over — belt-and-suspenders on top of the
    // middleware check.
    const plan = req.userPlan || 'free';
    const limits = getPlanLimits(plan);
    if (limits.maxCanvases !== Infinity) {
      const finalCount = await prisma.codingCanvas.count({
        where: userId ? { OR: [{ userId }, { dashboardAccessId }] } : { dashboardAccessId },
      });
      if (finalCount > limits.maxCanvases) {
        await prisma.codingCanvas.delete({ where: { id: canvas.id } }).catch(() => {});
        return res.status(403).json({
          success: false,
          error: `${plan === 'free' ? 'Free' : 'Your'} plan allows ${limits.maxCanvases} canvas${limits.maxCanvases === 1 ? '' : 'es'}`,
          code: 'PLAN_LIMIT_EXCEEDED',
          limit: 'maxCanvases',
          current: limits.maxCanvases,
          max: limits.maxCanvases,
          upgrade: true,
        });
      }
    }

    res.status(201).json({ success: true, data: canvas });
  } catch (err: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((err as any)?.code === 'P2002') return next(new AppError('A canvas with this name already exists', 409));
    next(err);
  }
});

// GET /canvas/:canvasId — full detail
canvasRoutes.get('/canvas/:canvasId', validateParams(canvasCanvasIdParam), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const canvas = await prisma.codingCanvas.findUnique({
      where: { id: req.params.canvasId },
      include: {
        transcripts: { orderBy: { sortOrder: 'asc' } },
        questions: { orderBy: { sortOrder: 'asc' } },
        memos: { orderBy: { createdAt: 'asc' } },
        codings: { take: 10000 },
        nodePositions: true,
        cases: { orderBy: { createdAt: 'asc' } },
        relations: { orderBy: { createdAt: 'asc' } },
        computedNodes: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!canvas) return next(new AppError('Canvas not found', 404));
    if (canvas.dashboardAccessId !== dashboardAccessId) return next(new AppError('Access denied', 403));

    const data = {
      ...canvas,
      cases: canvas.cases.map((c: any) => ({ ...c, attributes: safeJsonParse(c.attributes) })),
      computedNodes: canvas.computedNodes.map((n: any) => ({
        ...n,
        config: safeJsonParse(n.config),
        result: safeJsonParse(n.result),
      })),
    };

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// PUT /canvas/:canvasId — update name/description
canvasRoutes.put(
  '/canvas/:canvasId',
  validateParams(canvasCanvasIdParam),
  validate(updateCanvasSchema),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.canvasId, dashboardAccessId, getAuthUserId(req));
      const canvas = await prisma.codingCanvas.update({
        where: { id: req.params.canvasId },
        data: req.body,
      });
      res.json({ success: true, data: canvas });
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.code === 'P2002') return next(new AppError('A canvas with this name already exists', 409));
      next(err);
    }
  },
);

// DELETE /canvas/:canvasId — soft delete (move to trash)
canvasRoutes.delete('/canvas/:canvasId', validateParams(canvasCanvasIdParam), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.canvasId, dashboardAccessId, getAuthUserId(req));
    await prisma.codingCanvas.update({
      where: { id: req.params.canvasId },
      data: { deletedAt: new Date() },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /canvas/:canvasId/restore — restore a soft-deleted canvas
canvasRoutes.post('/canvas/:canvasId/restore', validateParams(canvasCanvasIdParam), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const canvas = await getOwnedCanvas(req.params.canvasId, dashboardAccessId, getAuthUserId(req), {
      allowDeleted: true,
    });
    if (!canvas.deletedAt) return next(new AppError('Canvas is not in trash', 400));
    const restored = await prisma.codingCanvas.update({
      where: { id: req.params.canvasId },
      data: { deletedAt: null },
    });
    res.json({ success: true, data: restored });
  } catch (err) {
    next(err);
  }
});

// DELETE /canvas/:canvasId/permanent — permanently delete a trashed canvas
canvasRoutes.delete('/canvas/:canvasId/permanent', validateParams(canvasCanvasIdParam), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const canvas = await getOwnedCanvas(req.params.canvasId, dashboardAccessId, getAuthUserId(req), {
      allowDeleted: true,
    });
    if (!canvas.deletedAt) return next(new AppError('Canvas must be in trash before permanent deletion', 400));
    await prisma.codingCanvas.delete({ where: { id: req.params.canvasId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Layout (Node Positions) ───

canvasRoutes.put(
  '/canvas/:id/layout',
  validateParams(canvasIdParam),
  validate(saveLayoutSchema),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
      const { positions } = req.body;

      await prisma.$transaction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        positions.map((pos: any) =>
          prisma.canvasNodePosition.upsert({
            where: { canvasId_nodeId: { canvasId: req.params.id, nodeId: pos.nodeId } },
            create: { canvasId: req.params.id, ...pos },
            update: { x: pos.x, y: pos.y, width: pos.width, height: pos.height, collapsed: pos.collapsed },
          }),
        ),
      );

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);
