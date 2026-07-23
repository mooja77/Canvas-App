import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  validate,
  validateParams,
  createCanvasQuestionSchema,
  updateCanvasQuestionSchema,
  createCanvasMemoSchema,
  updateCanvasMemoSchema,
  createCodingSchema,
  updateCodingSchema,
  createCaseSchema,
  updateCaseSchema,
  createRelationSchema,
  updateRelationSchema,
  autoCodeSchema,
  mergeQuestionsSchema,
  reassignCodingSchema,
  intercoderAgreementSchema,
  canvasIdParam,
  canvasQuestionParams,
  canvasMemoParams,
  canvasCodingCidParams,
  canvasCaseParams,
  canvasRelationParams,
} from '../middleware/validation.js';
import { logAudit } from '../middleware/auditLog.js';
import { sha256 } from '../utils/hashing.js';
import { getAuthId, getAuthUserId, getOwnedCanvas, safeJsonParse } from '../utils/routeHelpers.js';
import { checkCodeLimit, checkAutoCode, checkCaseAccess, checkIntercoderAccess } from '../middleware/planLimits.js';
import { searchTranscripts } from '../utils/textAnalysis.js';
import { buildSegmentCodeObservations, computeKrippendorffAlpha } from '../utils/intercoder.js';

export const codingRoutes = Router();

// ─── Questions ───

codingRoutes.post(
  '/canvas/:id/questions',
  validateParams(canvasIdParam),
  validate(createCanvasQuestionSchema),
  checkCodeLimit(),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
      const count = await prisma.canvasQuestion.count({ where: { canvasId: req.params.id } });
      const question = await prisma.canvasQuestion.create({
        data: { canvasId: req.params.id, ...req.body, sortOrder: count },
      });
      res.status(201).json({ success: true, data: question });
    } catch (err) {
      next(err);
    }
  },
);

codingRoutes.put(
  '/canvas/:id/questions/:qid',
  validateParams(canvasQuestionParams),
  validate(updateCanvasQuestionSchema),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
      const existing = await prisma.canvasQuestion.findUnique({
        where: { id: req.params.qid },
        select: { canvasId: true },
      });
      if (!existing || existing.canvasId !== req.params.id) {
        return next(new AppError('Question not found in this canvas', 404));
      }
      const question = await prisma.canvasQuestion.update({
        where: { id: req.params.qid },
        data: req.body,
      });
      res.json({ success: true, data: question });
    } catch (err) {
      next(err);
    }
  },
);

codingRoutes.delete('/canvas/:id/questions/:qid', validateParams(canvasQuestionParams), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
    const existing = await prisma.canvasQuestion.findUnique({
      where: { id: req.params.qid },
      select: { canvasId: true },
    });
    if (!existing || existing.canvasId !== req.params.id) {
      return next(new AppError('Question not found in this canvas', 404));
    }
    await prisma.canvasQuestion.delete({ where: { id: req.params.qid } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Merge Questions ───

codingRoutes.post(
  '/canvas/:id/questions/merge',
  validateParams(canvasIdParam),
  validate(mergeQuestionsSchema),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
      const { sourceId, targetId } = req.body;

      const [source, target] = await Promise.all([
        prisma.canvasQuestion.findUnique({ where: { id: sourceId } }),
        prisma.canvasQuestion.findUnique({ where: { id: targetId } }),
      ]);
      if (!source || source.canvasId !== req.params.id) {
        return next(new AppError('Source question not found in this canvas', 400));
      }
      if (!target || target.canvasId !== req.params.id) {
        return next(new AppError('Target question not found in this canvas', 400));
      }

      await prisma.$transaction([
        prisma.canvasTextCoding.updateMany({
          where: { questionId: sourceId, canvasId: req.params.id },
          data: { questionId: targetId },
        }),
        prisma.canvasQuestion.updateMany({
          where: { parentQuestionId: sourceId, canvasId: req.params.id },
          data: { parentQuestionId: targetId },
        }),
        prisma.canvasQuestion.delete({ where: { id: sourceId } }),
      ]);

      const codingCount = await prisma.canvasTextCoding.count({
        where: { questionId: targetId, canvasId: req.params.id },
      });

      res.json({ success: true, data: { targetId, codingCount } });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Memos ───

codingRoutes.post(
  '/canvas/:id/memos',
  validateParams(canvasIdParam),
  validate(createCanvasMemoSchema),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
      const memo = await prisma.canvasMemo.create({
        data: { canvasId: req.params.id, ...req.body },
      });
      res.status(201).json({ success: true, data: memo });
    } catch (err) {
      next(err);
    }
  },
);

codingRoutes.put(
  '/canvas/:id/memos/:mid',
  validateParams(canvasMemoParams),
  validate(updateCanvasMemoSchema),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
      const existing = await prisma.canvasMemo.findUnique({
        where: { id: req.params.mid },
        select: { canvasId: true },
      });
      if (!existing || existing.canvasId !== req.params.id) {
        return next(new AppError('Memo not found in this canvas', 404));
      }
      const memo = await prisma.canvasMemo.update({
        where: { id: req.params.mid },
        data: req.body,
      });
      res.json({ success: true, data: memo });
    } catch (err) {
      next(err);
    }
  },
);

