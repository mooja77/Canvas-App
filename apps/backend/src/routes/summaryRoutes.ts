import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthId, getAuthUserId, getOwnedCanvas } from '../utils/routeHelpers.js';
import { checkAiAccess } from '../middleware/planLimits.js';
import { validate, generateSummarySchema, updateSummarySchema } from '../middleware/validation.js';
import { complete } from '../lib/llm.js';
import '../lib/llm-openai.js';

export const summaryRoutes = Router();

const SUMMARY_PROMPTS: Record<string, string> = {
  paraphrase:
    'Paraphrase the following text in clear, concise language. Preserve the key ideas and meaning but use different wording. Keep the same level of detail.',
  abstract:
    'Write a brief academic abstract (150-250 words) summarizing the following text. Include the main themes, key findings, and significant points.',
  thematic:
    'Perform a thematic analysis of the following text. Identify and describe the main themes, patterns, and recurring ideas. Present them as a structured list with brief explanations.',
};

// ─── POST /canvas/:id/ai/summarize — Generate summary ───
summaryRoutes.post(
  '/canvas/:id/ai/summarize',
  checkAiAccess(),
  validate(generateSummarySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      const canvas = await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      const { sourceType, sourceId, summaryType } = req.body;

      // Gather source text
      let sourceText = '';

      if (sourceType === 'transcript' && sourceId) {
        const transcript = await prisma.canvasTranscript.findFirst({
          where: { id: sourceId, canvasId: canvas.id },
        });
        if (!transcript) {
          return res.status(404).json({ success: false, error: 'Transcript not found' });
        }
        sourceText = `[Transcript: ${transcript.title}]\n\n${transcript.content}`;
      } else if (sourceType === 'coding' && sourceId) {
        const coding = await prisma.canvasTextCoding.findFirst({
          where: { id: sourceId, canvasId: canvas.id },
          include: { question: { select: { text: true } } },
        });
        if (!coding) {
          return res.status(404).json({ success: false, error: 'Coding not found' });
        }
        sourceText = `[Code: ${coding.question.text}]\n\n${coding.codedText}${coding.note ? `\n\nNote: ${coding.note}` : ''}`;
      } else if (sourceType === 'question' && sourceId) {
        // Summarize all codings for a question
        const question = await prisma.canvasQuestion.findFirst({
          where: { id: sourceId, canvasId: canvas.id },
        });
        if (!question) {
          return res.status(404).json({ success: false, error: 'Question not found' });
        }
        const codings = await prisma.canvasTextCoding.findMany({
          where: { questionId: sourceId, canvasId: canvas.id },
          include: { transcript: { select: { title: true } } },
        });
        sourceText = `[Code: ${question.text}]\n\n${codings.map((c) => `From "${c.transcript.title}": ${c.codedText}`).join('\n\n')}`;
      } else if (sourceType === 'canvas') {
        // Summarize entire canvas
        const transcripts = await prisma.canvasTranscript.findMany({
          where: { canvasId: canvas.id, deletedAt: null },
          select: { title: true, content: true },
        });
        const memos = await prisma.canvasMemo.findMany({
          where: { canvasId: canvas.id },
          select: { title: true, content: true },
        });
        const questions = await prisma.canvasQuestion.findMany({
          where: { canvasId: canvas.id },
          select: { text: true },
        });

        const parts: string[] = [];
        if (questions.length > 0) {
          parts.push(`Research codes: ${questions.map((q) => q.text).join(', ')}`);
        }
        for (const t of transcripts.slice(0, 10)) {
          // Truncate to fit context
          const excerpt = t.content.length > 3000 ? t.content.slice(0, 3000) + '...' : t.content;
          parts.push(`[Transcript: ${t.title}]\n${excerpt}`);
        }
        for (const m of memos.slice(0, 5)) {
          parts.push(`[Memo: ${m.title || 'Untitled'}]\n${m.content}`);
        }
        sourceText = parts.join('\n\n---\n\n');
      } else {
        return res.status(400).json({ success: false, error: 'Invalid source type or missing sourceId' });
      }

      if (!sourceText.trim()) {
        return res.status(400).json({ success: false, error: 'No content to summarize' });
      }

      // Truncate if too long
      const maxChars = 40000;
      if (sourceText.length > maxChars) {
        sourceText = sourceText.slice(0, maxChars) + '\n\n[...content truncated...]';
      }

      const prompt = SUMMARY_PROMPTS[summaryType] || SUMMARY_PROMPTS.paraphrase;

      const result = await complete({
        messages: [
          {
            role: 'system',
            content: `You are a qualitative research assistant. ${prompt}`,
          },
          {
            role: 'user',
            content: sourceText,
          },
        ],
        temperature: 0.3,
        maxTokens: 2000,
      });

      // Save summary
      const summary = await prisma.summary.create({
        data: {
          canvasId: canvas.id,
          sourceType,
          sourceId: sourceId || null,
          summaryText: result.content,
          summaryType,
        },
      });

      // Track usage
      await prisma.aiUsage.create({
        data: {
          userId,
          canvasId: canvas.id,
          feature: 'summarize',
          provider: 'openai',
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        },
      });

      res.json({
        success: true,
        data: {
          id: summary.id,
          canvasId: summary.canvasId,
          sourceType: summary.sourceType,
          sourceId: summary.sourceId,
          summaryText: summary.summaryText,
          summaryType: summary.summaryType,
          createdAt: summary.createdAt.toISOString(),
          updatedAt: summary.updatedAt.toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /canvas/:id/summaries — List summaries ───
summaryRoutes.get(
  '/canvas/:id/summaries',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      const sourceType = req.query.sourceType as string | undefined;
      const sourceId = req.query.sourceId as string | undefined;

      const where: Record<string, unknown> = { canvasId: req.params.id };
      if (sourceType) where.sourceType = sourceType;
      if (sourceId) where.sourceId = sourceId;

      const summaries = await prisma.summary.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      const formatted = summaries.map((s) => ({
        id: s.id,
        canvasId: s.canvasId,
        sourceType: s.sourceType,
        sourceId: s.sourceId,
        summaryText: s.summaryText,
        summaryType: s.summaryType,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      }));

      res.json({ success: true, data: formatted });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PUT /canvas/:id/summaries/:sid — Edit summary ───
summaryRoutes.put(
  '/canvas/:id/summaries/:sid',
  validate(updateSummarySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      const summary = await prisma.summary.findFirst({
        where: { id: req.params.sid, canvasId: req.params.id },
      });
      if (!summary) {
        return res.status(404).json({ success: false, error: 'Summary not found' });
      }

      const updated = await prisma.summary.update({
        where: { id: req.params.sid },
        data: { summaryText: req.body.summaryText },
      });

      res.json({
        success: true,
        data: {
          id: updated.id,
          canvasId: updated.canvasId,
          sourceType: updated.sourceType,
          sourceId: updated.sourceId,
          summaryText: updated.summaryText,
          summaryType: updated.summaryType,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
