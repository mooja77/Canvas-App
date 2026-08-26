/** Permanently remove canvases that have remained in Trash for 30 days. */
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
  deleted: number;
  failed: number;
  reachedLimit: boolean;
}

/**
 * Bounded, retry-safe sweep. Storage is removed before the database cascade;
 * if object storage fails, that canvas stays in Trash for a later retry.
 */
export async function pruneCanvasTrash(now: Date = new Date()): Promise<CanvasTrashPruneResult> {
  const cutoff = new Date(now.getTime() - CANVAS_TRASH_RETENTION_DAYS * DAY_MS);
  let deleted = 0;
  let failed = 0;
  const attemptedIds: string[] = [];

  while (deleted + failed < CANVAS_TRASH_MAX_PER_RUN) {
    let expired: { id: string }[];
    try {
      expired = await prisma.codingCanvas.findMany({
        where: {
          deletedAt: { lt: cutoff },
          ...(attemptedIds.length ? { id: { notIn: attemptedIds } } : {}),
        },
        select: { id: true },
        orderBy: { deletedAt: 'asc' },
        take: Math.min(CANVAS_TRASH_BATCH_SIZE, CANVAS_TRASH_MAX_PER_RUN - deleted - failed),
      });
    } catch (err) {
      logError(err as Error, { job: 'canvasTrashRetention', deleted, failed });
      break;
    }
    if (expired.length === 0) break;

    for (const canvas of expired) {
      attemptedIds.push(canvas.id);
      try {
        await deleteStoredUploads({ canvasId: canvas.id });
        await prisma.codingCanvas.delete({ where: { id: canvas.id } });
        deleted++;
      } catch (err) {
        failed++;
        logError(err as Error, { job: 'canvasTrashRetention', canvasId: canvas.id });
      }
    }

    if (expired.length < CANVAS_TRASH_BATCH_SIZE) break;
  }

  const reachedLimit = deleted + failed >= CANVAS_TRASH_MAX_PER_RUN;
  if (deleted > 0 || failed > 0) {
    logInfo('Canvas trash retention sweep complete', {
      job: 'canvasTrashRetention',
      deleted,
      failed,
      reachedLimit,
      cutoff: cutoff.toISOString(),
    });
  }
  return { deleted, failed, reachedLimit };
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
