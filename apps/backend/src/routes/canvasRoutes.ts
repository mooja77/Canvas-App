import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  validate,
  createCanvasSchema,
  updateCanvasSchema,
  createTranscriptSchema,
  updateTranscriptSchema,
  createCanvasQuestionSchema,
  updateCanvasQuestionSchema,
  createCanvasMemoSchema,
  updateCanvasMemoSchema,
  createCodingSchema,
  saveLayoutSchema,
  updateCodingSchema,
  createCaseSchema,
  updateCaseSchema,
  createRelationSchema,
  updateRelationSchema,
  createComputedNodeSchema,
  updateComputedNodeSchema,
  autoCodeSchema,
  mergeQuestionsSchema,
  importNarrativesSchema,
  importFromCanvasSchema,
  reassignCodingSchema,
} from '../middleware/validation.js';
import { nanoid } from 'nanoid';
import { logAudit } from '../middleware/auditLog.js';
import { sha256 } from '../utils/hashing.js';
import {
  searchTranscripts,
  computeCooccurrence,
  buildFrameworkMatrix,
  computeStats,
  computeComparison,
  computeWordFrequency,
  computeClusters,
  computeCodingQuery,
  computeSentiment,
  computeTreemap,
} from '../utils/textAnalysis.js';

export const canvasRoutes = Router();
export const canvasPublicRoutes = Router();

// Helper: assert authenticated (auth middleware guarantees this for protected routes)
function getAuthId(req: import('express').Request): string {
  const id = req.dashboardAccessId;
  if (!id) throw new AppError('Authentication required', 401);
  return id;
}

// Helper: verify canvas belongs to this dashboard
async function getOwnedCanvas(canvasId: string, dashboardAccessId: string) {
  const canvas = await prisma.codingCanvas.findUnique({ where: { id: canvasId } });
  if (!canvas) throw new AppError('Canvas not found', 404);
  if (canvas.dashboardAccessId !== dashboardAccessId) throw new AppError('Access denied', 403);
  return canvas;
}

// ─── Canvas CRUD ───

// GET /canvas — list canvases
canvasRoutes.get('/canvas', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const canvases = await prisma.codingCanvas.findMany({
      where: { dashboardAccessId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { transcripts: true, questions: true, codings: true } },
      },
    });
    res.json({ success: true, data: canvases });
  } catch (err) { next(err); }
});

// POST /canvas — create canvas
canvasRoutes.post('/canvas', validate(createCanvasSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const { name, description } = req.body;
    const canvas = await prisma.codingCanvas.create({
      data: { dashboardAccessId, name, description },
    });
    res.status(201).json({ success: true, data: canvas });
  } catch (err: any) {
    if (err.code === 'P2002') return next(new AppError('A canvas with this name already exists', 409));
    next(err);
  }
});