codingRoutes.delete('/canvas/:id/memos/:mid', validateParams(canvasMemoParams), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
    const existing = await prisma.canvasMemo.findUnique({ where: { id: req.params.mid }, select: { canvasId: true } });
    if (!existing || existing.canvasId !== req.params.id) {
      return next(new AppError('Memo not found in this canvas', 404));
    }
    await prisma.canvasMemo.delete({ where: { id: req.params.mid } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Codings ───

codingRoutes.post(
  '/canvas/:id/codings',
  validateParams(canvasIdParam),
  validate(createCodingSchema),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const coderUserId = getAuthUserId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, coderUserId);
      const { transcriptId, questionId, startOffset, endOffset, codedText, note } = req.body;

      const [transcript, question] = await Promise.all([
        prisma.canvasTranscript.findUnique({ where: { id: transcriptId } }),
        prisma.canvasQuestion.findUnique({ where: { id: questionId } }),
      ]);
      if (!transcript || transcript.canvasId !== req.params.id) {
        return next(new AppError('Transcript not found in this canvas', 400));
      }
      if (!question || question.canvasId !== req.params.id) {
        return next(new AppError('Question not found in this canvas', 400));
      }

      const coding = await prisma.canvasTextCoding.create({
        data: {
          canvasId: req.params.id,
          transcriptId,
          questionId,
          startOffset,
          endOffset,
          codedText,
          note,
          coderUserId,
        },
      });

      const rawIp = req.ip || req.socket.remoteAddress || 'unknown';
      logAudit({
        action: 'coding.create',
        resource: 'coding',
        resourceId: coding.id,
        actorType: 'researcher',
        actorId: dashboardAccessId,
        ip: sha256(rawIp),
        method: 'POST',
        path: req.originalUrl,
        // Log a short hash of the coded text instead of the raw excerpt.
        // Preserves traceability (same text → same hash) without persisting PII.
        meta: JSON.stringify({
          canvasId: req.params.id,
          questionId,
          transcriptId,
          codedTextHash: sha256(codedText).slice(0, 16),
        }),
      });

      res.status(201).json({ success: true, data: coding });
    } catch (err) {
      next(err);
    }
  },
);

