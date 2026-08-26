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
import { trackJmsEvent } from '../lib/jms-events.js';
import { deleteStoredUploads } from '../utils/fileCleanup.js';

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

    // Show canvases owned via dashboardAccess OR userId, plus canvases the
    // user was invited to as a collaborator, excluding soft-deleted
    const ownerFilter = userId
      ? { OR: [{ dashboardAccessId }, { userId }, { collaborators: { some: { userId } } }] }
      : { dashboardAccessId };
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

    // Flag canvases the user can open but doesn't own so the list UI can
    // show a "Shared with you" badge.
    const flagged = canvases.map((c) => ({
      ...c,
      sharedWithMe: !(c.dashboardAccessId === dashboardAccessId || (userId && c.userId === userId)),
    }));
    res.json({ success: true, data: flagged, total, limit: take, offset: skip });
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
    const {
      name,
      description,
      starterCodes = [],
    } = req.body as {
      name: string;
      description?: string;
      starterCodes?: string[];
    };

    const plan = req.userPlan || 'free';
    const limits = getPlanLimits(plan);
    if (limits.maxCodes !== Infinity && starterCodes.length > limits.maxCodes) {
      return next(new AppError(`This template exceeds your plan's code limit (${limits.maxCodes} codes)`, 403));
    }

    const createData = {
      dashboardAccessId,
      name,
      description,
      ...(userId ? { userId } : {}),
    };
    const canvas = starterCodes.length
      ? await prisma.$transaction(async (tx) => {
          const created = await tx.codingCanvas.create({ data: createData });
          await tx.canvasQuestion.createMany({
            data: starterCodes.map((text, sortOrder) => ({ canvasId: created.id, text, sortOrder })),
          });
          return created;
        })
      : await prisma.codingCanvas.create({ data: createData });

    // Post-create guard against the plan-limit race: two parallel requests
    // can both pass checkCanvasLimit() (count was N below limit for both)
    // and then both create, overshooting the cap. Recount and hard-delete
    // anything that pushed us over — belt-and-suspenders on top of the
    // middleware check.
    if (limits.maxCanvases !== Infinity) {
      // Mirrors checkCanvasLimit: trashed canvases do not consume a slot. If
      // this recount disagrees with the middleware, it hard-deletes the row the
      // user just created — so the two filters must stay identical.
      const finalCount = await prisma.codingCanvas.count({
        where: userId
          ? { OR: [{ userId }, { dashboardAccessId }], deletedAt: null }
          : { dashboardAccessId, deletedAt: null },
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

    // First-value tracker: if this is the dashboard's first canvas, fire
    // a 'first_canvas_created' event into the JMS admin-portal so
    // ingest_events shows real activation rates.
    const canvasCount = await prisma.codingCanvas.count({
      where: { dashboardAccessId },
    });
    if (canvasCount === 1) {
      void trackJmsEvent({
        name: 'first_canvas_created',
        properties: {
          canvas_id: canvas.id,
          dashboard_access_id: dashboardAccessId,
        },
      });
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
    // Shared access check (owner or collaborator). The previous inline
    // dashboardAccessId-only comparison locked out invited collaborators.
    await getOwnedCanvas(req.params.canvasId, dashboardAccessId, getAuthUserId(req));
    // Load large projects in bounded pages. Every related collection used to
    // be materialised into one Prisma result and one JSON response, so the
    // paid plans' intentionally uncapped projects could exhaust the API long
    // before the browser received a byte.
    const rawDetailPage = Number.parseInt(req.query.detailPage as string, 10);
    const detailPage = Math.max(Number.isFinite(rawDetailPage) ? rawDetailPage : 0, 0);
    const rawDetailPageSize = Number.parseInt(req.query.detailPageSize as string, 10);
    const detailPageSize = Math.min(Math.max(Number.isFinite(rawDetailPageSize) ? rawDetailPageSize : 500, 50), 1000);
    const detailSkip = detailPage * detailPageSize;
    const detailTake = detailPageSize + 1;

    const canvas = await prisma.codingCanvas.findUnique({
      where: { id: req.params.canvasId },
      include: {
        transcripts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], skip: detailSkip, take: detailTake },
        questions: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], skip: detailSkip, take: detailTake },
        memos: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: detailSkip, take: detailTake },
        codings: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: detailSkip, take: detailTake },
        nodePositions: { orderBy: { id: 'asc' }, skip: detailSkip, take: detailTake },
        cases: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: detailSkip, take: detailTake },
        relations: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: detailSkip, take: detailTake },
        computedNodes: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: detailSkip, take: detailTake },
      },
    });
    if (!canvas) return next(new AppError('Canvas not found', 404));

    // Tell the client what it may do with this canvas: 'owner', or the
    // collaborator's role ('editor' | 'viewer'). Viewers get a read-only
    // workspace; writes are enforced server-side by viewerWriteGuard.
    const userId = getAuthUserId(req);
    const isOwner = canvas.dashboardAccessId === dashboardAccessId || (userId && canvas.userId === userId);
    let myRole = 'owner';
    if (!isOwner && userId) {
      const collab = await prisma.canvasCollaborator.findUnique({
        where: { canvasId_userId: { canvasId: canvas.id, userId } },
        select: { role: true },
      });
      myRole = collab?.role || 'viewer';
    }

    const page = <T>(rows: T[]): T[] => rows.slice(0, detailPageSize);
    const hasMore = {
      transcripts: canvas.transcripts.length > detailPageSize,
      questions: canvas.questions.length > detailPageSize,
      memos: canvas.memos.length > detailPageSize,
      codings: canvas.codings.length > detailPageSize,
      nodePositions: canvas.nodePositions.length > detailPageSize,
      cases: canvas.cases.length > detailPageSize,
      relations: canvas.relations.length > detailPageSize,
      computedNodes: canvas.computedNodes.length > detailPageSize,
    };
    const data = {
      ...canvas,
      myRole,
      transcripts: page(canvas.transcripts),
      questions: page(canvas.questions),
      memos: page(canvas.memos),
      codings: page(canvas.codings),
      nodePositions: page(canvas.nodePositions),
      cases: page(canvas.cases).map((c) => ({ ...c, attributes: safeJsonParse(c.attributes) })),
      relations: page(canvas.relations),
      computedNodes: page(canvas.computedNodes).map((n) => ({
        ...n,
        config: safeJsonParse(n.config),
        result: safeJsonParse(n.result),
      })),
    };

    res.json({ success: true, data, detailPagination: { page: detailPage, pageSize: detailPageSize, hasMore } });
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
    await getOwnedCanvas(req.params.canvasId, dashboardAccessId, getAuthUserId(req), { requireOwner: true });
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
// Restoring consumes a plan slot, so it is capped like creation. Without this
// the cap is bypassable without bound: soft-delete is the only delete the UI
// offers and nothing purges the trash, so a user could create -> delete ->
// create indefinitely and then restore everything.
canvasRoutes.post(
  '/canvas/:canvasId/restore',
  validateParams(canvasCanvasIdParam),
  checkCanvasLimit(),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const canvas = await getOwnedCanvas(req.params.canvasId, dashboardAccessId, getAuthUserId(req), {
        allowDeleted: true,
        requireOwner: true,
      });
      if (!canvas.deletedAt) return next(new AppError('Canvas is not in trash', 400));
      const restored = await prisma.codingCanvas.update({
        where: { id: req.params.canvasId },
        data: { deletedAt: null },
      });
      res.json({ success: true, data: restored });
    } catch (err) {
      // A trashed canvas may share its old name with a new live canvas. Keep
      // both records safe and explain the conflict rather than turning a
      // partial-index violation into a 500.
      if ((err as { code?: string })?.code === 'P2002') {
        return next(new AppError('A live canvas already uses this name. Rename or delete it before restoring.', 409));
      }
      next(err);
    }
  },
);

// DELETE /canvas/:canvasId/permanent — permanently delete a trashed canvas
canvasRoutes.delete('/canvas/:canvasId/permanent', validateParams(canvasCanvasIdParam), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const canvas = await getOwnedCanvas(req.params.canvasId, dashboardAccessId, getAuthUserId(req), {
      allowDeleted: true,
      requireOwner: true,
    });
    if (!canvas.deletedAt) return next(new AppError('Canvas must be in trash before permanent deletion', 400));
    await deleteStoredUploads({ canvasId: req.params.canvasId });
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
