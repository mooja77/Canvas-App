import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthId, getAuthUserId, getOwnedCanvas, safeJsonParse } from '../utils/routeHelpers.js';
import { checkAiAccess, checkHostedAiBudget } from '../middleware/planLimits.js';
import { validate } from '../middleware/validation.js';
import {
  suggestCodesSchema,
  autoCodeTranscriptSchema,
  updateAiSuggestionSchema,
  bulkActionSuggestionsSchema,
} from '../middleware/validation.js';
import {
  buildSuggestCodesPrompt,
  buildAutoCodeTranscriptPrompt,
  buildMethodsStatementPrompt,
} from '../utils/aiPrompts.js';
import { resolveAiConfig } from '../middleware/aiConfig.js';
import { calculateCostCents } from '../utils/aiCost.js';
import { aiCacheGet, aiCacheSet, aiCacheKey } from '../utils/aiCache.js';
import { findCoding } from '../utils/findCoding.js';
import { computeAiAgreement } from '../eval/aiAgreement.js';

export const aiRoutes = Router();

// Default-fallback colors for newly-suggested codes (the LLM doesn't know
// what's pleasing on the canvas — give it a curated palette to draw from).
const NEW_CODE_COLORS = ['#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B', '#10B981', '#EC4899'];

// Maps the Methodology-wizard paradigm keys to human-readable names so the
// methods-statement can name the approach. Kept in sync with the frontend
// data module (apps/frontend/src/data/methodologyParadigms.ts).
const PARADIGM_NAMES: Record<string, string> = {
  'reflexive-ta': 'Reflexive Thematic Analysis',
  'grounded-theory': 'Grounded Theory',
  framework: 'Framework Analysis',
  ipa: 'Interpretative Phenomenological Analysis (IPA)',
  'content-analysis': 'Qualitative Content Analysis',
  'discourse-narrative': 'Discourse / Narrative Analysis',
  phenomenology: 'Descriptive Phenomenology',
  'mixed-methods': 'Mixed Methods',
};

interface InlineSuggestion {
  id: string; // existing code id, or `new-${index}` for to-be-created codes
  label: string;
  color: string;
  confidence: number;
  reasoning: string;
  isNew: boolean;
}

