import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import type { PlanLimits } from '../config/plans.js';
import {
  getPlanLimits,
  allowanceMessage,
  featureAvailabilityMessage,
  formatAllowance,
  higherAllowancePhrase,
  planLabel,
} from '../config/plans.js';
import { resolveUserOpenAiKey, transcriptionMinutesUsedThisMonth } from '../utils/transcriptionMetering.js';
import { OWNER_PLAN_INCLUDE, resolveCanvasOwnerPlan } from '../utils/ownerPlan.js';
import {
  isHostedAiEnabled,
  hostedDailyCeilingCents,
  hostedUserMonthlyCapCents,
  globalSpendTodayCents,
  userSpendThisMonthCents,
} from '../utils/hostedAiBudget.js';

interface PlanLimitError {
  success: false;
  error: string;
  code: 'PLAN_LIMIT_EXCEEDED';
  limit: string;
  current: number;
  max: number;
  /**
   * Whether buying a higher plan actually lifts this refusal. False for the
   * shared AI fair-use ceiling, which every paid tier has identically — a
   * client that pitches an upgrade there is selling a fix that does not exist.
   */
  upgrade: boolean;
}

function limitResponse(
  res: Response,
  message: string,
  limitName: string,
  current: number,
  max: number,
  opts: { upgrade?: boolean } = {},
) {
  const body: PlanLimitError = {
    success: false,
    error: message,
    code: 'PLAN_LIMIT_EXCEEDED',
    limit: limitName,
    current,
    max,
    upgrade: opts.upgrade ?? true,
  };
  return res.status(403).json(body);
}

/**
 * "The Free plan allows 5 transcripts per canvas — Student, Pro, and Team allow
 * unlimited." For per-item caps where the remedy is only ever a plan change.
 * The upgrade half is derived from PLAN_LIMITS so it cannot go stale.
 */
function capMessage(plan: string, max: number, subject: string, pick: (limits: PlanLimits) => number): string {
  const upgrade = higherAllowancePhrase(max, pick);
  return `The ${planLabel(plan)} plan allows ${formatAllowance(max)} ${subject}${upgrade ? ` — ${upgrade}` : ''}.`;
}

export async function resolveRequestPlan(req: Request): Promise<string> {
  const canvasId = req.params.id || req.params.canvasId;
  if (canvasId) {
    const requesterUserId = req.userId;
    const requesterAccessId = req.dashboardAccessId;
    const canvas = await prisma.codingCanvas.findUnique({
      where: { id: canvasId },
      select: {
        userId: true,
        dashboardAccessId: true,
        deletedAt: true,
        ...OWNER_PLAN_INCLUDE,
        collaborators: requesterUserId
          ? {
              where: { userId: requesterUserId },
              select: { id: true },
              take: 1,
            }
          : false,
      },
    });
    const hasAccess =
      canvas &&
      !canvas.deletedAt &&
      ((requesterUserId && canvas.userId === requesterUserId) ||
        (requesterAccessId && canvas.dashboardAccessId === requesterAccessId) ||
        (requesterUserId && Array.isArray(canvas.collaborators) && canvas.collaborators.length > 0));
    if (!hasAccess) return req.userPlan || 'free';

    // Owner's plan, trial overlay included; an unlinked legacy owner is
    // grandfathered to Pro. GET /canvas/:id reports the same helper's answer.
    if (canvas) return resolveCanvasOwnerPlan(canvas);
  }
  return req.userPlan || 'free';
}

async function getCanvasOwnerIds(req: Request) {
  const userId = req.userId;
  const dashboardAccessId = req.dashboardAccessId;
  return { userId, dashboardAccessId };
}

function ownerWhere(userId?: string, dashboardAccessId?: string) {
  if (userId && dashboardAccessId) {
    return { OR: [{ userId }, { dashboardAccessId }] };
  }
  if (userId) return { userId };
  if (dashboardAccessId) return { dashboardAccessId };
  return { dashboardAccessId: '__none__' };
}

/** Check canvas creation limit */
export function checkCanvasLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = await resolveRequestPlan(req);
    const limits = getPlanLimits(plan);
    if (limits.maxCanvases === Infinity) return next();

    const { userId, dashboardAccessId } = await getCanvasOwnerIds(req);
    // Only LIVE canvases consume a plan slot. Soft-deleted ones are in the
    // trash, hidden from GET /canvas, and nothing in the product ever purges
    // them — so counting them meant a Free user who deleted a canvas stayed
    // blocked at their old count forever, with no way to recover the slot.
    const count = await prisma.codingCanvas.count({
      where: { ...ownerWhere(userId, dashboardAccessId), deletedAt: null },
    });

    if (count >= limits.maxCanvases) {
      return limitResponse(
        res,
        allowanceMessage(plan, 'Canvases', limits.maxCanvases, (l) => l.maxCanvases, {
          // Restore-from-trash hits this same gate, and "delete one" is the
          // remedy that actually frees a slot there (trashed canvases no
          // longer count) - see checkCanvasLimit's count above.
          deleteHint: 'delete a canvas you no longer need',
        }),
        'maxCanvases',
        count,
        limits.maxCanvases,
      );
    }
    next();
  };
}

