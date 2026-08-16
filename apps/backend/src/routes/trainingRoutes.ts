import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { getAuthId, getAuthUserId, getOwnedCanvas, safeJsonParse } from '../utils/routeHelpers.js';
import { computeKappa } from '../utils/intercoder.js';
import { validateParams, canvasIdParam, canvasIdDocIdParams } from '../middleware/validation.js';

export const trainingRoutes = Router();

interface TrainingCodingInput {
  questionId: string;
  startOffset: number;
  endOffset: number;
  codedText?: string;
}

function isCanvasOwner(
  canvas: { dashboardAccessId: string; userId: string | null },
  dashboardAccessId: string,
  userId?: string | null,
): boolean {
  return canvas.dashboardAccessId === dashboardAccessId || (!!userId && canvas.userId === userId);
}

async function validateCodings(
  canvasId: string,
  transcriptId: string,
  contentLength: number,
  value: unknown,
): Promise<TrainingCodingInput[]> {
  if (!Array.isArray(value) || value.length === 0 || value.length > 10_000) {
    throw new AppError('codings must be a non-empty array with at most 10,000 entries', 400);
  }
  const codings = value as TrainingCodingInput[];
  const questionIds = new Set<string>();
  for (const coding of codings) {
    if (
      !coding ||
      typeof coding.questionId !== 'string' ||
      !Number.isInteger(coding.startOffset) ||
      !Number.isInteger(coding.endOffset) ||
      coding.startOffset < 0 ||
      coding.endOffset <= coding.startOffset ||
      coding.endOffset > contentLength
    ) {
      throw new AppError('Each coding must contain a valid code and transcript range', 400);
    }
    questionIds.add(coding.questionId);
  }
  const matchingQuestions = await prisma.canvasQuestion.count({
    where: { canvasId, id: { in: [...questionIds] } },
  });
  if (matchingQuestions !== questionIds.size) {
    throw new AppError('Every training code must belong to this canvas', 400);
  }
  return codings;
}

// ─── Training Documents ───

// POST /canvas/:id/training — create training document
trainingRoutes.post('/canvas/:id/training', validateParams(canvasIdParam), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const userId = getAuthUserId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, userId, { requireOwner: true });

    const { transcriptId, name, instructions, goldCodings, passThreshold } = req.body;

    if (
      !transcriptId ||
      typeof transcriptId !== 'string' ||
      !name ||
      typeof name !== 'string' ||
      name.trim().length > 200 ||
      (instructions !== undefined && (typeof instructions !== 'string' || instructions.length > 5000)) ||
      (passThreshold !== undefined && (typeof passThreshold !== 'number' || passThreshold < 0 || passThreshold > 1))
    ) {
      return next(new AppError('transcriptId, name, and goldCodings are required', 400));
    }

    // Verify transcript belongs to this canvas
    const transcript = await prisma.canvasTranscript.findUnique({ where: { id: transcriptId } });
    if (!transcript || transcript.canvasId !== req.params.id) {
      return next(new AppError('Transcript not found in this canvas', 400));
    }

    const validatedGold = await validateCodings(req.params.id, transcriptId, transcript.content.length, goldCodings);

    const doc = await prisma.trainingDocument.create({
      data: {
        canvasId: req.params.id,
        transcriptId,
        name: name.trim(),
        instructions: instructions || null,
        goldCodings: JSON.stringify(validatedGold),
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
    const userId = getAuthUserId(req);
    const canvas = await getOwnedCanvas(req.params.id, dashboardAccessId, userId);
    const owner = isCanvasOwner(canvas, dashboardAccessId, userId);

    const docs = await prisma.trainingDocument.findMany({
      where: { canvasId: req.params.id },
      include: { _count: { select: { attempts: true } } },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      success: true,
      data: docs.map((d) => ({
        ...d,
        ...(owner ? { goldCodings: safeJsonParse(d.goldCodings, []) } : {}),
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
    const userId = getAuthUserId(req);
    const canvas = await getOwnedCanvas(req.params.id, dashboardAccessId, userId);
    const owner = isCanvasOwner(canvas, dashboardAccessId, userId);

    const doc = await prisma.trainingDocument.findUnique({
      where: { id: req.params.docId },
      include: {
        attempts: {
          where: owner ? undefined : { userId: userId ?? '__none__' },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!doc || doc.canvasId !== req.params.id) {
      return next(new AppError('Training document not found', 404));
    }

    res.json({
      success: true,
      data: {
        ...doc,
        ...(owner ? { goldCodings: safeJsonParse(doc.goldCodings, []) } : {}),
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
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req), { requireOwner: true });

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
      // Legacy access-code sessions have no User row, so leave userId null
      // (FK requires a real User.id after migration 0019). The attempt still
      // belongs to the canvas via trainingDocumentId.
      const userId = getAuthUserId(req) ?? null;

      const doc = await prisma.trainingDocument.findUnique({ where: { id: req.params.docId } });
      if (!doc || doc.canvasId !== req.params.id) {
        return next(new AppError('Training document not found', 404));
      }

      const { codings } = req.body;
      // Get transcript length for Kappa computation
      const transcript = await prisma.canvasTranscript.findUnique({
        where: { id: doc.transcriptId },
        select: { content: true },
      });
      if (!transcript) {
        return next(new AppError('Associated transcript not found', 404));
      }

      const goldCodings = safeJsonParse(doc.goldCodings, []) as TrainingCodingInput[];
      const transcriptLength = transcript.content.length;
      const validatedCodings = await validateCodings(req.params.id, doc.transcriptId, transcriptLength, codings);

      // Compute Cohen's Kappa
      const kappaScore = computeKappa(goldCodings, validatedCodings, transcriptLength);
      const passed = kappaScore >= doc.passThreshold;

      const attempt = await prisma.trainingAttempt.create({
        data: {
          trainingDocumentId: doc.id,
          userId,
          codings: JSON.stringify(validatedCodings),
          kappaScore,
          passed,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          ...attempt,
          codings: safeJsonParse(attempt.codings, []),
          goldCodings,
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
      const userId = getAuthUserId(req);
      const canvas = await getOwnedCanvas(req.params.id, dashboardAccessId, userId);
      const owner = isCanvasOwner(canvas, dashboardAccessId, userId);

      const doc = await prisma.trainingDocument.findUnique({ where: { id: req.params.docId } });
      if (!doc || doc.canvasId !== req.params.id) {
        return next(new AppError('Training document not found', 404));
      }

      const attempts = await prisma.trainingAttempt.findMany({
        where: {
          trainingDocumentId: req.params.docId,
          ...(owner ? {} : { userId: userId ?? '__none__' }),
        },
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
