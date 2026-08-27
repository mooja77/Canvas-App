/** Enforce the 12-month research-pilot feedback window published on /privacy. */
import { prisma } from '../lib/prisma.js';
import { logError, logInfo } from '../lib/logger.js';

export const PILOT_FEEDBACK_RETENTION_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 12 * 60 * 1000;

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let initialTimer: ReturnType<typeof setTimeout> | null = null;

export async function prunePilotFeedback(now: Date = new Date()): Promise<{ deleted: number; failed: boolean }> {
  const cutoff = new Date(now.getTime() - PILOT_FEEDBACK_RETENTION_DAYS * DAY_MS);
  try {
    const result = await prisma.pilotFeedback.deleteMany({ where: { createdAt: { lt: cutoff } } });
    if (result.count > 0) {
      logInfo('Pilot feedback retention sweep complete', {
        job: 'pilotFeedbackRetention',
        deleted: result.count,
        cutoff: cutoff.toISOString(),
      });
    }
    return { deleted: result.count, failed: false };
  } catch (error) {
    logError(error as Error, { job: 'pilotFeedbackRetention' });
    return { deleted: 0, failed: true };
  }
}

export function startPilotFeedbackRetentionScheduler(): void {
  if (schedulerInterval) return;
  initialTimer = setTimeout(() => void prunePilotFeedback(), INITIAL_DELAY_MS);
  initialTimer.unref?.();
  schedulerInterval = setInterval(() => void prunePilotFeedback(), CHECK_INTERVAL_MS);
}

export function stopPilotFeedbackRetentionScheduler(): void {
  if (initialTimer) {
    clearTimeout(initialTimer);
    initialTimer = null;
  }
  if (schedulerInterval) clearInterval(schedulerInterval);
  schedulerInterval = null;
}