/** Check transcript creation limit per canvas */
export function checkTranscriptLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = await resolveRequestPlan(req);
    const limits = getPlanLimits(plan);
    if (limits.maxTranscriptsPerCanvas === Infinity) return next();

    const canvasId = req.params.id || req.params.canvasId;
    const count = await prisma.canvasTranscript.count({ where: { canvasId } });

    if (count >= limits.maxTranscriptsPerCanvas) {
      return limitResponse(
        res,
        capMessage(plan, limits.maxTranscriptsPerCanvas, 'transcripts per canvas', (l) => l.maxTranscriptsPerCanvas),
        'maxTranscriptsPerCanvas',
        count,
        limits.maxTranscriptsPerCanvas,
      );
    }
    next();
  };
}

/** Check word count limit on transcript content */
export function checkWordLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = await resolveRequestPlan(req);
    const limits = getPlanLimits(plan);
    if (limits.maxWordsPerTranscript === Infinity) return next();

    const content = req.body.content;
    if (!content || typeof content !== 'string') return next();

    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > limits.maxWordsPerTranscript) {
      return limitResponse(
        res,
        capMessage(plan, limits.maxWordsPerTranscript, 'words per transcript', (l) => l.maxWordsPerTranscript),
        'maxWordsPerTranscript',
        wordCount,
        limits.maxWordsPerTranscript,
      );
    }
    next();
  };
}

/** Check code (question) creation limit */
export function checkCodeLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = await resolveRequestPlan(req);
    const limits = getPlanLimits(plan);
    if (limits.maxCodes === Infinity) return next();

    const canvasId = req.params.id || req.params.canvasId;
    const count = await prisma.canvasQuestion.count({ where: { canvasId } });

    if (count >= limits.maxCodes) {
      return limitResponse(
        res,
        capMessage(plan, limits.maxCodes, 'codes per canvas', (l) => l.maxCodes),
        'maxCodes',
        count,
        limits.maxCodes,
      );
    }
    next();
  };
}

/** Check auto-code access */
export function checkAutoCode() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = await resolveRequestPlan(req);
    const limits = getPlanLimits(plan);
    if (!limits.autoCodeEnabled) {
      return limitResponse(
        res,
        featureAvailabilityMessage('Auto-code', (l) => l.autoCodeEnabled),
        'autoCodeEnabled',
        0,
        0,
      );
    }
    next();
  };
}

/** Check if an analysis type is allowed */
export function checkAnalysisType() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = await resolveRequestPlan(req);
    const limits = getPlanLimits(plan);

    // For computed node creation, check the nodeType
    const nodeType = req.body.nodeType;
    if (nodeType && !limits.allowedAnalysisTypes.includes(nodeType)) {
      return limitResponse(
        res,
        featureAvailabilityMessage(`${nodeType} analysis`, (l) => l.allowedAnalysisTypes.includes(nodeType)),
        'allowedAnalysisTypes',
        0,
        0,
      );
    }
    next();
  };
}

/** Check analysis type on run endpoint (nodeType is on the existing node) */
export function checkAnalysisTypeOnRun() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = await resolveRequestPlan(req);
    const limits = getPlanLimits(plan);

    const nodeId = req.params.nodeId;
    if (nodeId) {
      const node = await prisma.canvasComputedNode.findUnique({
        where: { id: nodeId },
        select: { nodeType: true },
      });
      if (node && !limits.allowedAnalysisTypes.includes(node.nodeType)) {
        return limitResponse(
          res,
          featureAvailabilityMessage(`${node.nodeType} analysis`, (l) =>
            l.allowedAnalysisTypes.includes(node.nodeType),
          ),
          'allowedAnalysisTypes',
          0,
          0,
        );
      }
    }
    next();
  };
}

/** Check share creation limit */
export function checkShareLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = await resolveRequestPlan(req);
    const limits = getPlanLimits(plan);
    if (limits.maxShares === Infinity) return next();

    const { userId, dashboardAccessId } = await getCanvasOwnerIds(req);
    const where = ownerWhere(userId, dashboardAccessId);
    // Exclude shares on trashed canvases, matching the usage figure /auth/me
    // reports. Without this the account page could read "3/5" while share
    // creation was refused - the panel contradicting the cap it describes.
    const count = await prisma.canvasShare.count({
      where: { canvas: { ...where, deletedAt: null } },
    });

    if (count >= limits.maxShares) {
      return limitResponse(
        res,
        // Was "Free plan allows 0 share codes" — an allowance, not a remedy.
        allowanceMessage(plan, 'Share codes', limits.maxShares, (l) => l.maxShares, {
          deleteHint: 'revoke a share code you no longer need',
        }),
        'maxShares',
        count,
        limits.maxShares,
      );
    }
    next();
  };
}