// GET /canvas/:canvasId — full detail
canvasRoutes.get('/canvas/:canvasId', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const canvas = await prisma.codingCanvas.findUnique({
      where: { id: req.params.canvasId },
      include: {
        transcripts: { orderBy: { sortOrder: 'asc' } },
        questions: { orderBy: { sortOrder: 'asc' } },
        memos: { orderBy: { createdAt: 'asc' } },
        codings: true,
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
      cases: canvas.cases.map(c => ({ ...c, attributes: JSON.parse(c.attributes) })),
      computedNodes: canvas.computedNodes.map(n => ({
        ...n,
        config: JSON.parse(n.config),
        result: JSON.parse(n.result),
      })),
    };

    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// PUT /canvas/:canvasId — update name/description
canvasRoutes.put('/canvas/:canvasId', validate(updateCanvasSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.canvasId, dashboardAccessId);
    const canvas = await prisma.codingCanvas.update({
      where: { id: req.params.canvasId },
      data: req.body,
    });
    res.json({ success: true, data: canvas });
  } catch (err: any) {
    if (err.code === 'P2002') return next(new AppError('A canvas with this name already exists', 409));
    next(err);
  }
});

// DELETE /canvas/:canvasId
canvasRoutes.delete('/canvas/:canvasId', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.canvasId, dashboardAccessId);
    await prisma.codingCanvas.delete({ where: { id: req.params.canvasId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Transcripts ───

canvasRoutes.post('/canvas/:id/transcripts', validate(createTranscriptSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    const count = await prisma.canvasTranscript.count({ where: { canvasId: req.params.id } });
    const transcript = await prisma.canvasTranscript.create({
      data: { canvasId: req.params.id, ...req.body, sortOrder: count },
    });
    res.status(201).json({ success: true, data: transcript });
  } catch (err) { next(err); }
});

canvasRoutes.put('/canvas/:id/transcripts/:tid', validate(updateTranscriptSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    const transcript = await prisma.canvasTranscript.update({
      where: { id: req.params.tid },
      data: req.body,
    });
    res.json({ success: true, data: transcript });
  } catch (err) { next(err); }
});

canvasRoutes.delete('/canvas/:id/transcripts/:tid', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    await prisma.canvasTranscript.delete({ where: { id: req.params.tid } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Questions ───

canvasRoutes.post('/canvas/:id/questions', validate(createCanvasQuestionSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    const count = await prisma.canvasQuestion.count({ where: { canvasId: req.params.id } });
    const question = await prisma.canvasQuestion.create({
      data: { canvasId: req.params.id, ...req.body, sortOrder: count },
    });
    res.status(201).json({ success: true, data: question });
  } catch (err) { next(err); }
});

canvasRoutes.put('/canvas/:id/questions/:qid', validate(updateCanvasQuestionSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    const question = await prisma.canvasQuestion.update({
      where: { id: req.params.qid },
      data: req.body,
    });
    res.json({ success: true, data: question });
  } catch (err) { next(err); }
});

canvasRoutes.delete('/canvas/:id/questions/:qid', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    await prisma.canvasQuestion.delete({ where: { id: req.params.qid } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Memos ───

canvasRoutes.post('/canvas/:id/memos', validate(createCanvasMemoSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    const memo = await prisma.canvasMemo.create({
      data: { canvasId: req.params.id, ...req.body },
    });
    res.status(201).json({ success: true, data: memo });
  } catch (err) { next(err); }
});

canvasRoutes.put('/canvas/:id/memos/:mid', validate(updateCanvasMemoSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    const memo = await prisma.canvasMemo.update({
      where: { id: req.params.mid },
      data: req.body,
    });
    res.json({ success: true, data: memo });
  } catch (err) { next(err); }
});

canvasRoutes.delete('/canvas/:id/memos/:mid', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    await prisma.canvasMemo.delete({ where: { id: req.params.mid } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Codings ───

canvasRoutes.post('/canvas/:id/codings', validate(createCodingSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
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
      data: { canvasId: req.params.id, transcriptId, questionId, startOffset, endOffset, codedText, note },
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
      meta: JSON.stringify({ canvasId: req.params.id, questionId, transcriptId, codedText: codedText.slice(0, 100) }),
    });

    res.status(201).json({ success: true, data: coding });
  } catch (err) { next(err); }
});

canvasRoutes.put('/canvas/:id/codings/:cid', validate(updateCodingSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    const oldCoding = await prisma.canvasTextCoding.findUnique({ where: { id: req.params.cid } });
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
      meta: JSON.stringify({ canvasId: req.params.id, oldAnnotation: oldCoding?.annotation, newAnnotation: coding.annotation }),
    });

    res.json({ success: true, data: coding });
  } catch (err) { next(err); }
});

canvasRoutes.delete('/canvas/:id/codings/:cid', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    const deleted = await prisma.canvasTextCoding.findUnique({ where: { id: req.params.cid } });
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
      meta: JSON.stringify({ canvasId: req.params.id, codedText: deleted?.codedText?.slice(0, 100), questionId: deleted?.questionId }),
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

canvasRoutes.put('/canvas/:id/codings/:cid/reassign', validate(reassignCodingSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    const { newQuestionId } = req.body;

    const question = await prisma.canvasQuestion.findUnique({ where: { id: newQuestionId } });
    if (!question || question.canvasId !== req.params.id) {
      return next(new AppError('Target question not found in this canvas', 400));
    }

    const oldCoding = await prisma.canvasTextCoding.findUnique({ where: { id: req.params.cid } });
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
  } catch (err) { next(err); }
});

// ─── Layout (Node Positions) ───

canvasRoutes.put('/canvas/:id/layout', validate(saveLayoutSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    const { positions } = req.body;

    await prisma.$transaction(
      positions.map((pos: any) =>
        prisma.canvasNodePosition.upsert({
          where: { canvasId_nodeId: { canvasId: req.params.id, nodeId: pos.nodeId } },
          create: { canvasId: req.params.id, ...pos },
          update: { x: pos.x, y: pos.y, width: pos.width, height: pos.height, collapsed: pos.collapsed },
        })
      )
    );

    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Cases ───

canvasRoutes.post('/canvas/:id/cases', validate(createCaseSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
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
      data: { ...caseRecord, attributes: JSON.parse(caseRecord.attributes) },
    });
  } catch (err: any) {
    if (err.code === 'P2002') return next(new AppError('A case with this name already exists in this canvas', 409));
    next(err);
  }
});