codingRoutes.put(
  '/canvas/:id/codings/:cid',
  validateParams(canvasCodingCidParams),
  validate(updateCodingSchema),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
      const oldCoding = await prisma.canvasTextCoding.findUnique({ where: { id: req.params.cid } });
      if (!oldCoding || oldCoding.canvasId !== req.params.id) {
        return next(new AppError('Coding not found in this canvas', 404));
      }
      const coding = await prisma.canvasTextCoding.update({
        where: { id: req.params.cid },
        data: req.body,
      });

      const rawIp = req.ip || req.socket.remoteAddress || 'unknown';
      logAudit({
        action: 'coding.update',
        resource: 'coding',
        resourceId: coding.id,
        actorType: 'researcher',
        actorId: dashboardAccessId,
        ip: sha256(rawIp),
        method: 'PUT',
        path: req.originalUrl,
        meta: JSON.stringify({
          canvasId: req.params.id,
          oldAnnotation: oldCoding?.annotation,
          newAnnotation: coding.annotation,
        }),
      });

      res.json({ success: true, data: coding });
    } catch (err) {
      next(err);
    }
  },
);

codingRoutes.delete('/canvas/:id/codings/:cid', validateParams(canvasCodingCidParams), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
    const deleted = await prisma.canvasTextCoding.findUnique({ where: { id: req.params.cid } });
    if (!deleted || deleted.canvasId !== req.params.id) {
      return next(new AppError('Coding not found in this canvas', 404));
    }
    await prisma.canvasTextCoding.delete({ where: { id: req.params.cid } });

    const rawIp = req.ip || req.socket.remoteAddress || 'unknown';
    logAudit({
      action: 'coding.delete',
      resource: 'coding',
      resourceId: req.params.cid,
      actorType: 'researcher',
      actorId: dashboardAccessId,
      ip: sha256(rawIp),
      method: 'DELETE',
      path: req.originalUrl,
      meta: JSON.stringify({
        canvasId: req.params.id,
        codedTextHash: deleted?.codedText ? sha256(deleted.codedText).slice(0, 16) : null,
        questionId: deleted?.questionId,
      }),
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

codingRoutes.put(
  '/canvas/:id/codings/:cid/reassign',
  validateParams(canvasCodingCidParams),
  validate(reassignCodingSchema),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
      const { newQuestionId } = req.body;

      const question = await prisma.canvasQuestion.findUnique({ where: { id: newQuestionId } });
      if (!question || question.canvasId !== req.params.id) {
        return next(new AppError('Target question not found in this canvas', 400));
      }

      const oldCoding = await prisma.canvasTextCoding.findUnique({ where: { id: req.params.cid } });
      if (!oldCoding || oldCoding.canvasId !== req.params.id) {
        return next(new AppError('Coding not found in this canvas', 404));
      }
      const coding = await prisma.canvasTextCoding.update({
        where: { id: req.params.cid },
        data: { questionId: newQuestionId },
      });

      const rawIp = req.ip || req.socket.remoteAddress || 'unknown';
      logAudit({
        action: 'coding.reassign',
        resource: 'coding',
        resourceId: coding.id,
        actorType: 'researcher',
        actorId: dashboardAccessId,
        ip: sha256(rawIp),
        method: 'PUT',
        path: req.originalUrl,
        meta: JSON.stringify({ canvasId: req.params.id, oldQuestionId: oldCoding?.questionId, newQuestionId }),
      });

      res.json({ success: true, data: coding });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Auto-Code ───

codingRoutes.post(
  '/canvas/:id/auto-code',
  validateParams(canvasIdParam),
  validate(autoCodeSchema),
  checkAutoCode(),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
      const { questionId, pattern, mode, transcriptIds } = req.body;

      const question = await prisma.canvasQuestion.findUnique({ where: { id: questionId } });
      if (!question || question.canvasId !== req.params.id) {
        return next(new AppError('Question not found in this canvas', 400));
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = { canvasId: req.params.id };
      if (transcriptIds?.length) where.id = { in: transcriptIds };
      const transcripts = await prisma.canvasTranscript.findMany({ where });

      const searchResult = searchTranscripts(transcripts, pattern, mode);
      const matches = searchResult.matches;

      if (matches.length === 0) {
        return res.json({ success: true, data: { created: 0, matches: [] } });
      }

      // Cap the number of codings created in one run so a broad pattern across
      // large transcripts can't spike DB load with an unbounded transaction.
      const AUTO_CODE_MAX = 2000;
      const truncated = matches.length > AUTO_CODE_MAX;
      const codingsToCreate = matches.slice(0, AUTO_CODE_MAX).map((m) => ({
        canvasId: req.params.id,
        transcriptId: m.transcriptId,
        questionId,
        startOffset: m.offset,
        endOffset: m.offset + m.matchText.length,
        codedText: m.matchText,
      }));

      const created = await prisma.$transaction(
        codingsToCreate.map((c) => prisma.canvasTextCoding.create({ data: c })),
      );

      const rawIp = req.ip || req.socket.remoteAddress || 'unknown';
      logAudit({
        action: 'coding.autoCode',
        resource: 'coding',
        resourceId: req.params.id,
        actorType: 'researcher',
        actorId: dashboardAccessId,
        ip: sha256(rawIp),
        method: 'POST',
        path: req.originalUrl,
        meta: JSON.stringify({ canvasId: req.params.id, questionId, pattern, mode, matchCount: created.length }),
      });

      res.status(201).json({ success: true, data: { created: created.length, codings: created, truncated } });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Cases ───

codingRoutes.post(
  '/canvas/:id/cases',
  validateParams(canvasIdParam),
  validate(createCaseSchema),
  checkCaseAccess(),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
      const { name, attributes } = req.body;
      const caseRecord = await prisma.canvasCase.create({
        data: {
          canvasId: req.params.id,
          name,
          attributes: attributes ? JSON.stringify(attributes) : '{}',
        },
      });
      res.status(201).json({
        success: true,
        data: { ...caseRecord, attributes: safeJsonParse(caseRecord.attributes) },
      });
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.code === 'P2002')
        return next(new AppError('A case with this name already exists in this canvas', 409));
      next(err);
    }
  },
);

codingRoutes.put(
  '/canvas/:id/cases/:caseId',
  validateParams(canvasCaseParams),
  validate(updateCaseSchema),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {};
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.attributes !== undefined) updateData.attributes = JSON.stringify(req.body.attributes);
      const existing = await prisma.canvasCase.findUnique({
        where: { id: req.params.caseId },
        select: { canvasId: true },
      });
      if (!existing || existing.canvasId !== req.params.id) {
        return next(new AppError('Case not found in this canvas', 404));
      }
      const caseRecord = await prisma.canvasCase.update({
        where: { id: req.params.caseId },
        data: updateData,
      });
      res.json({
        success: true,
        data: { ...caseRecord, attributes: safeJsonParse(caseRecord.attributes) },
      });
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.code === 'P2002')
        return next(new AppError('A case with this name already exists in this canvas', 409));
      next(err);
    }
  },
);

