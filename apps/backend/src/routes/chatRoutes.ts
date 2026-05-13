import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthId, getAuthUserId, getOwnedCanvas, safeJsonParse } from '../utils/routeHelpers.js';
import { checkAiAccess } from '../middleware/planLimits.js';
import { validate, chatQuerySchema } from '../middleware/validation.js';
import { chunkText } from '../utils/embeddings.js';
import { ragQuery } from '../utils/rag.js';
import { resolveAiConfig } from '../middleware/aiConfig.js';
import { calculateCostCents } from '../utils/aiCost.js';

export const chatRoutes = Router();

// ─── POST /canvas/:id/ai/embed — Generate embeddings for canvas data ───
chatRoutes.post(
  '/canvas/:id/ai/embed',
  checkAiAccess(),
  resolveAiConfig(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.llmProvider) {
        return res
          .status(400)
          .json({ success: false, error: 'AI not configured. Please add your API key in Account Settings.' });
      }

      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      const canvas = await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      // Gather all embeddable content
      const transcripts = await prisma.canvasTranscript.findMany({
        where: { canvasId: canvas.id, deletedAt: null },
        select: { id: true, title: true, content: true },
      });

      const codings = await prisma.canvasTextCoding.findMany({
        where: { canvasId: canvas.id },
        select: { id: true, codedText: true, note: true },
      });

      const memos = await prisma.canvasMemo.findMany({
        where: { canvasId: canvas.id },
        select: { id: true, title: true, content: true },
      });

      // Chunk all content
      interface ChunkItem {
        sourceType: string;
        sourceId: string;
        chunkIndex: number;
        chunkText: string;
      }
      const allChunks: ChunkItem[] = [];

      for (const t of transcripts) {
        const chunks = chunkText(`[Transcript: ${t.title}]\n${t.content}`);
        for (const c of chunks) {
          allChunks.push({
            sourceType: 'transcript_chunk',
            sourceId: t.id,
            chunkIndex: c.index,
            chunkText: c.text,
          });
        }
      }

      for (const c of codings) {
        const text = c.note ? `${c.codedText}\n\nNote: ${c.note}` : c.codedText;
        allChunks.push({
          sourceType: 'coding',
          sourceId: c.id,
          chunkIndex: 0,
          chunkText: text,
        });
      }

      for (const m of memos) {
        const text = m.title ? `[Memo: ${m.title}]\n${m.content}` : m.content;
        const chunks = chunkText(text);
        for (const c of chunks) {
          allChunks.push({
            sourceType: 'memo',
            sourceId: m.id,
            chunkIndex: c.index,
            chunkText: c.text,
          });
        }
      }

      if (allChunks.length === 0) {
        return res.json({ success: true, data: { embedded: 0 } });
      }

      // Delete old embeddings for this canvas
      await prisma.textEmbedding.deleteMany({ where: { canvasId: canvas.id } });

      // Batch embed (batch up to 100 at a time)
      const batchSize = 100;
      let totalEmbedded = 0;
      let totalInputTokens = 0;

      for (let i = 0; i < allChunks.length; i += batchSize) {
        const batch = allChunks.slice(i, i + batchSize);
        const texts = batch.map((c) => c.chunkText);
        const embedResults = await req.llmProvider.embedBatch(texts);

        // Save embeddings
        await prisma.textEmbedding.createMany({
          data: batch.map((c, idx) => ({
            canvasId: canvas.id,
            sourceType: c.sourceType,
            sourceId: c.sourceId,
            chunkIndex: c.chunkIndex,
            chunkText: c.chunkText,
            embedding: JSON.stringify(embedResults[idx].embedding),
          })),
        });

        totalEmbedded += batch.length;
        totalInputTokens += embedResults.reduce((sum, e) => sum + e.inputTokens, 0);
      }

      // Track usage
      await prisma.aiUsage.create({
        data: {
          userId,
          canvasId: canvas.id,
          feature: 'chat',
          provider: req.llmProvider.name,
          model: 'text-embedding-3-small',
          inputTokens: totalInputTokens,
          outputTokens: 0,
          costCents: calculateCostCents('text-embedding-3-small', totalInputTokens, 0),
        },
      });

      res.json({ success: true, data: { embedded: totalEmbedded } });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /canvas/:id/ai/chat — RAG query ───
chatRoutes.post(
  '/canvas/:id/ai/chat',
  checkAiAccess(),
  resolveAiConfig(),
  validate(chatQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.llmProvider) {
        return res
          .status(400)
          .json({ success: false, error: 'AI not configured. Please add your API key in Account Settings.' });
      }

      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      const canvas = await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      const { message } = req.body;

      // Save user message
      await prisma.chatMessage.create({
        data: {
          canvasId: canvas.id,
          userId,
          role: 'user',
          content: message,
        },
      });

      // Run RAG query
      const result = await ragQuery(canvas.id, message, req.llmProvider);

      // Save assistant message
      const assistantMsg = await prisma.chatMessage.create({
        data: {
          canvasId: canvas.id,
          role: 'assistant',
          content: result.answer,
          citations: JSON.stringify(result.citations),
        },
      });

      // Track usage
      await prisma.aiUsage.create({
        data: {
          userId,
          canvasId: canvas.id,
          feature: 'chat',
          provider: req.llmProvider.name,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costCents: calculateCostCents(result.model, result.inputTokens, result.outputTokens),
        },
      });

      res.json({
        success: true,
        data: {
          id: assistantMsg.id,
          role: 'assistant',
          content: result.answer,
          citations: result.citations,
          createdAt: assistantMsg.createdAt.toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /canvas/:id/ai/chat/history — Chat history ───
chatRoutes.get('/canvas/:id/ai/chat/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const userId = getAuthUserId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

    const rawLimit = parseInt(req.query.limit as string, 10);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 200);

    const messages = await prisma.chatMessage.findMany({
      where: { canvasId: req.params.id },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    const formatted = messages.map((m) => ({
      id: m.id,
      canvasId: m.canvasId,
      userId: m.userId,
      role: m.role,
      content: m.content,
      citations: safeJsonParse(m.citations || '[]'),
      createdAt: m.createdAt.toISOString(),
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
});