// ─── POST /canvas/:id/ai/suggest-codes ───
aiRoutes.post(
  '/canvas/:id/ai/suggest-codes',
  checkAiAccess(),
  checkHostedAiBudget(),
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
              reasoning: s.reasoning ?? null,
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
  checkHostedAiBudget(),
  resolveAiConfig(),
  validate(autoCodeTranscriptSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      const canvas = await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      const { transcriptId, instructions } = req.body;

      // Reliability #8 — if the client provides an idempotency key and a
      // completed AiJob with that key exists, return its cached result so
      // tab-close mid-run + reopen doesn't re-run a 30-second LLM call.
      // Pending / running jobs return 409 so the client knows to keep polling
      // rather than double-charging the user.
      const idempotencyKey = (req.header('x-idempotency-key') ||
        req.header('idempotency-key') ||
        req.body?.idempotencyKey) as string | undefined;
      if (idempotencyKey) {
        const existing = await prisma.aiJob.findUnique({ where: { idempotencyKey } });
        if (existing) {
          if (existing.status === 'completed') {
            return res.json({
              success: true,
              data: existing.result ? safeJsonParse(existing.result, {}) : {},
              cached: true,
              jobId: existing.id,
            });
          }
          if (existing.status === 'failed') {
            return res.status(500).json({
              success: false,
              error: existing.error || 'Previous attempt failed',
              jobId: existing.id,
            });
          }
          // pending / running — tell the client to poll, don't double-spend
          return res.status(409).json({
            success: false,
            error: 'Job already in progress for this idempotency key',
            jobId: existing.id,
            status: existing.status,
          });
        }
      }

      const transcript = await prisma.canvasTranscript.findFirst({
        where: { id: transcriptId, canvasId: canvas.id },
      });
      if (!transcript) {
        return res.status(404).json({ success: false, error: 'Transcript not found' });
      }

      // Persist a pending AiJob row before the LLM call so a server crash
      // mid-call leaves an audit-visible "failed" or "stuck" record rather
      // than silent loss. updateOnEnd updates it to completed/failed at
      // the end of the request.
      const job = idempotencyKey
        ? await prisma.aiJob.create({
            data: {
              idempotencyKey,
              userId,
              canvasId: canvas.id,
              type: 'auto_code',
              status: 'running',
            },
          })
        : null;

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

      // Parse response — the prompt instructs the model to emit text-anchored
      // codings (`codedText` + `anchorBefore`) per spec 11. We accept the old
      // offset-style fields too for backwards compat with cached responses.
      let codings: Array<{
        questionId: string | null;
        suggestedText: string;
        startOffset?: number;
        endOffset?: number;
        codedText: string;
        anchorBefore?: string;
        confidence: number;
        reasoning?: string;
      }>;
      try {
        const parsed = JSON.parse(result.content);
        codings = parsed.codings || [];
      } catch {
        return res.status(500).json({ success: false, error: 'Failed to parse AI response' });
      }

      // Resolve offsets via text-anchored matching. LLM-emitted offsets are
      // unreliable; we instead trust the substring + anchor and look it up
      // in the actual transcript text. Codings whose substring isn't found
      // are dropped + logged as hallucinations.
      let hallucinated = 0;
      const validCodings = codings
        .map((c) => {
          if (!c.codedText || c.codedText.length === 0) return null;
          const span = findCoding(transcript.content, c.codedText, c.anchorBefore ?? null);
          if (!span) {
            hallucinated++;
            console.warn(`[ai] dropping hallucinated coding "${c.codedText.slice(0, 60)}…" in canvas ${canvas.id}`);
            return null;
          }
          return {
            questionId: c.questionId ?? null,
            suggestedText: c.suggestedText,
            startOffset: span.start,
            endOffset: span.end,
            codedText: c.codedText,
            confidence: c.confidence ?? 0,
            reasoning: c.reasoning ?? null,
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);

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
              reasoning: c.reasoning ?? null,
              status: 'pending',
            },
          }),
        ),
      );

      const responseData = {
        total: codings.length,
        valid: savedSuggestions.length,
        hallucinated,
        suggestions: savedSuggestions,
      };

      // Finalize the AiJob row so subsequent retries with the same
      // idempotency key replay the cached result instead of re-running.
      if (job) {
        await prisma.aiJob.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            result: JSON.stringify(responseData),
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            costCents: calculateCostCents(result.model, result.inputTokens, result.outputTokens),
          },
        });
      }

      res.json({
        success: true,
        data: responseData,
        ...(job ? { jobId: job.id, cached: false } : {}),
      });
    } catch (err) {
      // Mark the AiJob row failed so retries surface the error rather than
      // hanging in 'running' forever. We don't have `job` in scope inside
      // this catch (declared inside try), so re-derive via idempotencyKey.
      const idempotencyKey = (req.header('x-idempotency-key') ||
        req.header('idempotency-key') ||
        req.body?.idempotencyKey) as string | undefined;
      if (idempotencyKey) {
        await prisma.aiJob
          .updateMany({
            where: { idempotencyKey, status: { in: ['pending', 'running'] } },
            data: { status: 'failed', error: (err as Error).message?.slice(0, 500) ?? 'unknown' },
          })
          .catch(() => {});
      }
      next(err);
    }
  },
);

