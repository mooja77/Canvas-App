import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  validate,
  validateParams,
  createComputedNodeSchema,
  updateComputedNodeSchema,
  canvasIdParam,
  canvasComputedParams,
} from '../middleware/validation.js';
import { getAuthId, getAuthUserId, getOwnedCanvas, safeJsonParse } from '../utils/routeHelpers.js';
import { checkAnalysisType, checkAnalysisTypeOnRun } from '../middleware/planLimits.js';
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

computedRoutes.post(
  '/canvas/:id/computed',
  validateParams(canvasIdParam),
  validate(createComputedNodeSchema),
  checkAnalysisType(),
  async (req, res, next) => {
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
    } catch (err) {
      next(err);
    }
  },
);

computedRoutes.put(
  '/canvas/:id/computed/:nodeId',
  validateParams(canvasComputedParams),
  validate(updateComputedNodeSchema),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {};
      if (req.body.label !== undefined) updateData.label = req.body.label;
      if (req.body.config !== undefined) updateData.config = JSON.stringify(req.body.config);
      const existing = await prisma.canvasComputedNode.findUnique({ where: { id: req.params.nodeId } });
      if (!existing || existing.canvasId !== req.params.id) {
        return next(new AppError('Computed node not found in this canvas', 404));
      }
      const node = await prisma.canvasComputedNode.update({
        where: { id: req.params.nodeId },
        data: updateData,
      });
      res.json({
        success: true,
        data: { ...node, config: safeJsonParse(node.config), result: safeJsonParse(node.result) },
      });
    } catch (err) {
      next(err);
    }
  },
);

computedRoutes.delete('/canvas/:id/computed/:nodeId', validateParams(canvasComputedParams), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));
    const existing = await prisma.canvasComputedNode.findUnique({ where: { id: req.params.nodeId } });
    if (!existing || existing.canvasId !== req.params.id) {
      return next(new AppError('Computed node not found in this canvas', 404));
    }
    await prisma.canvasComputedNode.delete({ where: { id: req.params.nodeId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /canvas/:id/computed/:nodeId/run — execute computation
computedRoutes.post(
  '/canvas/:id/computed/:nodeId/run',
  validateParams(canvasComputedParams),
  checkAnalysisTypeOnRun(),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));

      const node = await prisma.canvasComputedNode.findUnique({ where: { id: req.params.nodeId } });
      if (!node || node.canvasId !== req.params.id) {
        return next(new AppError('Computed node not found', 404));
      }

      const config = safeJsonParse(node.config);

      // Cap the size of the dataset fed into the in-memory analysis functions
      // so a runaway canvas can't OOM the backend. Pure text-analysis node
      // types (search, stats, etc.) iterate these arrays multiple times — a
      // soft cap at 50k codings / 10k transcripts keeps the worst case bounded
      // at a few hundred MB. Exceeding it is flagged on the response so the
      // UI can show a truncation warning.
      const MAX_TRANSCRIPTS = 10000;
      const MAX_CODINGS = 50000;
      const MAX_CASES = 5000;

      const [transcripts, questions, codings, rawCases, totalTranscripts, totalCodings] = await Promise.all([
        prisma.canvasTranscript.findMany({
          where: { canvasId: req.params.id },
          select: { id: true, title: true, content: true, caseId: true, eventDate: true },
          take: MAX_TRANSCRIPTS,
          orderBy: { createdAt: 'asc' },
        }),
        prisma.canvasQuestion.findMany({
          where: { canvasId: req.params.id },
          select: { id: true, text: true, color: true, parentQuestionId: true },
        }),
        prisma.canvasTextCoding.findMany({
          where: { canvasId: req.params.id },
          select: {
            id: true,
            transcriptId: true,
            questionId: true,
            startOffset: true,
            endOffset: true,
            codedText: true,
          },
          take: MAX_CODINGS,
          orderBy: { createdAt: 'asc' },
        }),
        prisma.canvasCase.findMany({
          where: { canvasId: req.params.id },
          select: { id: true, name: true, attributes: true },
          take: MAX_CASES,
        }),
        prisma.canvasTranscript.count({ where: { canvasId: req.params.id } }),
        prisma.canvasTextCoding.count({ where: { canvasId: req.params.id } }),
      ]);
      const truncated = totalTranscripts > transcripts.length || totalCodings > codings.length;
      const cases = rawCases.map((c: any) => ({ ...c, attributes: safeJsonParse(c.attributes) }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            cases.map((c: any) => ({ ...c, attributes: safeJsonParse(c.attributes) })),
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
            questions.map((q: any) => ({ ...q, parentQuestionId: q.parentQuestionId })),
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
            points: geoTranscripts.map((t: any) => ({
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

      // Surface truncation so the UI can show a warning when the computation
      // was run against a sample of the canvas rather than the full dataset.
      const resultWithMeta =
        truncated && typeof result === 'object' && result !== null
          ? {
              ...result,
              _truncated: {
                totalTranscripts,
                usedTranscripts: transcripts.length,
                totalCodings,
                usedCodings: codings.length,
              },
            }
          : result;

      const updated = await prisma.canvasComputedNode.update({
        where: { id: node.id },
        data: { result: JSON.stringify(resultWithMeta) },
      });

      res.json({
        success: true,
        data: { ...updated, config: safeJsonParse(updated.config), result: resultWithMeta },
      });
    } catch (err) {
      next(err);
    }
  },
);
