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
import { checkTranscriptLimit, checkWordLimit, resolveRequestPlan } from '../middleware/planLimits.js';
import { getPlanLimits } from '../config/plans.js';

export const transcriptRoutes = Router();

// ─── Transcripts ───

transcriptRoutes.post(
  '/canvas/:id/transcripts',
  validateParams(canvasIdParam),
  validate(createTranscriptSchema),
  checkTranscriptLimit(),
  checkWordLimit(),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
      const count = await prisma.canvasTranscript.count({ where: { canvasId: req.params.id } });
      const transcript = await prisma.canvasTranscript.create({
        data: { canvasId: req.params.id, ...req.body, sortOrder: count },
      });
      res.status(201).json({ success: true, data: transcript });
    } catch (err) {
      next(err);
    }
  },
);

transcriptRoutes.put(
  '/canvas/:id/transcripts/:tid',
  validateParams(canvasTranscriptParams),
  validate(updateTranscriptSchema),
  checkWordLimit(),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
      // Confirm the transcript belongs to this canvas. Without this, a user
      // who owns canvas A could update a transcript in someone else's canvas
      // just by knowing the transcript ID (IDOR).
      const existing = await prisma.canvasTranscript.findUnique({
        where: { id: req.params.tid },
        select: { canvasId: true, content: true },
      });
      if (!existing || existing.canvasId !== req.params.id) {
        return next(new AppError('Transcript not found in this canvas', 404));
      }

      // Codings are absolute character offsets into this content. Changing the
      // text underneath them silently repoints every coding at whatever now
      // occupies those positions - the stored codedText stops matching, and
      // highlights, excerpt context, exports and agreement statistics all
      // quietly describe the wrong span. Nothing here remapped or invalidated
      // them, and nothing warned.
      //
      // No UI edits transcript content today (only caseId and title), so this
      // is latent rather than active - but the endpoint accepts content, and
      // the moment a transcript editor is added it would corrupt every coding
      // on that transcript. Refuse rather than corrupt. Re-mapping offsets
      // through a diff is the real feature and needs to be designed, not
      // improvised here.
      if (req.body.content !== undefined && req.body.content !== existing.content) {
        const codingCount = await prisma.canvasTextCoding.count({ where: { transcriptId: req.params.tid } });
        if (codingCount > 0) {
          return next(
            new AppError(
              `Cannot change this transcript's text: ${codingCount} coding(s) reference positions in it and would be silently repointed at different words. Remove the codings first, or import the revised text as a new transcript.`,
              409,
            ),
          );
        }
      }

      const transcript = await prisma.canvasTranscript.update({
        where: { id: req.params.tid },
        data: req.body,
      });
      res.json({ success: true, data: transcript });
    } catch (err) {
      next(err);
    }
  },
);

transcriptRoutes.delete(
  '/canvas/:id/transcripts/:tid',
  validateParams(canvasTranscriptParams),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
      const existing = await prisma.canvasTranscript.findUnique({
        where: { id: req.params.tid },
        select: { canvasId: true },
      });
      if (!existing || existing.canvasId !== req.params.id) {
        return next(new AppError('Transcript not found in this canvas', 404));
      }
      await prisma.canvasTranscript.delete({ where: { id: req.params.tid } });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Import Narratives (accepts pre-formatted narratives from bridge) ───

transcriptRoutes.post(
  '/canvas/:id/import-narratives',
  validateParams(canvasIdParam),
  validate(importNarrativesSchema),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
      const { narratives } = req.body;

      const count = await prisma.canvasTranscript.count({ where: { canvasId: req.params.id } });

      // Plan limit checks for bulk import.
      //
      // Resolve against the canvas OWNER, exactly like checkTranscriptLimit /
      // checkWordLimit do on every other transcript route. req.userPlan is the
      // REQUESTER's plan, so a Free collaborator invited onto a Pro canvas was
      // held to Free caps on someone else's paid canvas.
      const plan = await resolveRequestPlan(req);
      const limits = getPlanLimits(plan);
      if (limits.maxTranscriptsPerCanvas !== Infinity && count + narratives.length > limits.maxTranscriptsPerCanvas) {
        return next(
          new AppError(
            `Import would exceed your plan's transcript limit (${limits.maxTranscriptsPerCanvas} per canvas). You have ${count} and are importing ${narratives.length}.`,
            403,
          ),
        );
      }
      if (limits.maxWordsPerTranscript !== Infinity) {
        for (const n of narratives) {
          const wordCount = (n.content || '').trim().split(/\s+/).filter(Boolean).length;
          if (wordCount > limits.maxWordsPerTranscript) {
            return next(
              new AppError(
                `"${n.title}" exceeds your plan's word limit (${limits.maxWordsPerTranscript.toLocaleString()} words per transcript)`,
                403,
              ),
            );
          }
        }
      }

      const transcripts = await prisma.$transaction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          }),
        ),
      );

      res.status(201).json({ success: true, data: transcripts });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Import from Canvas ───

transcriptRoutes.post(
  '/canvas/:id/import-from-canvas',
  validateParams(canvasIdParam),
  validate(importFromCanvasSchema),
  async (req, res, next) => {
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

      // Plan limit checks for cross-canvas import — owner-resolved, as above.
      const plan = await resolveRequestPlan(req);
      const limits = getPlanLimits(plan);
      if (
        limits.maxTranscriptsPerCanvas !== Infinity &&
        count + sourceTranscripts.length > limits.maxTranscriptsPerCanvas
      ) {
        return next(
          new AppError(
            `Import would exceed your plan's transcript limit (${limits.maxTranscriptsPerCanvas} per canvas). You have ${count} and are importing ${sourceTranscripts.length}.`,
            403,
          ),
        );
      }
      if (limits.maxWordsPerTranscript !== Infinity) {
        for (const src of sourceTranscripts) {
          const wordCount = src.content.trim().split(/\s+/).filter(Boolean).length;
          if (wordCount > limits.maxWordsPerTranscript) {
            return next(
              new AppError(
                `"${src.title}" exceeds your plan's word limit (${limits.maxWordsPerTranscript.toLocaleString()} words per transcript)`,
                403,
              ),
            );
          }
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    } catch (err) {
      next(err);
    }
  },
);