codingRoutes.delete('/canvas/:id/cases/:caseId', validateParams(canvasCaseParams), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
    const existing = await prisma.canvasCase.findUnique({
      where: { id: req.params.caseId },
      select: { canvasId: true },
    });
    if (!existing || existing.canvasId !== req.params.id) {
      return next(new AppError('Case not found in this canvas', 404));
    }
    await prisma.canvasCase.delete({ where: { id: req.params.caseId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Relations ───

codingRoutes.post(
  '/canvas/:id/relations',
  validateParams(canvasIdParam),
  validate(createRelationSchema),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
      const { fromType, fromId, toType, toId } = req.body;
      if (fromType === toType && fromId === toId) {
        return next(new AppError('A node cannot be related to itself', 400));
      }
      const [fromNode, toNode] = await Promise.all([
        fromType === 'case'
          ? prisma.canvasCase.findFirst({ where: { id: fromId, canvasId: req.params.id }, select: { id: true } })
          : prisma.canvasQuestion.findFirst({ where: { id: fromId, canvasId: req.params.id }, select: { id: true } }),
        toType === 'case'
          ? prisma.canvasCase.findFirst({ where: { id: toId, canvasId: req.params.id }, select: { id: true } })
          : prisma.canvasQuestion.findFirst({ where: { id: toId, canvasId: req.params.id }, select: { id: true } }),
      ]);
      if (!fromNode || !toNode) {
        return next(new AppError('Relation endpoints must both belong to this canvas', 400));
      }
      const relation = await prisma.canvasRelation.create({
        data: { canvasId: req.params.id, ...req.body },
      });
      res.status(201).json({ success: true, data: relation });
    } catch (err) {
      next(err);
    }
  },
);

codingRoutes.put(
  '/canvas/:id/relations/:relId',
  validateParams(canvasRelationParams),
  validate(updateRelationSchema),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
      const existing = await prisma.canvasRelation.findUnique({
        where: { id: req.params.relId },
        select: { canvasId: true },
      });
      if (!existing || existing.canvasId !== req.params.id) {
        return next(new AppError('Relation not found in this canvas', 404));
      }
      const relation = await prisma.canvasRelation.update({
        where: { id: req.params.relId },
        data: { label: req.body.label },
      });
      res.json({ success: true, data: relation });
    } catch (err) {
      next(err);
    }
  },
);

