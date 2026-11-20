import type { Request, Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getPlanLimits, higherAllowancePhrase } from '../config/plans.js';
import { AppError } from '../middleware/errorHandler.js';
import { checkFileUploadAccess, checkTranscriptionAccess, resolveRequestPlan } from '../middleware/planLimits.js';

/**
 * Free plan: ONE audio file import per account, on the customer's own
 * transcription key (utils/aiKeys.ts; we pay for no AI).
 *
 * - Counted per ACCOUNT on User.audioImportsUsed, not per browser or canvas.
 * - The account is the canvas OWNER's, the same account whose plan gates the
 *   canvas (resolveRequestPlan), so a collaborator cannot widen it.
 * - Never decremented: deleting the file does not hand the allowance back.
 *   The one import is a trial of transcription; a delete-and-reimport loop
 *   would otherwise be unlimited free imports.
 * - Enforced where the file is accepted (upload/confirm and upload/direct), in
 *   the same transaction as the FileUpload row. The earlier gate on the
 *   middleware only saves a wasted upload.
 */

export const AUDIO_IMPORT_LIMIT_CODE = 'AUDIO_IMPORT_LIMIT_REACHED';

export function audioImportLimitError(used: number, max: number): AppError {
  const better = higherAllowancePhrase(max, (l) => l.maxAudioImports);
  const upgrade = better ? `${better.charAt(0).toUpperCase()}${better.slice(1)} audio files. ` : '';
  return new AppError(
    `Your Free plan includes ${max} audio file${max === 1 ? '' : 's'}, and you have used ${max === 1 ? 'it' : 'them'}. ${upgrade}Upgrade to import more.`,
    403,
    { code: AUDIO_IMPORT_LIMIT_CODE, limit: 'maxAudioImports', current: used, max, upgrade: true },
  );
}

/** The user row that owns the canvas (email owner, or the account linked to a legacy access code). */
async function canvasOwnerUserId(canvasId: string): Promise<string | null> {
  const canvas = await prisma.codingCanvas.findUnique({
    where: { id: canvasId },
    select: { userId: true, dashboardAccess: { select: { userId: true } } },
  });
  return canvas?.userId ?? canvas?.dashboardAccess?.userId ?? null;
}

/**
 * Upload gate for the audio/video routes. Plans with file upload pass as
 * before; the Free plan passes only while its allowance is unused; anything
 * else gets the unchanged "not included" refusal.
 */
export function checkAudioUploadAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await resolveRequestPlan(req);
      const limits = getPlanLimits(plan);
      if (limits.fileUploadEnabled || !(limits.maxAudioImports > 0)) {
        return checkFileUploadAccess()(req, res, next);
      }
      const canvasId = req.params.id || req.params.canvasId;
      const ownerId = canvasId ? await canvasOwnerUserId(canvasId) : null;
      const owner = ownerId
        ? await prisma.user.findUnique({ where: { id: ownerId }, select: { audioImportsUsed: true } })
        : null;
      const used = owner?.audioImportsUsed ?? 0;
      if (used >= limits.maxAudioImports) throw audioImportLimitError(used, limits.maxAudioImports);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Transcription gate: Free may transcribe the file(s) it was allowed to import, on its own key. */
export function checkAudioTranscriptionAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await resolveRequestPlan(req);
      const limits = getPlanLimits(plan);
      if (req.userId && !limits.fileUploadEnabled && limits.maxAudioImports > 0) return next();
      return checkTranscriptionAccess()(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Count one accepted import against the canvas owner's account. Call inside
 * the transaction that creates the FileUpload row so a refused or failed
 * import never uses the allowance. Limited plans use a conditional update, so
 * two simultaneous uploads cannot both slip under the limit.
 */
export async function recordAudioImport(tx: Prisma.TransactionClient, canvasId: string, plan: string): Promise<void> {
  const canvas = await tx.codingCanvas.findUnique({
    where: { id: canvasId },
    select: { userId: true, dashboardAccess: { select: { userId: true } } },
  });
  const ownerId = canvas?.userId ?? canvas?.dashboardAccess?.userId ?? null;
  if (!ownerId) return; // unlinked legacy access code: grandfathered Pro, no account to count on
  const max = getPlanLimits(plan).maxAudioImports;
  if (Number.isFinite(max)) {
    const claimed = await tx.user.updateMany({
      where: { id: ownerId, audioImportsUsed: { lt: max } },
      data: { audioImportsUsed: { increment: 1 } },
    });
    if (claimed.count === 0) {
      const row = await tx.user.findUnique({ where: { id: ownerId }, select: { audioImportsUsed: true } });
      throw audioImportLimitError(row?.audioImportsUsed ?? max, max);
    }
  } else {
    await tx.user.update({ where: { id: ownerId }, data: { audioImportsUsed: { increment: 1 } } });
  }
}

/** What the transcription screen shows: used and allowed, for the canvas owner's account. */
export async function audioImportAllowance(canvasId: string, plan: string) {
  const max = getPlanLimits(plan).maxAudioImports;
  const ownerId = await canvasOwnerUserId(canvasId);
  const owner = ownerId
    ? await prisma.user.findUnique({ where: { id: ownerId }, select: { audioImportsUsed: true } })
    : null;
  return { audioImportsUsed: owner?.audioImportsUsed ?? 0, maxAudioImports: Number.isFinite(max) ? max : null };
}