/** Check ethics panel access */
export function checkEthicsAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = await resolveRequestPlan(req);
    const limits = getPlanLimits(plan);
    if (!limits.ethicsEnabled) {
      return limitResponse(
        res,
        featureAvailabilityMessage('The Ethics panel', (l) => l.ethicsEnabled),
        'ethicsEnabled',
        0,
        0,
      );
    }
    next();
  };
}

/** Check cases/cross-case access */
export function checkCaseAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = await resolveRequestPlan(req);
    const limits = getPlanLimits(plan);
    if (!limits.casesEnabled) {
      return limitResponse(
        res,
        featureAvailabilityMessage('Cases', (l) => l.casesEnabled, { plural: true }),
        'casesEnabled',
        0,
        0,
      );
    }
    next();
  };
}

/** Check real multi-coder agreement access */
export function checkIntercoderAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = await resolveRequestPlan(req);
    const limits = getPlanLimits(plan);
    if (!limits.intercoderEnabled) {
      return limitResponse(
        res,
        featureAvailabilityMessage('Intercoder agreement', (l) => l.intercoderEnabled),
        'intercoderEnabled',
        0,
        0,
      );
    }
    next();
  };
}

/** Check AI feature access + daily rate limit */
export function checkAiAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Legacy access codes do not identify a billable user and cannot be
    // safely metered. Linking an email preserves grandfathered core access
    // while giving hosted AI a stable owner and usage ledger.
    if (!req.userId) {
      return res.status(403).json({
        success: false,
        error: 'Link an email account before using AI features.',
        code: 'EMAIL_ACCOUNT_REQUIRED',
      });
    }

    const plan = await resolveRequestPlan(req);
    const limits = getPlanLimits(plan);
    if (!limits.aiEnabled) {
      return limitResponse(
        res,
        featureAvailabilityMessage('AI features', (l) => l.aiEnabled, { plural: true }),
        'aiEnabled',
        0,
        0,
      );
    }

    const userId = req.userId;
    if (limits.aiRequestsPerDay !== Infinity) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const usageToday = await prisma.aiUsage.count({
        where: {
          userId,
          createdAt: { gte: todayStart },
        },
      });

      if (usageToday >= limits.aiRequestsPerDay) {
        // Every paid tier shares this ceiling (AI_REQUESTS_PER_DAY_FAIR_USE),
        // so an upgrade buys nothing here. Say so, and set upgrade:false, so
        // neither the copy nor the client offers a fix that does not exist.
        // (/pricing calling this "Unlimited" is the other half of the same
        // untruth - see the constant's doc comment in config/plans.ts.)
        const better = higherAllowancePhrase(limits.aiRequestsPerDay, (l) => l.aiRequestsPerDay);
        return limitResponse(
          res,
          better
            ? `Daily AI limit reached (${formatAllowance(limits.aiRequestsPerDay)} requests today) — ${better}. It resets at midnight.`
            : `Daily AI limit reached (${formatAllowance(limits.aiRequestsPerDay)} requests today). This is a fair-use ceiling that applies to every plan, so upgrading will not raise it; it resets at midnight.`,
          'aiRequestsPerDay',
          usageToday,
          limits.aiRequestsPerDay,
          { upgrade: Boolean(better) },
        );
      }
    }

    next();
  };
}

/**
 * Check the monthly audio-transcription allowance.
 *
 * Transcription is the one genuinely metered cost in the pricing model (Whisper
 * ~$0.006/min). The allowance is per calendar month and per plan
 * (`transcriptionMinutesPerMonth`). Three carve-outs, in order:
 *   1. Legacy access-code users (no req.userId) can't be metered per-user via
 *      AiUsage — skip, like checkAiAccess (closed grandfathered cohort).
 *   2. Users with a working BYO OpenAI key pay OpenAI directly, so they bypass
 *      the platform's metered pool entirely.
 *   3. An Infinity cap (defensive; no current plan uses it) skips the check.
 * Otherwise the user is blocked once this month's server-key minutes reach the
 * cap. Free's cap is 0, so Free has no platform transcription unless they BYO.
 */