codingRoutes.delete('/canvas/:id/relations/:relId', validateParams(canvasRelationParams), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
    const existing = await prisma.canvasRelation.findUnique({
      where: { id: req.params.relId },
      select: { canvasId: true },
    });
    if (!existing || existing.canvasId !== req.params.id) {
      return next(new AppError('Relation not found in this canvas', 404));
    }
    await prisma.canvasRelation.delete({ where: { id: req.params.relId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Multi-coder agreement (Krippendorff's α over real coder attribution) ───
//
// Unlike the legacy /intercoder route (which fabricated two coders by splitting
// one canvas's codings at the timestamp midpoint), this uses the coderUserId
// recorded on each coding (migration 0031) to compute genuine ≥2-coder
// agreement. α generalises to any number of coders and tolerates the unbalanced
// designs typical of qualitative work.
codingRoutes.post(
  '/canvas/:id/intercoder/agreement',
  validateParams(canvasIdParam),
  checkIntercoderAccess(),
  validate(intercoderAgreementSchema),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));

      const { transcriptId, userIds } = req.body;

      const transcript = await prisma.canvasTranscript.findUnique({ where: { id: transcriptId } });
      if (!transcript || transcript.canvasId !== req.params.id) {
        throw new AppError('Transcript not found in this canvas', 404);
      }

      // Pull every coding on this transcript authored by one of the selected coders.
      const allCodings = await prisma.canvasTextCoding.findMany({
        where: { canvasId: req.params.id, transcriptId, coderUserId: { in: userIds } },
      });

      // Paragraph-level segmentation (mirrors the legacy route + the frontend modal).
      const content = transcript.content;
      const parts = content.split(/\n\s*\n/);
      const segments: { transcriptId: string; startOffset: number; endOffset: number }[] = [];
      let offset = 0;
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.length > 0) {
          const start = content.indexOf(trimmed, offset);
          segments.push({ transcriptId, startOffset: start, endOffset: start + trimmed.length });
          offset = start + trimmed.length;
        }
      }
      if (segments.length === 0) {
        segments.push({ transcriptId, startOffset: 0, endOffset: content.length });
      }

      const coders = userIds.map((coderId: string) => ({
        coderId,
        codings: allCodings
          .filter((c) => c.coderUserId === coderId)
          .map((c) => ({
            transcriptId: c.transcriptId,
            questionId: c.questionId,
            startOffset: c.startOffset,
            endOffset: c.endOffset,
          })),
      }));

      const observations = buildSegmentCodeObservations({ segments, coders });
      const alphaResult = computeKrippendorffAlpha(observations);

      res.json({
        success: true,
        data: {
          method: "Krippendorff's α",
          alpha: alphaResult.alpha,
          nCoders: alphaResult.n_coders,
          nUnits: alphaResult.n_units,
          nObservations: alphaResult.n_observations,
          nSegments: segments.length,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
