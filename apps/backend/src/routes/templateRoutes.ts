import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { getAuthId, getAuthUserId, safeJsonParse } from '../utils/routeHelpers.js';
import { checkCanvasLimit } from '../middleware/planLimits.js';
import { getPlanLimits } from '../config/plans.js';
import { trackJmsEvent } from '../lib/jms-events.js';

export const templateRoutes = Router();

// GET /canvas/templates — list public templates + the user's own
templateRoutes.get('/canvas/templates', async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const templates = await prisma.canvasTemplate.findMany({
      where: userId ? { OR: [{ isPublic: true }, { createdBy: userId }] } : { isPublic: true },
      orderBy: [{ isPublic: 'desc' }, { name: 'asc' }],
    });
    res.json({
      success: true,
      data: templates.map((t) => ({
        ...t,
        sampleQuestions: safeJsonParse(t.sampleQuestions, []),
        sampleMemos: t.sampleMemos ? safeJsonParse(t.sampleMemos, []) : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /canvas/templates/:templateId/instantiate — create a canvas from a template
// Mirrors POST /canvas but seeds transcript / codes / memos in one transaction.
templateRoutes.post('/canvas/templates/:templateId/instantiate', checkCanvasLimit(), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const userId = getAuthUserId(req);
    const { templateId } = req.params;
    const { canvasName, includeSampleData = true } = req.body as {
      canvasName?: string;
      includeSampleData?: boolean;
    };

    const template = await prisma.canvasTemplate.findUnique({ where: { id: templateId } });
    if (!template) return next(new AppError('Template not found', 404));
    // Templates marked isPublic=false are only instantiable by their creator.
    if (!template.isPublic && template.createdBy !== userId) {
      return next(new AppError('Access denied', 403));
    }

    const sampleQuestions = safeJsonParse(template.sampleQuestions, []) as { text: string; color: string }[];
    const sampleMemos = template.sampleMemos
      ? (safeJsonParse(template.sampleMemos, []) as { title: string; content: string }[])
      : [];

    const name = (canvasName?.trim() || template.name).slice(0, 120);
    const description = `Created from template: ${template.name}`;

    const canvas = await prisma.$transaction(async (tx) => {
      const c = await tx.codingCanvas.create({
        data: {
          dashboardAccessId,
          name,
          description,
          ...(userId ? { userId } : {}),
        },
      });

      // Seed codes (CanvasQuestion rows). sortOrder preserves the template
      // author's intended order in the codebook sidebar.
      for (let i = 0; i < sampleQuestions.length; i++) {
        const q = sampleQuestions[i];
        await tx.canvasQuestion.create({
          data: {
            canvasId: c.id,
            text: q.text.slice(0, 200),
            color: q.color,
            sortOrder: i,
          },
        });
      }

      if (includeSampleData) {
        await tx.canvasTranscript.create({
          data: {
            canvasId: c.id,
            title: `Sample — ${template.name}`,
            content: template.sampleTranscript,
            sortOrder: 0,
          },
        });

        for (const m of sampleMemos) {
          await tx.canvasMemo.create({
            data: {
              canvasId: c.id,
              title: m.title.slice(0, 200),
              content: m.content,
            },
          });
        }
      }

      return c;
    });

    // Post-create plan-limit race guard (same pattern as POST /canvas).
    const plan = req.userPlan || 'free';
    const limits = getPlanLimits(plan);
    if (limits.maxCanvases !== Infinity) {
      const finalCount = await prisma.codingCanvas.count({
        where: userId ? { OR: [{ userId }, { dashboardAccessId }] } : { dashboardAccessId },
      });
      if (finalCount > limits.maxCanvases) {
        await prisma.codingCanvas.delete({ where: { id: canvas.id } }).catch(() => {});
        return res.status(403).json({
          success: false,
          error: `${plan === 'free' ? 'Free' : 'Your'} plan allows ${limits.maxCanvases} canvas${limits.maxCanvases === 1 ? '' : 'es'}`,
          code: 'PLAN_LIMIT_EXCEEDED',
          limit: 'maxCanvases',
          current: limits.maxCanvases,
          max: limits.maxCanvases,
          upgrade: true,
        });
      }
    }

    void trackJmsEvent({
      name: 'template_instantiated',
      properties: {
        canvas_id: canvas.id,
        template_id: template.id,
        template_name: template.name,
        included_sample_data: includeSampleData,
      },
    });

    res.status(201).json({ success: true, data: canvas });
  } catch (err: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((err as any)?.code === 'P2002') return next(new AppError('A canvas with this name already exists', 409));
    next(err);
  }
});

// ─── User onboarding state ───

// GET /user/onboarding — read current onboarding state. Returns null for
// legacy access-code sessions (no User row exists to store state on).
templateRoutes.get('/user/onboarding', async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      // Legacy users don't have onboarding state; return a sentinel so the
      // frontend can decide whether to render the new flow or not.
      return res.json({ success: true, data: { state: null, completedAt: null, legacy: true } });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingState: true, onboardingCompletedAt: true },
    });
    if (!user) return next(new AppError('User not found', 404));

    res.json({
      success: true,
      data: {
        state: user.onboardingState ? safeJsonParse(user.onboardingState, {}) : {},
        completedAt: user.onboardingCompletedAt,
        legacy: false,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /user/onboarding — merge a partial update into onboardingState.
// Body: { state: { step?, dismissedTooltips?, checklistComplete?, ... } }
templateRoutes.patch('/user/onboarding', async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return next(new AppError('Onboarding is only tracked for email-authenticated users', 400));

    const { state: patch } = req.body as { state?: Record<string, unknown> };
    if (!patch || typeof patch !== 'object') {
      return next(new AppError('state must be an object', 400));
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingState: true },
    });
    const current = user?.onboardingState ? safeJsonParse(user.onboardingState, {}) : {};
    // Shallow merge is enough for the screens we track; deeper structures
    // (dismissedTooltips: []) get replaced atomically by the frontend.
    const merged = { ...current, ...patch };
    // Cap stored size — the frontend should never need more than a few KB.
    const serialized = JSON.stringify(merged);
    if (serialized.length > 16_384) {
      return next(new AppError('Onboarding state too large', 413));
    }

    await prisma.user.update({
      where: { id: userId },
      data: { onboardingState: serialized },
    });

    res.json({ success: true, data: { state: merged } });
  } catch (err) {
    next(err);
  }
});

// POST /user/onboarding/complete — mark the new-user flow complete. Idempotent.
templateRoutes.post('/user/onboarding/complete', async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return next(new AppError('Onboarding is only tracked for email-authenticated users', 400));

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingCompletedAt: true },
    });
    if (!user) return next(new AppError('User not found', 404));

    // Only set the timestamp once. Re-running the flow after completion
    // (e.g. for QA) doesn't move the recorded first-completion time.
    if (!user.onboardingCompletedAt) {
      await prisma.user.update({
        where: { id: userId },
        data: { onboardingCompletedAt: new Date() },
      });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
