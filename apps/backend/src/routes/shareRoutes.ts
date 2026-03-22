import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { nanoid } from 'nanoid';
import { getAuthId, getAuthUserId, getOwnedCanvas, safeJsonParse } from '../utils/routeHelpers.js';
import {
  checkCanvasLimit,
  checkShareLimit,
} from '../middleware/planLimits.js';
import { getPlanLimits } from '../config/plans.js';

export const shareRoutes = Router();
export const canvasPublicRoutes = Router();

// ─── Canvas Sharing ───

shareRoutes.post('/canvas/:id/share', checkShareLimit(), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));

    const shareCode = `SHARE-${nanoid(8).toUpperCase().replace(/[^A-Z0-9]/g, 'X')}`;

    const share = await prisma.canvasShare.create({
      data: {
        canvasId: req.params.id,
        shareCode,
        createdBy: dashboardAccessId,
      },
    });

    res.status(201).json({ success: true, data: share });
  } catch (err) { next(err); }
});

shareRoutes.get('/canvas/:id/shares', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));

    const shares = await prisma.canvasShare.findMany({
      where: { canvasId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: shares });
  } catch (err) { next(err); }
});

shareRoutes.delete('/canvas/:id/share/:shareId', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));

    const share = await prisma.canvasShare.findUnique({ where: { id: req.params.shareId } });
    if (!share || share.canvasId !== req.params.id) {
      return next(new AppError('Share not found', 404));
    }

    await prisma.canvasShare.delete({ where: { id: req.params.shareId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

shareRoutes.post('/canvas/clone/:code', checkCanvasLimit(), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);

    const share = await prisma.canvasShare.findUnique({ where: { shareCode: req.params.code } });
    if (!share) return next(new AppError('Share code not found', 404));

    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return next(new AppError('Share code has expired', 410));
    }

    const source = await prisma.codingCanvas.findUnique({
      where: { id: share.canvasId },
      include: {
        transcripts: true,
        questions: true,
        memos: true,
        codings: true,
        cases: true,
        relations: true,
        computedNodes: true,
      },
    });

    if (!source) return next(new AppError('Source canvas not found', 404));

    // Enforce plan limits on cloned content
    const plan = req.userPlan || 'free';
    const limits = getPlanLimits(plan);

    if (limits.maxTranscriptsPerCanvas !== Infinity && source.transcripts.length > limits.maxTranscriptsPerCanvas) {
      return next(new AppError(`Clone would exceed your plan's transcript limit (${limits.maxTranscriptsPerCanvas} per canvas)`, 403));
    }
    if (limits.maxCodes !== Infinity && source.questions.length > limits.maxCodes) {
      return next(new AppError(`Clone would exceed your plan's code limit (${limits.maxCodes} codes)`, 403));
    }
    if (limits.maxWordsPerTranscript !== Infinity) {
      for (const t of source.transcripts) {
        const wordCount = t.content.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount > limits.maxWordsPerTranscript) {
          return next(new AppError(`Clone contains a transcript exceeding your plan's word limit (${limits.maxWordsPerTranscript.toLocaleString()} words)`, 403));
        }
      }
    }

    const baseName = `${source.name} (Clone)`;
    let cloneName = baseName;
    let attempt = 0;
    while (true) {
      const existing = await prisma.codingCanvas.findUnique({
        where: { dashboardAccessId_name: { dashboardAccessId, name: cloneName } },
      });
      if (!existing) break;
      attempt++;
      cloneName = `${baseName} ${attempt}`;
    }

    const result = await prisma.$transaction(async (tx) => {
      const newCanvas = await tx.codingCanvas.create({
        data: {
          dashboardAccessId,
          name: cloneName,
          description: source.description,
        },
      });

      const transcriptIdMap = new Map<string, string>();
      const questionIdMap = new Map<string, string>();
      const caseIdMap = new Map<string, string>();

      for (const c of source.cases) {
        const newCase = await tx.canvasCase.create({
          data: { canvasId: newCanvas.id, name: c.name, attributes: c.attributes },
        });
        caseIdMap.set(c.id, newCase.id);
      }

      for (const t of source.transcripts) {
        const newT = await tx.canvasTranscript.create({
          data: {
            canvasId: newCanvas.id,
            title: t.title,
            content: t.content,
            sortOrder: t.sortOrder,
            caseId: t.caseId ? caseIdMap.get(t.caseId) || null : null,
            sourceType: 'cross-canvas',
            sourceId: t.id,
          },
        });
        transcriptIdMap.set(t.id, newT.id);
      }

      for (const q of source.questions) {
        const newQ = await tx.canvasQuestion.create({
          data: { canvasId: newCanvas.id, text: q.text, color: q.color, sortOrder: q.sortOrder },
        });
        questionIdMap.set(q.id, newQ.id);
      }

      for (const q of source.questions) {
        if (q.parentQuestionId && questionIdMap.has(q.parentQuestionId)) {
          await tx.canvasQuestion.update({
            where: { id: questionIdMap.get(q.id)! },
            data: { parentQuestionId: questionIdMap.get(q.parentQuestionId)! },
          });
        }
      }

      for (const m of source.memos) {
        await tx.canvasMemo.create({
          data: { canvasId: newCanvas.id, title: m.title, content: m.content, color: m.color },
        });
      }

      for (const c of source.codings) {
        const newTranscriptId = transcriptIdMap.get(c.transcriptId);
        const newQuestionId = questionIdMap.get(c.questionId);
        if (newTranscriptId && newQuestionId) {
          await tx.canvasTextCoding.create({
            data: {
              canvasId: newCanvas.id,
              transcriptId: newTranscriptId,
              questionId: newQuestionId,
              startOffset: c.startOffset,
              endOffset: c.endOffset,
              codedText: c.codedText,
              note: c.note,
              annotation: c.annotation,
            },
          });
        }
      }

      for (const r of source.relations) {
        const fromId = r.fromType === 'case' ? caseIdMap.get(r.fromId) : questionIdMap.get(r.fromId);
        const toId = r.toType === 'case' ? caseIdMap.get(r.toId) : questionIdMap.get(r.toId);
        if (fromId && toId) {
          await tx.canvasRelation.create({
            data: { canvasId: newCanvas.id, fromType: r.fromType, fromId, toType: r.toType, toId, label: r.label },
          });
        }
      }

      for (const n of source.computedNodes) {
        await tx.canvasComputedNode.create({
          data: { canvasId: newCanvas.id, nodeType: n.nodeType, label: n.label, config: n.config, result: '{}' },
        });
      }

      await tx.canvasShare.update({
        where: { id: share.id },
        data: { cloneCount: { increment: 1 } },
      });

      return newCanvas;
    });

    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    if (err.code === 'P2002') return next(new AppError('A canvas with this name already exists', 409));
    next(err);
  }
});

// ─── Public (no-auth) route for shared canvas ───

canvasPublicRoutes.get('/canvas/shared/:code', async (req, res, next) => {
  try {
    const share = await prisma.canvasShare.findUnique({ where: { shareCode: req.params.code } });
    if (!share) return next(new AppError('Share code not found', 404));

    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return next(new AppError('Share code has expired', 410));
    }

    const canvas = await prisma.codingCanvas.findUnique({
      where: { id: share.canvasId },
      include: {
        transcripts: { orderBy: { sortOrder: 'asc' } },
        questions: { orderBy: { sortOrder: 'asc' } },
        memos: { orderBy: { createdAt: 'asc' } },
        codings: true,
        cases: { orderBy: { createdAt: 'asc' } },
        relations: { orderBy: { createdAt: 'asc' } },
        computedNodes: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!canvas) return next(new AppError('Canvas not found', 404));

    const data = {
      ...canvas,
      cases: canvas.cases.map(c => ({ ...c, attributes: safeJsonParse(c.attributes) })),
      computedNodes: canvas.computedNodes.map(n => ({
        ...n,
        config: safeJsonParse(n.config),
        result: safeJsonParse(n.result),
      })),
    };

    res.json({ success: true, data });
  } catch (err) { next(err); }
});
