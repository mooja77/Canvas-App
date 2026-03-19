import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { getPlanLimits } from '../config/plans.js';

interface PlanLimitError {
  success: false;
  error: string;
  code: 'PLAN_LIMIT_EXCEEDED';
  limit: string;
  current: number;
  max: number;
  upgrade: true;
}

function limitResponse(res: Response, message: string, limitName: string, current: number, max: number) {
  const body: PlanLimitError = {
    success: false,
    error: message,
    code: 'PLAN_LIMIT_EXCEEDED',
    limit: limitName,
    current,
    max,
    upgrade: true,
  };
  return res.status(403).json(body);
}

function getUserPlan(req: Request): string {
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
    const plan = getUserPlan(req);
    const limits = getPlanLimits(plan);
    if (limits.maxCanvases === Infinity) return next();

    const { userId, dashboardAccessId } = await getCanvasOwnerIds(req);
    const count = await prisma.codingCanvas.count({
      where: ownerWhere(userId, dashboardAccessId),
    });

    if (count >= limits.maxCanvases) {
      return limitResponse(res, `${plan === 'free' ? 'Free' : 'Your'} plan allows ${limits.maxCanvases} canvas${limits.maxCanvases === 1 ? '' : 'es'}`, 'maxCanvases', count, limits.maxCanvases);
    }
    next();
  };
}

/** Check transcript creation limit per canvas */
export function checkTranscriptLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = getUserPlan(req);
    const limits = getPlanLimits(plan);
    if (limits.maxTranscriptsPerCanvas === Infinity) return next();

    const canvasId = req.params.id || req.params.canvasId;
    const count = await prisma.canvasTranscript.count({ where: { canvasId } });

    if (count >= limits.maxTranscriptsPerCanvas) {
      return limitResponse(res, `${plan === 'free' ? 'Free' : 'Your'} plan allows ${limits.maxTranscriptsPerCanvas} transcripts per canvas`, 'maxTranscriptsPerCanvas', count, limits.maxTranscriptsPerCanvas);
    }
    next();
  };
}

/** Check word count limit on transcript content */
export function checkWordLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = getUserPlan(req);
    const limits = getPlanLimits(plan);
    if (limits.maxWordsPerTranscript === Infinity) return next();

    const content = req.body.content;
    if (!content || typeof content !== 'string') return next();

    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > limits.maxWordsPerTranscript) {
      return limitResponse(res, `${plan === 'free' ? 'Free' : 'Your'} plan allows ${limits.maxWordsPerTranscript.toLocaleString()} words per transcript`, 'maxWordsPerTranscript', wordCount, limits.maxWordsPerTranscript);
    }
    next();
  };
}

/** Check code (question) creation limit */
export function checkCodeLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = getUserPlan(req);
    const limits = getPlanLimits(plan);
    if (limits.maxCodes === Infinity) return next();

    const canvasId = req.params.id || req.params.canvasId;
    const count = await prisma.canvasQuestion.count({ where: { canvasId } });

    if (count >= limits.maxCodes) {
      return limitResponse(res, `${plan === 'free' ? 'Free' : 'Your'} plan allows ${limits.maxCodes} codes`, 'maxCodes', count, limits.maxCodes);
    }
    next();
  };
}

/** Check auto-code access */
export function checkAutoCode() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = getUserPlan(req);
    const limits = getPlanLimits(plan);
    if (!limits.autoCodeEnabled) {
      return limitResponse(res, 'Auto-code is available on Pro and Team plans', 'autoCodeEnabled', 0, 0);
    }
    next();
  };
}

/** Check if an analysis type is allowed */
export function checkAnalysisType() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = getUserPlan(req);
    const limits = getPlanLimits(plan);

    // For computed node creation, check the nodeType
    const nodeType = req.body.nodeType;
    if (nodeType && !limits.allowedAnalysisTypes.includes(nodeType)) {
      return limitResponse(res, `${nodeType} analysis is available on Pro and Team plans`, 'allowedAnalysisTypes', 0, 0);
    }
    next();
  };
}

