/** Permanently remove canvases that have remained in Trash for 30 days. */
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logError, logInfo } from '../lib/logger.js';
import { deleteStoredUploads } from '../utils/fileCleanup.js';

export const CANVAS_TRASH_RETENTION_DAYS = 30;
export const CANVAS_TRASH_BATCH_SIZE = 25;
export const CANVAS_TRASH_MAX_PER_RUN = 250;

const DAY_MS = 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 10 * 60 * 1000;

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let initialTimer: ReturnType<typeof setTimeout> | null = null;

export interface CanvasTrashPruneResult {
  /** Canvas rows removed from the database. */
  deleted: number;
  /** Candidates that were no longer expired when re-checked under lock (restored, or purged by another worker). */
  skipped: number;
  /** Database deletions that threw; the canvas stays in Trash for a later run. */
  failed: number;
  /** Upload objects whose storage delete failed AFTER the canvas row was gone. Their FileUpload rows remain (canvasId null) for a later orphan sweep. */
  orphanedUploads: number;
  reachedLimit: boolean;
}

/**
 * Bounded, retry-safe sweep.
 *
 * Order per canvas: (1) inside one transaction, re-check `deletedAt < cutoff`
 * with `SELECT ... FOR UPDATE` so a restore that commits between the batch
 * query and the delete makes us skip; (2) delete the row in that transaction;
 * (3) delete object storage only after commit. Storage used to go first, so a
 * canvas restored mid-sweep was still hard-deleted with its uploads already
 * gone. An orphaned object is recoverable; a deleted restored canvas is not.
 */
export async function pruneCanvasTrash(now: Date = new Date()): Promise<CanvasTrashPruneResult> {
  const cutoff = new Date(now.getTime() - CANVAS_TRASH_RETENTION_DAYS * DAY_MS);
  let deleted = 0;
  let skipped = 0;
  let failed = 0;
  let orphanedUploads = 0;
  const attemptedIds: string[] = [];
  const attempted = () => deleted + skipped + failed;

  while (attempted() < CANVAS_TRASH_MAX_PER_RUN) {
    let expired: { id: string }[];
    try {
      expired = await prisma.codingCanvas.findMany({
        where: {
          deletedAt: { lt: cutoff },
          ...(attemptedIds.length ? { id: { notIn: attemptedIds } } : {}),
        },
        select: { id: true },
        orderBy: { deletedAt: 'asc' },
        take: Math.min(CANVAS_TRASH_BATCH_SIZE, CANVAS_TRASH_MAX_PER_RUN - attempted()),
      });
    } catch (err) {
      logError(err as Error, { job: 'canvasTrashRetention', deleted, skipped, failed });
      break;
    }
    if (expired.length === 0) break;

    for (const canvas of expired) {
      attemptedIds.push(canvas.id);

      // null = the row is no longer an expired trash row; otherwise the ids of
      // the FileUpload rows that pointed at it (FileUpload.canvasId is SetNull
      // on canvas delete, so they must be captured before the delete).
      let uploadIds: string[] | null;
      try {
        uploadIds = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const locked = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM "CodingCanvas" WHERE id = ${canvas.id} AND "deletedAt" < ${cutoff} FOR UPDATE`;
          if (locked.length === 0) return null;
          const uploads = await tx.fileUpload.findMany({ where: { canvasId: canvas.id }, select: { id: true } });
          await tx.codingCanvas.delete({ where: { id: canvas.id } });
          return uploads.map((upload) => upload.id);
        });
      } catch (err) {
        failed++;
        logError(err as Error, { job: 'canvasTrashRetention', canvasId: canvas.id });
        continue;
      }

      if (uploadIds === null) {
        skipped++;
        logInfo('Canvas left Trash before purge; skipped', { job: 'canvasTrashRetention', canvasId: canvas.id });
        continue;
      }
      deleted++;

      if (uploadIds.length > 0) {
        try {
          await deleteStoredUploads({ id: { in: uploadIds } });
        } catch (err) {
          orphanedUploads += uploadIds.length;
          logError(err as Error, { job: 'canvasTrashRetention', canvasId: canvas.id, orphanedUploadIds: uploadIds });
        }
      }
    }

    if (expired.length < CANVAS_TRASH_BATCH_SIZE) break;
  }

  const reachedLimit = attempted() >= CANVAS_TRASH_MAX_PER_RUN;
  if (attempted() > 0) {
    logInfo('Canvas trash retention sweep complete', {
      job: 'canvasTrashRetention',
      deleted,
      skipped,
      failed,
      orphanedUploads,
      reachedLimit,
      cutoff: cutoff.toISOString(),
    });
  }
  return { deleted, skipped, failed, orphanedUploads, reachedLimit };
}

export function startCanvasTrashRetentionScheduler(): void {
  if (schedulerInterval) return;
  initialTimer = setTimeout(() => void pruneCanvasTrash(), INITIAL_DELAY_MS);
  initialTimer.unref?.();
  schedulerInterval = setInterval(() => void pruneCanvasTrash(), CHECK_INTERVAL_MS);
}

export function stopCanvasTrashRetentionScheduler(): void {
  if (initialTimer) {
    clearTimeout(initialTimer);
    initialTimer = null;
  }
  if (schedulerInterval) clearInterval(schedulerInterval);
  schedulerInterval = null;
}
