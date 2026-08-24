import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { nanoid } from 'nanoid';
import { validateParams, canvasIdParam, canvasShareIdParams, shareCodeParam } from '../middleware/validation.js';
import { getAuthId, getAuthUserId, getOwnedCanvas, safeJsonParse } from '../utils/routeHelpers.js';
import { checkCanvasLimit, checkShareLimit } from '../middleware/planLimits.js';
import { getPlanLimits } from '../config/plans.js';

export const shareRoutes = Router();
export const canvasPublicRoutes = Router();

// ─── Canvas Sharing ───

/** A share link may not outlive the ethics approval it sits under. */
const MAX_SHARE_DAYS = 365;

/**
 * Both an absolute instant and a duration, because the caller may be a UI
 * offering "expires in 7 days" or a script pinning a fixed date. The expiry
 * column and both 410 checks existed from the start; the create handler simply
 * never read a value, so every link ever issued was permanent. For a tool
 * holding participant interview text under ethics approval that is a
 * governance gap, not a missing convenience.
 */
const createShareSchema = z
  .object({
    expiresAt: z.string().datetime().optional(),
    expiresInDays: z.number().int().positive().max(MAX_SHARE_DAYS).optional(),
  })
  .strict();

function resolveExpiry(body: unknown): Date | null {
  const parsed = createShareSchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new AppError(
      `Invalid share options: expiresAt must be an ISO datetime, expiresInDays a whole number of days up to ${MAX_SHARE_DAYS}`,
      400,
    );
  }

  const { expiresAt, expiresInDays } = parsed.data;
  if (expiresAt && expiresInDays !== undefined) {
    throw new AppError('Provide either expiresAt or expiresInDays, not both', 400);
  }

  const now = Date.now();
  if (expiresInDays !== undefined) return new Date(now + expiresInDays * 24 * 60 * 60 * 1000);
  if (!expiresAt) return null;

  const when = new Date(expiresAt);
  if (when.getTime() <= now) {
    throw new AppError('Share expiry must be in the future', 400);
  }
  if (when.getTime() > now + MAX_SHARE_DAYS * 24 * 60 * 60 * 1000) {
    throw new AppError(`Share expiry cannot be more than ${MAX_SHARE_DAYS} days away`, 400);
  }
  return when;
}

shareRoutes.post('/canvas/:id/share', validateParams(canvasIdParam), checkShareLimit(), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req), { requireOwner: true });

    const expiresAt = resolveExpiry(req.body);

    const shareCode = `SHARE-${nanoid(8)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, 'X')}`;

    const share = await prisma.canvasShare.create({
      data: {
        canvasId: req.params.id,
        shareCode,
        createdBy: dashboardAccessId,
        expiresAt,
      },
    });

    res.status(201).json({ success: true, data: share });
  } catch (err) {
    next(err);
  }
});

shareRoutes.get('/canvas/:id/shares', validateParams(canvasIdParam), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req), { requireOwner: true });

    const shares = await prisma.canvasShare.findMany({
      where: { canvasId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: shares });
  } catch (err) {
    next(err);
  }
});

