import { prisma } from '../lib/prisma.js';
import { generateReport } from '../utils/reportGenerator.js';
import { sendEmail } from '../lib/email.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaReportSchedule = (prisma as any).reportSchedule;

const FREQUENCY_MS: Record<string, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

const FREQUENCY_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check every hour
const ERROR_THRESHOLD = 20; // alert if more than 20 errors in 1 hour
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours between alerts
const ADMIN_EMAIL = process.env.SMTP_FROM?.match(/<(.+)>/)?.[1] || 'noreply@qualcanvas.com';

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let lastAlertSent = 0;

/**
 * Check for error spikes and alert admin.
 */
async function checkErrorSpike(): Promise<void> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const errorCount = await prisma.auditLog.count({
      where: {
        timestamp: { gte: oneHourAgo },
        OR: [{ action: { contains: 'error' } }, { action: { contains: 'failed' } }, { statusCode: { gte: 500 } }],
      },
    });

    if (errorCount > ERROR_THRESHOLD && Date.now() - lastAlertSent > ALERT_COOLDOWN_MS) {
      lastAlertSent = Date.now();
      const subject = `[QualCanvas Alert] ${errorCount} errors in the last hour`;
      const html = `
        <h2>Error Spike Detected</h2>
        <p><strong>${errorCount}</strong> errors recorded in the last hour (threshold: ${ERROR_THRESHOLD}).</p>
        <p>Check the <a href="https://qualcanvas.com/admin">admin dashboard</a> for details.</p>
        <p><small>This alert will not repeat for 6 hours.</small></p>
      `;
      await sendEmail(ADMIN_EMAIL, subject, html);
      console.log(`[ReportScheduler] Error spike alert sent: ${errorCount} errors`);
    }
  } catch (err) {
    console.error('[ReportScheduler] Error spike check failed:', err);
  }
}

/**
 * Process all due report schedules.
 */
async function processSchedules(): Promise<void> {
  try {
    const now = new Date();

    // Check for error spikes before processing reports
    await checkErrorSpike();

    const schedules = await prismaReportSchedule.findMany({
      where: { enabled: true },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    for (const schedule of schedules) {
      try {
        const frequencyMs = FREQUENCY_MS[schedule.frequency] || FREQUENCY_MS.weekly;

        // Check if it's time to send
        if (schedule.lastSent) {
          const elapsed = now.getTime() - new Date(schedule.lastSent).getTime();
          if (elapsed < frequencyMs) continue;
        }

        // For weekly reports, check day of week
        if (schedule.frequency === 'weekly' && schedule.dayOfWeek != null) {
          if (now.getDay() !== schedule.dayOfWeek) continue;
        }

        const periodDays = FREQUENCY_DAYS[schedule.frequency] || 7;
        const { html, subject } = await generateReport(schedule.userId, schedule.canvasId, periodDays);

        // Send email
        if (schedule.user?.email) {
          await sendEmail(schedule.user.email, subject, html);
        }

        // Update lastSent
        await prismaReportSchedule.update({
          where: { id: schedule.id },
          data: { lastSent: now },
        });

        console.log(`[ReportScheduler] Sent report for user ${schedule.userId} (${schedule.frequency})`);
      } catch (err) {
        console.error(`[ReportScheduler] Failed to process schedule ${schedule.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[ReportScheduler] Failed to process schedules:', err);
  }
}

/**
 * Start the report scheduler (runs every hour).
 */
export function startReportScheduler(): void {
  if (schedulerInterval) return;
  console.log('[ReportScheduler] Started (checking every hour)');
  schedulerInterval = setInterval(processSchedules, CHECK_INTERVAL_MS);
  // Run once immediately on startup (after a short delay to let DB connect)
  setTimeout(processSchedules, 10_000);
}

/**
 * Stop the report scheduler.
 */
export function stopReportScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[ReportScheduler] Stopped');
  }
}
