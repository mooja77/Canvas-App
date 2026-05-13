import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthId, getAuthUserId, getOwnedCanvas } from '../utils/routeHelpers.js';
import { checkAiAccess } from '../middleware/planLimits.js';
import { validate } from '../middleware/validation.js';
import {
  suggestCodesSchema,
  autoCodeTranscriptSchema,
  updateAiSuggestionSchema,
  bulkActionSuggestionsSchema,
} from '../middleware/validation.js';
import { buildSuggestCodesPrompt, buildAutoCodeTranscriptPrompt } from '../utils/aiPrompts.js';
import { resolveAiConfig } from '../middleware/aiConfig.js';
import { calculateCostCents } from '../utils/aiCost.js';

export const aiRoutes = Router();

// ─── POST /canvas/:id/ai/suggest-codes ───
aiRoutes.post(
  '/canvas/:id/ai/suggest-codes',
  checkAiAccess(),
  resolveAiConfig(),
  validate(suggestCodesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      const canvas = await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      const { transcriptId, codedText, startOffset, endOffset } = req.body;

      // Verify transcript belongs to canvas
      const transcript = await prisma.canvasTranscript.findFirst({
        where: { id: transcriptId, canvasId: canvas.id },
      });
      if (!transcript) {
        return res.status(404).json({ success: false, error: 'Transcript not found' });
      }

      // Get existing codes
      const existingCodes = await prisma.canvasQuestion.findMany({
        where: { canvasId: canvas.id },
        select: { id: true, text: true, color: true },
      });

      // Build context (surrounding text)
      const contextStart = Math.max(0, startOffset - 200);
      const contextEnd = Math.min(transcript.content.length, endOffset + 200);
      const transcriptContext = transcript.content.slice(contextStart, contextEnd);

      // Call LLM
      const messages = buildSuggestCodesPrompt({
        codedText,
        transcriptTitle: transcript.title,
        transcriptContext,
        existingCodes,
      });

      if (!req.llmProvider) {
        return res
          .status(400)
          .json({ success: false, error: 'AI not configured. Please add your API key in Account Settings.' });
      }

      const result = await req.llmProvider.complete({
        messages,
        responseFormat: 'json',
        temperature: 0.3,
      });

      // Track usage with cost calculation
      await prisma.aiUsage.create({
        data: {
          userId,
          canvasId: canvas.id,
          feature: 'suggest_codes',
          provider: req.llmProvider.name,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costCents: calculateCostCents(result.model, result.inputTokens, result.outputTokens),
        },
      });

      // Parse response
      let suggestions: Array<{
        questionId: string | null;
        suggestedText: string;
        confidence: number;
        reasoning?: string;
      }>;
      try {
        const parsed = JSON.parse(result.content);
        suggestions = parsed.suggestions || [];
      } catch {
        return res.status(500).json({ success: false, error: 'Failed to parse AI response' });
      }

      // Save suggestions to database
      const savedSuggestions = await Promise.all(
        suggestions.map((s) =>
          prisma.aiSuggestion.create({
            data: {
              canvasId: canvas.id,
              transcriptId,
              questionId: s.questionId || null,
              suggestedText: s.suggestedText,
              startOffset,
              endOffset,
              codedText,
              confidence: s.confidence || 0,
              status: 'pending',
            },
          }),
        ),
      );

      res.json({ success: true, data: savedSuggestions });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /canvas/:id/ai/auto-code-transcript ───
aiRoutes.post(
  '/canvas/:id/ai/auto-code-transcript',
  checkAiAccess(),
  resolveAiConfig(),
  validate(autoCodeTranscriptSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      const canvas = await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      const { transcriptId, instructions } = req.body;

      const transcript = await prisma.canvasTranscript.findFirst({
        where: { id: transcriptId, canvasId: canvas.id },
      });
      if (!transcript) {
        return res.status(404).json({ success: false, error: 'Transcript not found' });
      }

      // Get existing codes
      const existingCodes = await prisma.canvasQuestion.findMany({
        where: { canvasId: canvas.id },
        select: { id: true, text: true },
      });

      // Truncate very long transcripts for the LLM context window
      const maxChars = 30000;
      const content =
        transcript.content.length > maxChars
          ? transcript.content.slice(0, maxChars) + '\n\n[...transcript truncated...]'
          : transcript.content;

      const messages = buildAutoCodeTranscriptPrompt({
        transcriptTitle: transcript.title,
        transcriptContent: content,
        existingCodes,
        instructions,
      });

      if (!req.llmProvider) {
        return res
          .status(400)
          .json({ success: false, error: 'AI not configured. Please add your API key in Account Settings.' });
      }

      const result = await req.llmProvider.complete({
        messages,
        responseFormat: 'json',
        temperature: 0.2,
        maxTokens: 4096,
      });

      // Track usage with cost calculation
      await prisma.aiUsage.create({
        data: {
          userId,
          canvasId: canvas.id,
          feature: 'auto_code',
          provider: req.llmProvider.name,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costCents: calculateCostCents(result.model, result.inputTokens, result.outputTokens),
        },
      });

      // Parse response
      let codings: Array<{
        questionId: string | null;
        suggestedText: string;
        startOffset: number;
        endOffset: number;
        codedText: string;
        confidence: number;
      }>;
      try {
        const parsed = JSON.parse(result.content);
        codings = parsed.codings || [];
      } catch {
        return res.status(500).json({ success: false, error: 'Failed to parse AI response' });
      }

      // Validate and save as suggestions
      const validCodings = codings.filter(
        (c) =>
          c.startOffset >= 0 &&
          c.endOffset > c.startOffset &&
          c.endOffset <= transcript.content.length &&
          c.codedText.length > 0,
      );

      const savedSuggestions = await Promise.all(
        validCodings.map((c) =>
          prisma.aiSuggestion.create({
            data: {
              canvasId: canvas.id,
              transcriptId,
              questionId: c.questionId || null,
              suggestedText: c.suggestedText,
              startOffset: c.startOffset,
              endOffset: c.endOffset,
              codedText: c.codedText,
              confidence: c.confidence || 0,
              status: 'pending',
            },
          }),
        ),
      );

      res.json({
        success: true,
        data: { total: codings.length, valid: savedSuggestions.length, suggestions: savedSuggestions },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /canvas/:id/ai/suggestions ───
aiRoutes.get('/canvas/:id/ai/suggestions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const userId = getAuthUserId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

    const status = (req.query.status as string) || 'pending';
    const transcriptId = req.query.transcriptId as string | undefined;

    const where: Record<string, unknown> = { canvasId: req.params.id, status };
    if (transcriptId) where.transcriptId = transcriptId;

    const suggestions = await prisma.aiSuggestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: suggestions });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /canvas/:id/ai/suggestions/:sid ───
aiRoutes.put(
  '/canvas/:id/ai/suggestions/:sid',
  validate(updateAiSuggestionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      const suggestion = await prisma.aiSuggestion.findFirst({
        where: { id: req.params.sid, canvasId: req.params.id },
      });
      if (!suggestion) {
        return res.status(404).json({ success: false, error: 'Suggestion not found' });
      }

      const { status } = req.body;

      // If accepting, create the actual coding
      if (status === 'accepted') {
        // Find or create the question (code)
        let questionId = suggestion.questionId;
        if (!questionId) {
          // Create a new code with the suggested text
          const question = await prisma.canvasQuestion.create({
            data: {
              canvasId: req.params.id,
              text: suggestion.suggestedText,
            },
          });
          questionId = question.id;
        }

        // Create the coding
        await prisma.canvasTextCoding.create({
          data: {
            canvasId: req.params.id,
            transcriptId: suggestion.transcriptId,
            questionId,
            startOffset: suggestion.startOffset,
            endOffset: suggestion.endOffset,
            codedText: suggestion.codedText,
          },
        });
      }

      const updated = await prisma.aiSuggestion.update({
        where: { id: req.params.sid },
        data: { status },
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /canvas/:id/ai/suggestions/bulk-action ───
aiRoutes.post(
  '/canvas/:id/ai/suggestions/bulk-action',
  validate(bulkActionSuggestionsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      const { suggestionIds, action } = req.body;

      if (action === 'accepted') {
        // Accept each suggestion — create codes and codings
        const suggestions = await prisma.aiSuggestion.findMany({
          where: { id: { in: suggestionIds }, canvasId: req.params.id, status: 'pending' },
        });

        for (const suggestion of suggestions) {
          let questionId = suggestion.questionId;
          if (!questionId) {
            // Check if we already created a code with the same text in this batch
            const existingCode = await prisma.canvasQuestion.findFirst({
              where: { canvasId: req.params.id, text: suggestion.suggestedText },
            });
            if (existingCode) {
              questionId = existingCode.id;
            } else {
              const question = await prisma.canvasQuestion.create({
                data: {
                  canvasId: req.params.id,
                  text: suggestion.suggestedText,
                },
              });
              questionId = question.id;
            }
          }

          await prisma.canvasTextCoding.create({
            data: {
              canvasId: req.params.id,
              transcriptId: suggestion.transcriptId,
              questionId,
              startOffset: suggestion.startOffset,
              endOffset: suggestion.endOffset,
              codedText: suggestion.codedText,
            },
          });
        }
      }

      // Update all suggestion statuses
      await prisma.aiSuggestion.updateMany({
        where: { id: { in: suggestionIds }, canvasId: req.params.id },
        data: { status: action },
      });

      res.json({ success: true, data: { updated: suggestionIds.length } });
    } catch (err) {
      next(err);
    }
  },
);