canvasRoutes.put('/canvas/:id/cases/:caseId', validate(updateCaseSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    const updateData: any = {};
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.attributes !== undefined) updateData.attributes = JSON.stringify(req.body.attributes);
    const caseRecord = await prisma.canvasCase.update({
      where: { id: req.params.caseId },
      data: updateData,
    });
    res.json({
      success: true,
      data: { ...caseRecord, attributes: JSON.parse(caseRecord.attributes) },
    });
  } catch (err: any) {
    if (err.code === 'P2002') return next(new AppError('A case with this name already exists in this canvas', 409));
    next(err);
  }
});

canvasRoutes.delete('/canvas/:id/cases/:caseId', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    await prisma.canvasCase.delete({ where: { id: req.params.caseId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Merge Questions ───

canvasRoutes.post('/canvas/:id/questions/merge', validate(mergeQuestionsSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
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
  } catch (err) { next(err); }
});

// ─── Relations ───

canvasRoutes.post('/canvas/:id/relations', validate(createRelationSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    const relation = await prisma.canvasRelation.create({
      data: { canvasId: req.params.id, ...req.body },
    });
    res.status(201).json({ success: true, data: relation });
  } catch (err) { next(err); }
});

canvasRoutes.put('/canvas/:id/relations/:relId', validate(updateRelationSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    const relation = await prisma.canvasRelation.update({
      where: { id: req.params.relId },
      data: { label: req.body.label },
    });
    res.json({ success: true, data: relation });
  } catch (err) { next(err); }
});

canvasRoutes.delete('/canvas/:id/relations/:relId', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    await prisma.canvasRelation.delete({ where: { id: req.params.relId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Computed Nodes ───

canvasRoutes.post('/canvas/:id/computed', validate(createComputedNodeSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    const { nodeType, label, config } = req.body;
    const node = await prisma.canvasComputedNode.create({
      data: {
        canvasId: req.params.id,
        nodeType,
        label,
        config: config ? JSON.stringify(config) : '{}',
      },
    });
    res.status(201).json({
      success: true,
      data: { ...node, config: JSON.parse(node.config), result: JSON.parse(node.result) },
    });
  } catch (err) { next(err); }
});

canvasRoutes.put('/canvas/:id/computed/:nodeId', validate(updateComputedNodeSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    const updateData: any = {};
    if (req.body.label !== undefined) updateData.label = req.body.label;
    if (req.body.config !== undefined) updateData.config = JSON.stringify(req.body.config);
    const node = await prisma.canvasComputedNode.update({
      where: { id: req.params.nodeId },
      data: updateData,
    });
    res.json({
      success: true,
      data: { ...node, config: JSON.parse(node.config), result: JSON.parse(node.result) },
    });
  } catch (err) { next(err); }
});

canvasRoutes.delete('/canvas/:id/computed/:nodeId', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    await prisma.canvasComputedNode.delete({ where: { id: req.params.nodeId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /canvas/:id/computed/:nodeId/run — execute computation
canvasRoutes.post('/canvas/:id/computed/:nodeId/run', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);

    const node = await prisma.canvasComputedNode.findUnique({ where: { id: req.params.nodeId } });
    if (!node || node.canvasId !== req.params.id) {
      return next(new AppError('Computed node not found', 404));
    }

    const config = JSON.parse(node.config);

    const [transcripts, questions, codings, cases] = await Promise.all([
      prisma.canvasTranscript.findMany({ where: { canvasId: req.params.id } }),
      prisma.canvasQuestion.findMany({ where: { canvasId: req.params.id } }),
      prisma.canvasTextCoding.findMany({ where: { canvasId: req.params.id } }),
      prisma.canvasCase.findMany({ where: { canvasId: req.params.id } }),
    ]);

    let result: any = {};

    switch (node.nodeType) {
      case 'search':
        result = searchTranscripts(transcripts, config.pattern || '', config.mode || 'keyword', config.transcriptIds);
        break;
      case 'cooccurrence':
        result = computeCooccurrence(codings, config.questionIds || [], config.minOverlap);
        break;
      case 'matrix':
        result = buildFrameworkMatrix(
          transcripts,
          questions,
          codings,
          cases.map(c => ({ ...c, attributes: JSON.parse(c.attributes) })),
          config.questionIds,
          config.caseIds,
        );
        break;
      case 'stats':
        result = computeStats(codings, questions, transcripts, config.groupBy || 'question', config.questionIds);
        break;
      case 'comparison':
        result = computeComparison(codings, transcripts, questions, config.transcriptIds || [], config.questionIds);
        break;
      case 'wordcloud':
        result = computeWordFrequency(codings, config.questionId, config.maxWords, config.stopWords);
        break;
      case 'cluster':
        result = computeClusters(codings, config.k || 3, config.questionIds);
        break;
      case 'codingquery':
        result = computeCodingQuery(codings, transcripts, config.conditions || []);
        break;
      case 'sentiment':
        result = computeSentiment(codings, transcripts, questions, config.scope || 'all', config.scopeId);
        break;
      case 'treemap':
        result = computeTreemap(
          codings,
          questions.map(q => ({ ...q, parentQuestionId: q.parentQuestionId })),
          config.metric || 'count',
          config.questionIds,
        );
        break;
      default:
        return next(new AppError(`Unknown node type: ${node.nodeType}`, 400));
    }

    const updated = await prisma.canvasComputedNode.update({
      where: { id: node.id },
      data: { result: JSON.stringify(result) },
    });

    res.json({
      success: true,
      data: { ...updated, config: JSON.parse(updated.config), result },
    });
  } catch (err) { next(err); }
});

// ─── Auto-Code ───

canvasRoutes.post('/canvas/:id/auto-code', validate(autoCodeSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    const { questionId, pattern, mode, transcriptIds } = req.body;

    const question = await prisma.canvasQuestion.findUnique({ where: { id: questionId } });
    if (!question || question.canvasId !== req.params.id) {
      return next(new AppError('Question not found in this canvas', 400));
    }

    const where: any = { canvasId: req.params.id };
    if (transcriptIds?.length) where.id = { in: transcriptIds };
    const transcripts = await prisma.canvasTranscript.findMany({ where });

    const searchResult = searchTranscripts(transcripts, pattern, mode);
    const matches = searchResult.matches;

    if (matches.length === 0) {
      return res.json({ success: true, data: { created: 0, matches: [] } });
    }

    const codingsToCreate = matches.map(m => ({
      canvasId: req.params.id,
      transcriptId: m.transcriptId,
      questionId,
      startOffset: m.offset,
      endOffset: m.offset + m.matchText.length,
      codedText: m.matchText,
    }));

    const created = await prisma.$transaction(
      codingsToCreate.map(c => prisma.canvasTextCoding.create({ data: c }))
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

    res.status(201).json({ success: true, data: { created: created.length, codings: created } });
  } catch (err) { next(err); }
});

// ─── Import Narratives (accepts pre-formatted narratives from bridge) ───

canvasRoutes.post('/canvas/:id/import-narratives', validate(importNarrativesSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
    const { narratives } = req.body;

    const count = await prisma.canvasTranscript.count({ where: { canvasId: req.params.id } });

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

canvasRoutes.post('/canvas/:id/import-from-canvas', validate(importFromCanvasSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);
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

// ─── Canvas Sharing ───

canvasRoutes.post('/canvas/:id/share', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);

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

canvasRoutes.get('/canvas/:id/shares', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);

    const shares = await prisma.canvasShare.findMany({
      where: { canvasId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: shares });
  } catch (err) { next(err); }
});

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
      cases: canvas.cases.map(c => ({ ...c, attributes: JSON.parse(c.attributes) })),
      computedNodes: canvas.computedNodes.map(n => ({
        ...n,
        config: JSON.parse(n.config),
        result: JSON.parse(n.result),
      })),
    };

    res.json({ success: true, data });
  } catch (err) { next(err); }
});

canvasRoutes.post('/canvas/clone/:code', async (req, res, next) => {
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

canvasRoutes.delete('/canvas/:id/share/:shareId', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId);

    const share = await prisma.canvasShare.findUnique({ where: { id: req.params.shareId } });
    if (!share || share.canvasId !== req.params.id) {
      return next(new AppError('Share not found', 404));
    }

    await prisma.canvasShare.delete({ where: { id: req.params.shareId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});
