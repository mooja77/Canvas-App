import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  validate,
  createComputedNodeSchema,
  updateComputedNodeSchema,
} from '../middleware/validation.js';
import { getAuthId, getAuthUserId, getOwnedCanvas, safeJsonParse } from '../utils/routeHelpers.js';
import {
  checkAnalysisType,
  checkAnalysisTypeOnRun,
} from '../middleware/planLimits.js';
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
  computeTimeline,
} from '../utils/textAnalysis.js';

export const computedRoutes = Router();

// ─── Computed Nodes ───

computedRoutes.post('/canvas/:id/computed', validate(createComputedNodeSchema), checkAnalysisType(), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
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
      data: { ...node, config: safeJsonParse(node.config), result: safeJsonParse(node.result) },
    });
  } catch (err) { next(err); }
});

computedRoutes.put('/canvas/:id/computed/:nodeId', validate(updateComputedNodeSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
    const updateData: any = {};
    if (req.body.label !== undefined) updateData.label = req.body.label;
    if (req.body.config !== undefined) updateData.config = JSON.stringify(req.body.config);
    const node = await prisma.canvasComputedNode.update({
      where: { id: req.params.nodeId },
      data: updateData,
    });
    res.json({
      success: true,
      data: { ...node, config: safeJsonParse(node.config), result: safeJsonParse(node.result) },
    });
  } catch (err) { next(err); }
});

computedRoutes.delete('/canvas/:id/computed/:nodeId', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
    await prisma.canvasComputedNode.delete({ where: { id: req.params.nodeId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /canvas/:id/computed/:nodeId/run — execute computation
computedRoutes.post('/canvas/:id/computed/:nodeId/run', checkAnalysisTypeOnRun(), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));

    const node = await prisma.canvasComputedNode.findUnique({ where: { id: req.params.nodeId } });
    if (!node || node.canvasId !== req.params.id) {
      return next(new AppError('Computed node not found', 404));
    }

    const config = safeJsonParse(node.config);

    const [transcripts, questions, codings, rawCases] = await Promise.all([
      prisma.canvasTranscript.findMany({
        where: { canvasId: req.params.id },
        select: { id: true, title: true, content: true, caseId: true, eventDate: true },
      }),
      prisma.canvasQuestion.findMany({
        where: { canvasId: req.params.id },
        select: { id: true, text: true, color: true, parentQuestionId: true },
      }),
      prisma.canvasTextCoding.findMany({
        where: { canvasId: req.params.id },
        select: { id: true, transcriptId: true, questionId: true, startOffset: true, endOffset: true, codedText: true },
      }),
      prisma.canvasCase.findMany({
        where: { canvasId: req.params.id },
        select: { id: true, name: true, attributes: true },
      }),
    ]);
    const cases = rawCases.map(c => ({ ...c, attributes: safeJsonParse(c.attributes) }));

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
          cases.map(c => ({ ...c, attributes: safeJsonParse(c.attributes) })),
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
      case 'timeline':
        result = computeTimeline(transcripts, codings, questions);
        break;
      case 'geomap': {
        // GeoMap: compute geographic distribution from transcript locations
        const geoTranscripts = await prisma.canvasTranscript.findMany({
          where: { canvasId: req.params.id, deletedAt: null, latitude: { not: null } },
          select: { id: true, title: true, latitude: true, longitude: true, locationName: true },
        });
        const codingCountMap = new Map<string, number>();
        for (const c of codings) {
          codingCountMap.set(c.transcriptId, (codingCountMap.get(c.transcriptId) || 0) + 1);
        }
        const allTranscriptCount = await prisma.canvasTranscript.count({
          where: { canvasId: req.params.id, deletedAt: null },
        });
        result = {
          points: geoTranscripts.map(t => ({
            transcriptId: t.id,
            title: t.title,
            latitude: t.latitude!,
            longitude: t.longitude!,
            locationName: t.locationName || '',
            codingCount: codingCountMap.get(t.id) || 0,
          })),
          totalMapped: geoTranscripts.length,
          totalUnmapped: allTranscriptCount - geoTranscripts.length,
        };
        break;
      }
      default:
        return next(new AppError(`Unknown node type: ${node.nodeType}`, 400));
    }

    const updated = await prisma.canvasComputedNode.update({
      where: { id: node.id },
      data: { result: JSON.stringify(result) },
    });

    res.json({
      success: true,
      data: { ...updated, config: safeJsonParse(updated.config), result },
    });
  } catch (err) { next(err); }
});
