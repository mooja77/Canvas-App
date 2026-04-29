import { prisma } from '../lib/prisma.js';
import { LIFECYCLE_BATCH_LIMIT, lifecycleTemplate, sendLifecycleEmail } from '../lib/lifecycleEmail.js';
import { logError } from '../lib/logger.js';

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const AUTOMATION_ENABLED = process.env.LIFECYCLE_EMAIL_AUTOMATION_ENABLED === 'true';

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

type LifecycleUser = {
  id: string;
  email: string;
  name: string;
  plan: string;
  createdAt: Date;
};

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function hasDelivery(userId: string, eventKey: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const found = await (prisma as any).emailDelivery.findUnique({
    where: { userId_eventKey: { userId, eventKey } },
    select: { id: true },
  });
  return !!found;
}

async function lastUserActivity(userId: string): Promise<Date | null> {
  const last = await prisma.auditLog.findFirst({
    where: { actorId: userId },
    orderBy: { timestamp: 'desc' },
    select: { timestamp: true },
  });
  return last?.timestamp || null;
}

async function sendTimedTemplate(user: LifecycleUser, type: 'onboarding_7d' | 'training_tip_3d' | 'inactivity_14d') {
  try {
    await sendLifecycleEmail(user, lifecycleTemplate(type, user));
  } catch (err) {
    logError(err as Error, { action: 'lifecycleEmail.sendTimedTemplate', userId: user.id, type });
  }
}

export async function processLifecycleEmails(): Promise<void> {
  if (!AUTOMATION_ENABLED) return;

  const candidates: LifecycleUser[] = await prisma.user.findMany({
    where: {
      emailVerified: true,
      createdAt: { gte: daysAgo(90) },
    },
    orderBy: { createdAt: 'desc' },
    take: LIFECYCLE_BATCH_LIMIT,
    select: { id: true, email: true, name: true, plan: true, createdAt: true },
  });

  for (const user of candidates) {
    try {
      const ageMs = Date.now() - user.createdAt.getTime();
      const ageDays = ageMs / (24 * 60 * 60 * 1000);

      if (ageDays >= 3 && !(await hasDelivery(user.id, 'training_tip_3d_v1'))) {
        await sendTimedTemplate(user, 'training_tip_3d');
      }

      if (ageDays >= 7 && !(await hasDelivery(user.id, 'onboarding_7d_v1'))) {
        await sendTimedTemplate(user, 'onboarding_7d');
      }

      if (ageDays >= 14 && !(await hasDelivery(user.id, 'inactivity_14d_v1'))) {
        const lastActivity = await lastUserActivity(user.id);
        if (!lastActivity || lastActivity < daysAgo(14)) {
          await sendTimedTemplate(user, 'inactivity_14d');
        }
      }
    } catch (err) {
      logError(err as Error, { action: 'lifecycleEmail.processUser', userId: user.id });
    }
  }
}

export function startLifecycleEmailScheduler(): void {
  if (schedulerInterval) return;

  if (!AUTOMATION_ENABLED) {
    console.log(
      '[LifecycleEmailScheduler] Automation disabled. Set LIFECYCLE_EMAIL_AUTOMATION_ENABLED=true to enable.',
    );
    return;
  }

  console.log(`[LifecycleEmailScheduler] Started (checking every hour, batch ${LIFECYCLE_BATCH_LIMIT})`);
  schedulerInterval = setInterval(() => {
    processLifecycleEmails().catch((err) => logError(err as Error, { action: 'lifecycleEmail.processAll' }));
  }, CHECK_INTERVAL_MS);

  setTimeout(() => {
    processLifecycleEmails().catch((err) => logError(err as Error, { action: 'lifecycleEmail.initialRun' }));
  }, 15_000);
}

export function stopLifecycleEmailScheduler(): void {
  if (!schedulerInterval) return;
  clearInterval(schedulerInterval);
  schedulerInterval = null;
  console.log('[LifecycleEmailScheduler] Stopped');
}
