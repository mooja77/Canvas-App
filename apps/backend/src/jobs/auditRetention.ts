/**
 * Audit-log retention.
 *
 * /trust, /privacy and the customer DPA all state that audit and access logs
 * are held on a 90-day rolling basis. Nothing enforced that — AuditLog rows
 * accumulated indefinitely, each carrying the actor id and the request IP.
 *
 * Enforcement must not itself be the incident. On a table that has never been
 * pruned the backlog can be very large, and a single `deleteMany({ timestamp:
 * { lt } })` is one long transaction holding locks on a table every
 * authenticated request writes to. So this sweeps in fixed-size batches of
 * explicit ids, with a per-run ceiling: a run does bounded work and leaves the
 * remainder for the next one. Draining a backlog takes several runs by design.
 *
 * Change AUDIT_RETENTION_DAYS only alongside the public wording; a test asserts
 * the two stay in step.
 */

import { prisma } from '../lib/prisma.js';
import { logError, logInfo } from '../lib/logger.js';

export const AUDIT_RETENTION_DAYS = 90;

/** Rows deleted per statement. Small enough to keep each lock short-lived. */
export const AUDIT_PRUNE_BATCH_SIZE = 500;

/** Ceiling per run, so one sweep cannot monopolise the database. */
export const AUDIT_PRUNE_MAX_PER_RUN = 10_000;

const DAY_MS = 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
/** Let the app finish booting before the first sweep. */
const INITIAL_DELAY_MS = 5 * 60 * 1000;

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let initialTimer: ReturnType<typeof setTimeout> | null = null;

export interface AuditPruneResult {
  deleted: number;
  batches: number;
  /** Hit the per-run ceiling: more expired rows remain for the next run. */
  reachedLimit: boolean;
  /** A batch failed. Work already committed is kept; the run stops early. */
  failed: boolean;
}

/**
 * Delete audit entries older than the retention window, in bounded batches.
 * Never throws: a failed sweep must not take the process down or prevent
 * later sweeps from running.
 */
export async function pruneAuditLogs(now: Date = new Date()): Promise<AuditPruneResult> {
  const cutoff = new Date(now.getTime() - AUDIT_RETENTION_DAYS * DAY_MS);

  let deleted = 0;
  let batches = 0;
  let reachedLimit = false;
  let failed = false;

  try {
    while (deleted < AUDIT_PRUNE_MAX_PER_RUN) {
      const expired = await prisma.auditLog.findMany({
        where: { timestamp: { lt: cutoff } },
        select: { id: true },
        take: AUDIT_PRUNE_BATCH_SIZE,
      });
      if (expired.length === 0) break;

      // Delete by explicit id list rather than re-running the predicate, so
      // each statement touches exactly the rows we just identified.
      const { count } = await prisma.auditLog.deleteMany({
        where: { id: { in: expired.map((row) => row.id) } },
      });

      deleted += count;
      batches++;

      // A short batch means the tail is drained.
      if (expired.length < AUDIT_PRUNE_BATCH_SIZE) break;

      if (deleted >= AUDIT_PRUNE_MAX_PER_RUN) {
        reachedLimit = true;
        break;
      }
    }
  } catch (err) {
    failed = true;
    logError(err as Error, { job: 'auditRetention', deleted, batches });
  }

  if (deleted > 0) {
    logInfo('Audit retention sweep complete', {
      job: 'auditRetention',
      deleted,
      batches,
      reachedLimit,
      cutoff: cutoff.toISOString(),
    });
  }

  return { deleted, batches, reachedLimit, failed };
}

export function startAuditRetentionScheduler(): void {
  if (schedulerInterval) return;

  // Deliberately not at boot: a cold start already has migrations, Prisma
  // connect and scheduler wiring competing for the same connection pool.
  initialTimer = setTimeout(() => void pruneAuditLogs(), INITIAL_DELAY_MS);
  initialTimer.unref?.();

  schedulerInterval = setInterval(() => void pruneAuditLogs(), CHECK_INTERVAL_MS);
}

export function stopAuditRetentionScheduler(): void {
  if (initialTimer) {
    clearTimeout(initialTimer);
    initialTimer = null;
  }
  if (!schedulerInterval) return;
  clearInterval(schedulerInterval);
  schedulerInterval = null;
}