/** Check analysis type on run endpoint (nodeType is on the existing node) */
export function checkAnalysisTypeOnRun() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = getUserPlan(req);
    const limits = getPlanLimits(plan);

    const nodeId = req.params.nodeId;
    if (nodeId) {
      const node = await prisma.canvasComputedNode.findUnique({
        where: { id: nodeId },
        select: { nodeType: true },
      });
      if (node && !limits.allowedAnalysisTypes.includes(node.nodeType)) {
        return limitResponse(res, `${node.nodeType} analysis is available on Pro and Team plans`, 'allowedAnalysisTypes', 0, 0);
      }
    }
    next();
  };
}

/** Check share creation limit */
export function checkShareLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = getUserPlan(req);
    const limits = getPlanLimits(plan);
    if (limits.maxShares === Infinity) return next();

    const { userId, dashboardAccessId } = await getCanvasOwnerIds(req);
    const where = ownerWhere(userId, dashboardAccessId);
    const count = await prisma.canvasShare.count({
      where: { canvas: where },
    });

    if (count >= limits.maxShares) {
      return limitResponse(res, `${plan === 'free' ? 'Free' : 'Your'} plan allows ${limits.maxShares} share codes`, 'maxShares', count, limits.maxShares);
    }
    next();
  };
}

/** Check ethics panel access */
export function checkEthicsAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = getUserPlan(req);
    const limits = getPlanLimits(plan);
    if (!limits.ethicsEnabled) {
      return limitResponse(res, 'Ethics panel is available on Pro and Team plans', 'ethicsEnabled', 0, 0);
    }
    next();
  };
}

/** Check cases/cross-case access */
export function checkCaseAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = getUserPlan(req);
    const limits = getPlanLimits(plan);
    if (!limits.casesEnabled) {
      return limitResponse(res, 'Cases are available on Pro and Team plans', 'casesEnabled', 0, 0);
    }
    next();
  };
}

/** Check AI feature access + daily rate limit */
export function checkAiAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = getUserPlan(req);
    const limits = getPlanLimits(plan);
    if (!limits.aiEnabled) {
      return limitResponse(res, 'AI features are available on Pro and Team plans', 'aiEnabled', 0, 0);
    }

    // Check daily rate limit
    if (limits.aiRequestsPerDay !== Infinity) {
      const userId = req.userId;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const usageToday = await prisma.aiUsage.count({
        where: {
          userId: userId || undefined,
          createdAt: { gte: todayStart },
        },
      });

      if (usageToday >= limits.aiRequestsPerDay) {
        return limitResponse(res, `Daily AI request limit reached (${limits.aiRequestsPerDay}/day)`, 'aiRequestsPerDay', usageToday, limits.aiRequestsPerDay);
      }
    }

    next();
  };
}

/** Check file upload access */
export function checkFileUploadAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = getUserPlan(req);
    const limits = getPlanLimits(plan);
    if (!limits.fileUploadEnabled) {
      return limitResponse(res, 'File upload is available on Pro and Team plans', 'fileUploadEnabled', 0, 0);
    }
    next();
  };
}

/** Check export format access */
export function checkExportFormat() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = getUserPlan(req);
    const limits = getPlanLimits(plan);
    const format = (req.query.format || req.body?.format || '') as string;
    if (format && !limits.allowedExportFormats.includes(format)) {
      return limitResponse(res, `${format.toUpperCase()} export is available on Pro and Team plans`, 'allowedExportFormats', 0, 0);
    }
    next();
  };
}

/** Check repository access */
export function checkRepositoryAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = getUserPlan(req);
    const limits = getPlanLimits(plan);
    if (!limits.repositoryEnabled) {
      return limitResponse(res, 'Research Repository is available on Pro and Team plans', 'repositoryEnabled', 0, 0);
    }
    next();
  };
}

/** Check integrations access */
export function checkIntegrationsAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const plan = getUserPlan(req);
    const limits = getPlanLimits(plan);
    if (!limits.integrationsEnabled) {
      return limitResponse(res, 'Integrations are available on Team plans', 'integrationsEnabled', 0, 0);
    }
    next();
  };
}
