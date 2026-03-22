import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  validate,
  validateParams,
  createTranscriptSchema,
  updateTranscriptSchema,
  importNarrativesSchema,
  importFromCanvasSchema,
  canvasIdParam,
  canvasTranscriptParams,
} from '../middleware/validation.js';
import { getAuthId, getAuthUserId, getOwnedCanvas } from '../utils/routeHelpers.js';
import {
  checkTranscriptLimit,
  checkWordLimit,
} from '../middleware/planLimits.js';
import { getPlanLimits } from '../config/plans.js';

export const transcriptRoutes = Router();

// ─── Transcripts ───

transcriptRoutes.post('/canvas/:id/transcripts', validateParams(canvasIdParam), validate(createTranscriptSchema), checkTranscriptLimit(), checkWordLimit(), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
    const count = await prisma.canvasTranscript.count({ where: { canvasId: req.params.id } });
    const transcript = await prisma.canvasTranscript.create({
      data: { canvasId: req.params.id, ...req.body, sortOrder: count },
    });
    res.status(201).json({ success: true, data: transcript });
  } catch (err) { next(err); }
});

transcriptRoutes.put('/canvas/:id/transcripts/:tid', validateParams(canvasTranscriptParams), validate(updateTranscriptSchema), checkWordLimit(), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
    const transcript = await prisma.canvasTranscript.update({
      where: { id: req.params.tid },
      data: req.body,
    });
    res.json({ success: true, data: transcript });
  } catch (err) { next(err); }
});

transcriptRoutes.delete('/canvas/:id/transcripts/:tid', validateParams(canvasTranscriptParams), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
    await prisma.canvasTranscript.delete({ where: { id: req.params.tid } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Import Narratives (accepts pre-formatted narratives from bridge) ───

transcriptRoutes.post('/canvas/:id/import-narratives', validateParams(canvasIdParam), validate(importNarrativesSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
    const { narratives } = req.body;

    const count = await prisma.canvasTranscript.count({ where: { canvasId: req.params.id } });

    // Plan limit checks for bulk import
    const plan = req.userPlan || 'free';
    const limits = getPlanLimits(plan);
    if (limits.maxTranscriptsPerCanvas !== Infinity && count + narratives.length > limits.maxTranscriptsPerCanvas) {
      return next(new AppError(`Import would exceed your plan's transcript limit (${limits.maxTranscriptsPerCanvas} per canvas). You have ${count} and are importing ${narratives.length}.`, 403));
    }
    if (limits.maxWordsPerTranscript !== Infinity) {
      for (const n of narratives) {
        const wordCount = (n.content || '').trim().split(/\s+/).filter(Boolean).length;
        if (wordCount > limits.maxWordsPerTranscript) {
          return next(new AppError(`"${n.title}" exceeds your plan's word limit (${limits.maxWordsPerTranscript.toLocaleString()} words per transcript)`, 403));
        }
      }
    }

    const transcripts = await prisma.$transaction(
      narratives.map((n: any, i: number) =>
        prisma.canvasTranscript.create({
          data: {
            canvasId: req.params.id,
            title: n.title,
            content: n.content,
            sortOrder: count + i,
            sourceType: n.sourceType || 'import',
            sourceId: n.sourceId || null,
          },
        })
      )
    );

    res.status(201).json({ success: true, data: transcripts });
  } catch (err) { next(err); }
});

// ─── Import from Canvas ───

transcriptRoutes.post('/canvas/:id/import-from-canvas', validateParams(canvasIdParam), validate(importFromCanvasSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
    const { sourceCanvasId, transcriptIds } = req.body;

    const sourceCanvas = await prisma.codingCanvas.findUnique({ where: { id: sourceCanvasId } });
    if (!sourceCanvas) return next(new AppError('Source canvas not found', 404));
    if (sourceCanvas.dashboardAccessId !== dashboardAccessId) {
      return next(new AppError('Source canvas does not belong to you', 403));
    }

    const sourceTranscripts = await prisma.canvasTranscript.findMany({
      where: { id: { in: transcriptIds }, canvasId: sourceCanvasId },
    });

    if (sourceTranscripts.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const count = await prisma.canvasTranscript.count({ where: { canvasId: req.params.id } });

    // Plan limit checks for cross-canvas import
    const plan = req.userPlan || 'free';
    const limits = getPlanLimits(plan);
    if (limits.maxTranscriptsPerCanvas !== Infinity && count + sourceTranscripts.length > limits.maxTranscriptsPerCanvas) {
      return next(new AppError(`Import would exceed your plan's transcript limit (${limits.maxTranscriptsPerCanvas} per canvas). You have ${count} and are importing ${sourceTranscripts.length}.`, 403));
    }
    if (limits.maxWordsPerTranscript !== Infinity) {
      for (const src of sourceTranscripts) {
        const wordCount = src.content.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount > limits.maxWordsPerTranscript) {
          return next(new AppError(`"${src.title}" exceeds your plan's word limit (${limits.maxWordsPerTranscript.toLocaleString()} words per transcript)`, 403));
        }
      }
    }

    const results: any[] = [];
    for (let i = 0; i < sourceTranscripts.length; i++) {
      const src = sourceTranscripts[i];
      const newTranscript = await prisma.canvasTranscript.create({
        data: {
          canvasId: req.params.id,
          title: src.title,
          content: src.content,
          sortOrder: count + i,
          sourceType: 'cross-canvas',
          sourceId: src.id,
        },
      });
      results.push(newTranscript);
    }

    res.status(201).json({ success: true, data: results });
  } catch (err) { next(err); }
});
