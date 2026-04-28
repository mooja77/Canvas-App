import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { getAuthId, getAuthUserId, getOwnedCanvas, safeJsonParse } from '../utils/routeHelpers.js';
import { computeKappa } from '../utils/intercoder.js';
import { validateParams, canvasIdParam, canvasIdDocIdParams } from '../middleware/validation.js';

export const trainingRoutes = Router();

// ─── Training Documents ───

// POST /canvas/:id/training — create training document
trainingRoutes.post('/canvas/:id/training', validateParams(canvasIdParam), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));

    const { transcriptId, name, instructions, goldCodings, passThreshold } = req.body;

    if (!transcriptId || !name || !goldCodings) {
      return next(new AppError('transcriptId, name, and goldCodings are required', 400));
    }

    // Verify transcript belongs to this canvas
    const transcript = await prisma.canvasTranscript.findUnique({ where: { id: transcriptId } });
    if (!transcript || transcript.canvasId !== req.params.id) {
      return next(new AppError('Transcript not found in this canvas', 400));
    }

    if (!Array.isArray(goldCodings) || goldCodings.length === 0) {
      return next(new AppError('goldCodings must be a non-empty array', 400));
    }

    const doc = await prisma.trainingDocument.create({
      data: {
        canvasId: req.params.id,
        transcriptId,
        name,
        instructions: instructions || null,
        goldCodings: JSON.stringify(goldCodings),
        passThreshold: passThreshold ?? 0.7,
      },
    });

    res.status(201).json({
      success: true,
      data: { ...doc, goldCodings: safeJsonParse(doc.goldCodings, []) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /canvas/:id/training — list training documents
trainingRoutes.get('/canvas/:id/training', validateParams(canvasIdParam), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));

    const docs = await prisma.trainingDocument.findMany({
      where: { canvasId: req.params.id },
      include: { _count: { select: { attempts: true } } },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      success: true,
      data: docs.map((d) => ({
        ...d,
        goldCodings: safeJsonParse(d.goldCodings, []),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /canvas/:id/training/:docId — get training document detail
trainingRoutes.get('/canvas/:id/training/:docId', validateParams(canvasIdDocIdParams), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));

    const doc = await prisma.trainingDocument.findUnique({
      where: { id: req.params.docId },
      include: {
        attempts: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!doc || doc.canvasId !== req.params.id) {
      return next(new AppError('Training document not found', 404));
    }

    res.json({
      success: true,
      data: {
        ...doc,
        goldCodings: safeJsonParse(doc.goldCodings, []),
        attempts: doc.attempts.map((a) => ({
          ...a,
          codings: safeJsonParse(a.codings, []),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /canvas/:id/training/:docId — delete training document
trainingRoutes.delete('/canvas/:id/training/:docId', validateParams(canvasIdDocIdParams), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));

    const doc = await prisma.trainingDocument.findUnique({ where: { id: req.params.docId } });
    if (!doc || doc.canvasId !== req.params.id) {
      return next(new AppError('Training document not found', 404));
    }

    await prisma.trainingDocument.delete({ where: { id: req.params.docId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Training Attempts ───

// POST /canvas/:id/training/:docId/attempt — submit a training attempt
trainingRoutes.post(
  '/canvas/:id/training/:docId/attempt',
  validateParams(canvasIdDocIdParams),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
      const userId = getAuthUserId(req) || dashboardAccessId;

      const doc = await prisma.trainingDocument.findUnique({ where: { id: req.params.docId } });
      if (!doc || doc.canvasId !== req.params.id) {
        return next(new AppError('Training document not found', 404));
      }

      const { codings } = req.body;
      if (!codings || !Array.isArray(codings)) {
        return next(new AppError('codings must be an array', 400));
      }

      // Get transcript length for Kappa computation
      const transcript = await prisma.canvasTranscript.findUnique({
        where: { id: doc.transcriptId },
        select: { content: true },
      });
      if (!transcript) {
        return next(new AppError('Associated transcript not found', 404));
      }

      const goldCodings = safeJsonParse(doc.goldCodings, []);
      const transcriptLength = transcript.content.length;

      // Compute Cohen's Kappa
      const kappaScore = computeKappa(goldCodings, codings, transcriptLength);
      const passed = kappaScore >= doc.passThreshold;

      const attempt = await prisma.trainingAttempt.create({
        data: {
          trainingDocumentId: doc.id,
          userId,
          codings: JSON.stringify(codings),
          kappaScore,
          passed,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          ...attempt,
          codings: safeJsonParse(attempt.codings, []),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /canvas/:id/training/:docId/attempts — list attempts for a training document
trainingRoutes.get(
  '/canvas/:id/training/:docId/attempts',
  validateParams(canvasIdDocIdParams),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));

      const doc = await prisma.trainingDocument.findUnique({ where: { id: req.params.docId } });
      if (!doc || doc.canvasId !== req.params.id) {
        return next(new AppError('Training document not found', 404));
      }

      const attempts = await prisma.trainingAttempt.findMany({
        where: { trainingDocumentId: req.params.docId },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        success: true,
        data: attempts.map((a) => ({
          ...a,
          codings: safeJsonParse(a.codings, []),
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);