shareRoutes.delete('/canvas/:id/share/:shareId', validateParams(canvasShareIdParams), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req), { requireOwner: true });

    const share = await prisma.canvasShare.findUnique({ where: { id: req.params.shareId } });
    if (!share || share.canvasId !== req.params.id) {
      return next(new AppError('Share not found', 404));
    }

    await prisma.canvasShare.delete({ where: { id: req.params.shareId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

shareRoutes.post('/canvas/clone/:code', validateParams(shareCodeParam), checkCanvasLimit(), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const userId = getAuthUserId(req);

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
        // Spatial arrangement is the product's metaphor. The clone copied
        // everything else and left the recipient with an auto-layout, so the
        // author's arrangement — which is analytic work, not decoration — was
        // the one thing that did not survive being shared.
        nodePositions: true,
      },
    });

    // Treat a soft-deleted source as not-found. The share row persists after
    // the owner trashes the canvas, but cloning from trashed data produces
    // surprising behavior (revived stale content) — reject the clone.
    if (!source || source.deletedAt) return next(new AppError('Source canvas not found', 404));

    // Enforce plan limits on cloned content
    const plan = req.userPlan || 'free';
    const limits = getPlanLimits(plan);

    if (limits.maxTranscriptsPerCanvas !== Infinity && source.transcripts.length > limits.maxTranscriptsPerCanvas) {
      return next(
        new AppError(
          `Clone would exceed your plan's transcript limit (${limits.maxTranscriptsPerCanvas} per canvas)`,
          403,
        ),
      );
    }
    if (limits.maxCodes !== Infinity && source.questions.length > limits.maxCodes) {
      return next(new AppError(`Clone would exceed your plan's code limit (${limits.maxCodes} codes)`, 403));
    }
    if (limits.maxWordsPerTranscript !== Infinity) {
      for (const t of source.transcripts) {
        const wordCount = t.content.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount > limits.maxWordsPerTranscript) {
          return next(
            new AppError(
              `Clone contains a transcript exceeding your plan's word limit (${limits.maxWordsPerTranscript.toLocaleString()} words)`,
              403,
            ),
          );
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

    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const newCanvas = await tx.codingCanvas.create({
          data: {
            dashboardAccessId,
            userId: userId || null,
            name: cloneName,
            description: source.description,
          },
        });

        const transcriptIdMap = new Map<string, string>();
        const questionIdMap = new Map<string, string>();
        const caseIdMap = new Map<string, string>();
        const memoIdMap = new Map<string, string>();
        const computedIdMap = new Map<string, string>();

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
          const newM = await tx.canvasMemo.create({
            data: { canvasId: newCanvas.id, title: m.title, content: m.content, color: m.color },
          });
          memoIdMap.set(m.id, newM.id);
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
                // Provenance MUST survive the clone. Omitting `source` let it
                // default to 'human', so cloning a canvas rewrote every
                // AI-accepted coding as hand-made and the IRB disclosure at
                // GET /canvas/:id/ai/disclosure went from "1 (14.3%) originated
                // from an accepted AI suggestion" to "0 (0%)". That endpoint
                // promises figures "computed from stored provenance ... so the
                // disclosure is reproducible, not self-reported" - after a
                // clone it was neither. A researcher would then declare, in
                // good faith, that no AI touched their coding.
                source: c.source,
                // Attribution must survive too: a Team's multi-coder work was
                // handed on anonymous (7/7 codings attributed before a clone,
                // 0/7 after), which is exactly the record the intercoder
                // feature exists to produce.
                coderUserId: c.coderUserId,
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
          const newN = await tx.canvasComputedNode.create({
            data: { canvasId: newCanvas.id, nodeType: n.nodeType, label: n.label, config: n.config, result: '{}' },
          });
          computedIdMap.set(n.id, newN.id);
        }

        // Layout. A stored nodeId is "<type>-<entityId>", so each one has to be
        // rewritten to the id the clone created. A position whose entity was
        // not copied (a group, or an entity the clone skipped) is dropped
        // rather than pointing at nothing.
        const idMapForNodeType: Record<string, Map<string, string>> = {
          transcript: transcriptIdMap,
          question: questionIdMap,
          case: caseIdMap,
          memo: memoIdMap,
          computed: computedIdMap,
        };

        // `?? []` because a canvas that has never been arranged has no rows,
        // and iterating undefined turns a clone into a 500 - which is exactly
        // how this shipped: the whole clone failed for want of a layout.
        for (const p of source.nodePositions ?? []) {
          const dash = p.nodeId.indexOf('-');
          if (dash === -1) continue;
          const prefix = p.nodeId.slice(0, dash);
          const oldEntityId = p.nodeId.slice(dash + 1);
          const newEntityId = idMapForNodeType[prefix]?.get(oldEntityId);
          if (!newEntityId) continue;

          await tx.canvasNodePosition.create({
            data: {
              canvasId: newCanvas.id,
              nodeId: `${prefix}-${newEntityId}`,
              nodeType: p.nodeType,
              x: p.x,
              y: p.y,
              width: p.width,
              height: p.height,
              collapsed: p.collapsed,
            },
          });
        }

        await tx.canvasShare.update({
          where: { id: share.id },
          data: { cloneCount: { increment: 1 } },
        });

        return newCanvas;
        // Raise the interactive-transaction timeout above Prisma's 5s default —
        // a heavily-coded source canvas copies hundreds/thousands of rows and can
        // otherwise exceed 5s mid-clone and roll the whole thing back.
      },
      { timeout: 30000, maxWait: 10000 },
    );

    res.status(201).json({ success: true, data: result });
  } catch (err: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((err as any)?.code === 'P2002') return next(new AppError('A canvas with this name already exists', 409));
    next(err);
  }
});

// ─── Public (no-auth) route for shared canvas ───

canvasPublicRoutes.get('/canvas/shared/:code', validateParams(shareCodeParam), async (req, res, next) => {
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

    // A trashed (soft-deleted) canvas must not stay publicly readable via its
    // share link — the CanvasShare row persists after trashing (mirrors the
    // clone path's guard above).
    if (!canvas || canvas.deletedAt) return next(new AppError('Canvas not found', 404));

    // Spreading the Prisma row put the owner's internal ids on an endpoint that
    // needs no cookie: userId, dashboardAccessId, ethicsApprovalId,
    // dataRetentionDate, deletedAt — plus coderUserId on every coding. None of
    // it is needed to render a shared canvas, and a share code never expired,
    // so the ids were harvestable indefinitely. Name the fields that go out
    // instead of the ones that must not, so a new column is private by default.
    const data = {
      id: canvas.id,
      name: canvas.name,
      description: canvas.description,
      createdAt: canvas.createdAt,
      updatedAt: canvas.updatedAt,
      transcripts: canvas.transcripts.map((t) => ({
        id: t.id,
        title: t.title,
        content: t.content,
        sortOrder: t.sortOrder,
        caseId: t.caseId,
        createdAt: t.createdAt,
      })),
      questions: canvas.questions.map((q) => ({
        id: q.id,
        text: q.text,
        color: q.color,
        sortOrder: q.sortOrder,
        parentQuestionId: q.parentQuestionId,
      })),
      memos: canvas.memos.map((m) => ({
        id: m.id,
        title: m.title,
        content: m.content,
        color: m.color,
        createdAt: m.createdAt,
      })),
      codings: canvas.codings.map((c) => ({
        id: c.id,
        transcriptId: c.transcriptId,
        questionId: c.questionId,
        startOffset: c.startOffset,
        endOffset: c.endOffset,
        codedText: c.codedText,
        note: c.note,
        annotation: c.annotation,
        source: c.source,
        createdAt: c.createdAt,
      })),
      cases: canvas.cases.map((c) => ({
        id: c.id,
        name: c.name,
        attributes: safeJsonParse(c.attributes),
        createdAt: c.createdAt,
      })),
      relations: canvas.relations.map((r) => ({
        id: r.id,
        fromType: r.fromType,
        fromId: r.fromId,
        toType: r.toType,
        toId: r.toId,
        label: r.label,
      })),
      computedNodes: canvas.computedNodes.map((n) => ({
        id: n.id,
        nodeType: n.nodeType,
        label: n.label,
        config: safeJsonParse(n.config),
        result: safeJsonParse(n.result),
      })),
    };

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