// ─── GET /canvas/:id/ai/jobs/:jobId — poll AiJob status (reliability #8) ───
aiRoutes.get('/canvas/:id/ai/jobs/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const userId = getAuthUserId(req);
    const canvas = await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

    const job = await prisma.aiJob.findUnique({ where: { id: req.params.jobId } });
    if (!job || job.canvasId !== canvas.id) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    res.json({
      success: true,
      data: {
        id: job.id,
        type: job.type,
        status: job.status,
        result: job.result ? safeJsonParse(job.result, {}) : null,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

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

// ─── GET /canvas/:id/ai/disclosure ───
// IRB-ready AI disclosure: what role did AI play in this canvas's coding?
// Reviewers and IRBs increasingly require this in a methods appendix.
// Reports how many codings originated from AI suggestions vs. humans, the
// accept/reject breakdown of suggestions, and which models were used — plus a
// ready-to-paste methods paragraph. All figures are computed from stored
// provenance (CanvasTextCoding.source, AiSuggestion.status, AiUsage), so the
// disclosure is reproducible, not self-reported.
aiRoutes.get('/canvas/:id/ai/disclosure', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const userId = getAuthUserId(req);
    const canvas = await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

    const [totalCodings, aiCodings, suggestionGroups, usageGroups] = await Promise.all([
      prisma.canvasTextCoding.count({ where: { canvasId: canvas.id } }),
      prisma.canvasTextCoding.count({ where: { canvasId: canvas.id, source: 'ai' } }),
      prisma.aiSuggestion.groupBy({ by: ['status'], where: { canvasId: canvas.id }, _count: true }),
      prisma.aiUsage.groupBy({ by: ['provider', 'model'], where: { canvasId: canvas.id }, _count: true }),
    ]);

    const suggestionsByStatus = (status: string) => suggestionGroups.find((g) => g.status === status)?._count ?? 0;
    const accepted = suggestionsByStatus('accepted');
    const rejected = suggestionsByStatus('rejected');
    const pending = suggestionsByStatus('pending');
    const totalSuggestions = accepted + rejected + pending;
    const humanCodings = totalCodings - aiCodings;
    const aiPercent = totalCodings > 0 ? Math.round((aiCodings / totalCodings) * 1000) / 10 : 0;
    const acceptanceRate = accepted + rejected > 0 ? Math.round((accepted / (accepted + rejected)) * 1000) / 10 : null;
    const models = usageGroups
      .map((g) => `${g.provider}/${g.model}`)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort();

    // A conservative, honest methods paragraph the researcher can adapt.
    const modelList = models.length ? models.join(', ') : 'an AI assistant';
    const markdown = [
      `## AI Disclosure`,
      ``,
      `Qualitative coding in this project was conducted with AI assistance using ${modelList}.`,
      `AI-generated code suggestions were presented for review; the researcher accepted, modified, or`,
      `rejected each suggestion. Of ${totalCodings} coded segment(s) in the final dataset,`,
      `${aiCodings} (${aiPercent}%) originated from an accepted AI suggestion and ${humanCodings} were`,
      `created manually. Across ${totalSuggestions} AI suggestion(s), ${accepted} were accepted and`,
      `${rejected} rejected${acceptanceRate !== null ? ` (${acceptanceRate}% acceptance of reviewed suggestions)` : ''}.`,
      `All AI suggestions were anchored to specific source text and reviewed by the researcher before`,
      `inclusion. AI was used as an assistive tool; final analytic decisions rest with the researcher.`,
    ].join('\n');

    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        codings: { total: totalCodings, aiOriginated: aiCodings, humanOriginated: humanCodings, aiPercent },
        suggestions: { total: totalSuggestions, accepted, rejected, pending, acceptanceRate },
        models,
        markdown,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /canvas/:id/ai/agreement ───
// "AI vs me" trust metric: treats the AI as a second coder and scores its
// suggestions against this canvas's coded set (span-IoU matching, same as the
// eval harness), plus a confidence-calibration breakdown. Lets a researcher
// see, on their OWN data, how well the AI agrees with them — the in-product
// counterpart to the offline eval harness.
aiRoutes.get('/canvas/:id/ai/agreement', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const userId = getAuthUserId(req);
    const canvas = await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

    const [finalCodings, suggestions, questions] = await Promise.all([
      prisma.canvasTextCoding.findMany({
        where: { canvasId: canvas.id },
        select: { questionId: true, startOffset: true, endOffset: true },
      }),
      prisma.aiSuggestion.findMany({
        where: { canvasId: canvas.id },
        select: { questionId: true, startOffset: true, endOffset: true, confidence: true },
      }),
      prisma.canvasQuestion.findMany({ where: { canvasId: canvas.id }, select: { id: true, text: true } }),
    ]);

    const result = computeAiAgreement(finalCodings, suggestions);

    // Map per-code question ids back to their display names.
    const nameById = new Map(questions.map((q) => [q.id, q.text]));
    const perCode = result.agreement.perCode.map((c) => ({
      questionId: c.code,
      code: nameById.get(c.code) ?? c.code,
      precision: c.precision,
      recall: c.recall,
      f1: c.f1,
      tp: c.tp,
      fp: c.fp,
      fn: c.fn,
    }));

    // Not enough signal to be meaningful — tell the client rather than show a
    // confident-looking 0%/100%.
    const ready = result.goldCount > 0 && result.predictedCount > 0;

    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        ready,
        basis:
          'AI suggestions scored against this canvas’s final coded segments by code + span overlap (IoU ≥ 0.5). Precision = of the AI’s suggestions, how many match a coded segment; recall = of the coded segments, how many the AI also suggested.',
        codedSegments: result.goldCount,
        suggestions: result.predictedCount,
        skippedSuggestions: result.skipped,
        precision: result.agreement.precision,
        recall: result.agreement.recall,
        f1: result.agreement.f1,
        tp: result.agreement.tp,
        fp: result.agreement.fp,
        fn: result.agreement.fn,
        perCode,
        calibration: result.calibration,
      },
    });
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

      // Accepting: create the code (if needed) + the coding + mark accepted,
      // ATOMICALLY and IDEMPOTENTLY. Without this, a double-click / retry (or a
      // crash between the coding-create and the status-update) created a second
      // identical coding.
      if (status === 'accepted') {
        if (suggestion.status === 'accepted') {
          // Already applied — return the existing suggestion, don't re-create.
          return res.json({ success: true, data: suggestion });
        }
        const accepted = await prisma.$transaction(async (tx) => {
          let questionId = suggestion.questionId;
          if (!questionId) {
            const question = await tx.canvasQuestion.create({
              data: { canvasId: req.params.id, text: suggestion.suggestedText },
            });
            questionId = question.id;
          }
          // Tagged AI-originated for the disclosure export.
          await tx.canvasTextCoding.create({
            data: {
              canvasId: req.params.id,
              transcriptId: suggestion.transcriptId,
              questionId,
              startOffset: suggestion.startOffset,
              endOffset: suggestion.endOffset,
              codedText: suggestion.codedText,
              source: 'ai',
            },
          });
          return tx.aiSuggestion.update({ where: { id: req.params.sid }, data: { status } });
        });
        return res.json({ success: true, data: accepted });
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
              source: 'ai',
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

// ─── POST /canvas/:id/ai/suggest-codes-inline (Sprint H) ───
// Returns ready-to-apply suggestions for the inline popover. Unlike the
// suggest-codes endpoint above, this one doesn't persist to AiSuggestion —
// suggestions are ephemeral, the user clicks-to-apply (which goes through
// the normal coding create flow) or dismisses. LRU-cached by (canvasId,
// transcriptId, selection hash) for 1hr so re-highlighting the same text
// is instant.
aiRoutes.post(
  '/canvas/:id/ai/suggest-codes-inline',
  checkAiAccess(),
  checkHostedAiBudget(),
  resolveAiConfig(),
  validate(suggestCodesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      const canvas = await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      const { transcriptId, codedText, startOffset, endOffset } = req.body;

      const transcript = await prisma.canvasTranscript.findFirst({
        where: { id: transcriptId, canvasId: canvas.id },
      });
      if (!transcript) {
        return res.status(404).json({ success: false, error: 'Transcript not found' });
      }

      const existingCodes = await prisma.canvasQuestion.findMany({
        where: { canvasId: canvas.id },
        select: { id: true, text: true, color: true },
      });

      const cacheKey = aiCacheKey([canvas.id, transcriptId, codedText]);
      const cached = aiCacheGet<InlineSuggestion[]>(cacheKey);
      if (cached) {
        return res.json({ success: true, data: { suggestions: cached, cacheHit: true } });
      }

      // Context window of 500 chars on each side, mirroring the spec.
      const contextStart = Math.max(0, startOffset - 500);
      const contextEnd = Math.min(transcript.content.length, endOffset + 500);
      const transcriptContext = transcript.content.slice(contextStart, contextEnd);

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
        maxTokens: 1024,
      });

      await prisma.aiUsage.create({
        data: {
          userId,
          canvasId: canvas.id,
          feature: 'suggest_codes_inline',
          provider: req.llmProvider.name,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costCents: calculateCostCents(result.model, result.inputTokens, result.outputTokens),
        },
      });

      let raw: Array<{
        questionId: string | null;
        suggestedText: string;
        confidence: number;
        reasoning?: string;
      }> = [];
      try {
        const parsed = JSON.parse(result.content);
        raw = parsed.suggestions || [];
      } catch {
        return res.status(500).json({ success: false, error: 'Failed to parse AI response' });
      }

      // Cap at 3 — inline UX shows 3 cards max so the popover stays compact.
      const enriched: InlineSuggestion[] = raw.slice(0, 3).map((s, i) => {
        const existing = s.questionId ? existingCodes.find((c) => c.id === s.questionId) : null;
        return {
          id: existing ? existing.id : `new-${i}`,
          label: (existing?.text ?? s.suggestedText ?? 'Untitled').slice(0, 80),
          color: existing?.color ?? NEW_CODE_COLORS[i % NEW_CODE_COLORS.length],
          confidence: typeof s.confidence === 'number' ? Math.max(0, Math.min(1, s.confidence)) : 0,
          reasoning: (s.reasoning ?? '').slice(0, 400),
          isNew: !existing,
        };
      });

      aiCacheSet(cacheKey, enriched);

      res.json({ success: true, data: { suggestions: enriched, cacheHit: false } });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /canvas/:id/ai/methods-statement (Spec 11) ───
// Aggregates the canvas's coding metadata + AI usage history + intercoder
// reliability (if a TrainingAttempt exists) and asks the LLM to write a
// publishable methods-section paragraph. Caller can paste the response
// directly into their manuscript. Optional `intercoder` field in the
// request body lets the frontend pass the result of an ad-hoc Krippendorff
// α / Cohen κ computation that isn't persisted to TrainingAttempt.
aiRoutes.post(
  '/canvas/:id/ai/methods-statement',
  checkAiAccess(),
  checkHostedAiBudget(),
  resolveAiConfig(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      const canvas = await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      const overrideIntercoder = req.body?.intercoder as { method: string; score: number; nCoders: number } | undefined;

      const [transcriptCount, totalCodings, totalCodes, aiUsageRows, latestAttempt, suggestionStats] =
        await Promise.all([
          prisma.canvasTranscript.count({ where: { canvasId: canvas.id, deletedAt: null } }),
          prisma.canvasTextCoding.count({ where: { canvasId: canvas.id } }),
          prisma.canvasQuestion.count({ where: { canvasId: canvas.id } }),
          prisma.aiUsage.groupBy({
            by: ['feature', 'provider', 'model'],
            where: { canvasId: canvas.id },
            _count: { feature: true },
          }),
          prisma.trainingAttempt.findFirst({
            where: { trainingDocument: { canvasId: canvas.id }, kappaScore: { not: null } },
            orderBy: { createdAt: 'desc' },
            select: { kappaScore: true },
          }),
          prisma.aiSuggestion.groupBy({
            by: ['status'],
            where: { canvasId: canvas.id },
            _count: { status: true },
          }),
        ]);

      const aiUsage = aiUsageRows.map((r) => ({
        feature: r.feature,
        count: r._count.feature,
        provider: r.provider,
        model: r.model,
      }));

      // Prefer the caller-supplied intercoder result (covers ad-hoc Krippendorff
      // α + Fleiss κ runs that aren't stored on TrainingAttempt). Fall back to
      // the most recent training-document Cohen κ score for legacy data.
      const intercoderResult =
        overrideIntercoder ??
        (latestAttempt?.kappaScore != null
          ? { method: "Cohen's κ", score: latestAttempt.kappaScore, nCoders: 2 }
          : undefined);

      const accepted = suggestionStats.find((s) => s.status === 'accepted')?._count.status ?? 0;
      const rejected = suggestionStats.find((s) => s.status === 'rejected')?._count.status ?? 0;
      const modified = suggestionStats.find((s) => s.status === 'modified')?._count.status ?? 0;
      const acceptanceLog = accepted + rejected + modified > 0 ? { accepted, rejected, modified } : undefined;

      const messages = buildMethodsStatementPrompt({
        canvasName: canvas.name,
        methodology: canvas.researchParadigm ? PARADIGM_NAMES[canvas.researchParadigm] : undefined,
        transcriptCount,
        totalCodings,
        totalCodes,
        intercoderResult,
        aiUsage,
        acceptanceLog,
      });

      if (!req.llmProvider) {
        return res
          .status(400)
          .json({ success: false, error: 'AI not configured. Please add your API key in Account Settings.' });
      }

      const result = await req.llmProvider.complete({
        messages,
        temperature: 0.4,
        maxTokens: 1024,
      });

      await prisma.aiUsage.create({
        data: {
          userId,
          canvasId: canvas.id,
          feature: 'methods_statement',
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
          paragraph: result.content.trim(),
          metadata: {
            canvasName: canvas.name,
            transcriptCount,
            totalCodings,
            totalCodes,
            intercoder: intercoderResult ?? null,
            aiUsage,
            acceptanceLog: acceptanceLog ?? null,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