export function checkTranscriptionMinutes() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.userId;
    if (!userId) {
      return res.status(403).json({
        success: false,
        error: 'Link an email account before using audio transcription.',
        code: 'EMAIL_ACCOUNT_REQUIRED',
      });
    }

    const ownKey = await resolveUserOpenAiKey(userId);
    if (ownKey) return next();

    const limits = getPlanLimits(await resolveRequestPlan(req));
    const cap = limits.transcriptionMinutesPerMonth;
    if (cap === Infinity) return next();

    const used = await transcriptionMinutesUsedThisMonth(userId);
    if (used >= cap) {
      // Was the one gate that already named Student. It is derived now too, so
      // it stays true if transcription ever moves between tiers.
      const moreMinutes = higherAllowancePhrase(cap, (l) => l.transcriptionMinutesPerMonth);
      const message =
        cap === 0
          ? `${featureAvailabilityMessage('Audio transcription', (l) => l.transcriptionMinutesPerMonth > 0)} Or add your own OpenAI key in AI settings.`
          : `Monthly transcription limit reached (${cap} min). Add your own OpenAI key for unlimited transcription${
              moreMinutes ? `, or upgrade — ${moreMinutes} minutes per month` : ''
            }.`;
      return limitResponse(res, message, 'transcriptionMinutesPerMonth', used, cap, {
        upgrade: cap === 0 || Boolean(moreMinutes),
      });
    }
    next();
  };
}

/**
 * Hosted-AI guardrails (see utils/hostedAiBudget.ts). A NO-OP unless hosted AI
 * is enabled (server key present + HOSTED_AI_ENABLED=true) — so by default this
 * changes nothing. When on, it bounds the platform's OpenAI spend before a
 * hosted text-AI call runs:
 *   - legacy users (no req.userId) skip (can't meter per-user);
 *   - users on their own OpenAI key bypass (their cost, not ours);
 *   - if the global daily ceiling is hit -> 503 "hosted AI paused" (retryable);
 *   - if the user's monthly hosted spend hits the cap -> 403 with an upgrade /
 *     bring-your-own-key hint.
 */
export function checkHostedAiBudget() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!isHostedAiEnabled()) return next();

    const userId = req.userId;
    if (!userId) {
      return res.status(403).json({
        success: false,
        error: 'Link an email account before using hosted AI.',
        code: 'EMAIL_ACCOUNT_REQUIRED',
      });
    }

    const ownKey = await resolveUserOpenAiKey(userId);
    if (ownKey) return next();

    if ((await globalSpendTodayCents()) >= hostedDailyCeilingCents()) {
      return res.status(503).json({
        success: false,
        error:
          'Hosted AI is paused for today (daily budget reached). Add your own OpenAI key in AI settings to keep going.',
        code: 'HOSTED_AI_PAUSED',
        retryable: true,
      });
    }

    const userMonth = await userSpendThisMonthCents(userId);
    const cap = hostedUserMonthlyCapCents();
    if (userMonth >= cap) {
      return limitResponse(
        res,
        'Monthly hosted-AI limit reached. Add your own OpenAI key for unlimited AI, or upgrade your plan.',
        'hostedAiMonthlyCents',
        userMonth,
        cap,
      );
    }
    next();
  };
}

/** Check file upload access */
export function checkFileUploadAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = await resolveRequestPlan(req);
    const limits = getPlanLimits(plan);
    if (!limits.fileUploadEnabled) {
      return limitResponse(
        res,
        featureAvailabilityMessage('File upload', (l) => l.fileUploadEnabled),
        'fileUploadEnabled',
        0,
        0,
      );
    }
    next();
  };
}

/** Check export format access */
export function checkExportFormat(fixedFormat?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = await resolveRequestPlan(req);
    const limits = getPlanLimits(plan);
    const format = fixedFormat || ((req.query.format || req.body?.format || '') as string);
    if (format && !limits.allowedExportFormats.includes(format)) {
      return limitResponse(
        res,
        featureAvailabilityMessage(`${format.toUpperCase()} export`, (l) => l.allowedExportFormats.includes(format)),
        'allowedExportFormats',
        0,
        0,
      );
    }
    next();
  };
}

/** Check repository access */
export function checkRepositoryAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = await resolveRequestPlan(req);
    const limits = getPlanLimits(plan);
    if (!limits.repositoryEnabled) {
      return limitResponse(
        res,
        featureAvailabilityMessage('The Research Repository', (l) => l.repositoryEnabled),
        'repositoryEnabled',
        0,
        0,
      );
    }
    next();
  };
}

/** Check integrations access */
export function checkIntegrationsAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = await resolveRequestPlan(req);
    const limits = getPlanLimits(plan);
    if (!limits.integrationsEnabled) {
      return limitResponse(
        res,
        // Derived, so this no longer claims Team has integrations: the flag is
        // false on every tier because the feature was retired (see plans.ts).
        featureAvailabilityMessage('Integrations', (l) => l.integrationsEnabled, { plural: true }),
        'integrationsEnabled',
        0,
        0,
      );
    }
    next();
  };
}
