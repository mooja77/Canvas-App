/**
 * Audit-log retention.
 *
 * /trust, /privacy and the customer DPA all state that audit and access logs
 * are held on a 90-day rolling basis. Until this job existed nothing enforced
 * that — AuditLog rows accumulated indefinitely, each carrying the actor id and
 * the request IP. This closes the gap between the published commitment and the
 * data actually retained.
 *
 * Change AUDIT_RETENTION_DAYS only alongside the public wording; a test asserts
 * the two stay in step.
 */

import { prisma } from '../lib/prisma.js';
import { logError } from '../lib/logger.js';

export const AUDIT_RETENTION_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Prune hourly: cheap, and keeps the window honest without a daily spike. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Delete audit entries older than the retention window.
 * Returns the number removed; never throws, so a failed sweep cannot take the
 * process down or stop later sweeps from running.
 */
export async function pruneAuditLogs(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - AUDIT_RETENTION_DAYS * DAY_MS);

  try {
    const { count } = await prisma.auditLog.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });
    return count;
  } catch (err) {
    logError(err as Error, { job: 'auditRetention' });
    return 0;
  }
}

export function startAuditRetentionScheduler(): void {
  if (schedulerInterval) return;

  // Sweep once at boot so a long-stopped deployment catches up immediately.
  void pruneAuditLogs();
  schedulerInterval = setInterval(() => void pruneAuditLogs(), CHECK_INTERVAL_MS);
}

export function stopAuditRetentionScheduler(): void {
  if (!schedulerInterval) return;
  clearInterval(schedulerInterval);
  schedulerInterval = null;
}
