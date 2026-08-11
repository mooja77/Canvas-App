import { prisma } from '../lib/prisma.js';
import { LIFECYCLE_BATCH_LIMIT, lifecycleTemplate, sendLifecycleEmail } from '../lib/lifecycleEmail.js';
import { logError } from '../lib/logger.js';

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const AUTOMATION_ENABLED = process.env.LIFECYCLE_EMAIL_AUTOMATION_ENABLED === 'true';
const ALLOW_ALL_RECIPIENTS = process.env.LIFECYCLE_EMAIL_ALLOW_ALL_RECIPIENTS === 'true';

export function parseRecipientAllowlist(value: string | undefined): Set<string> {
  return new Set(
    (value || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

const RECIPIENT_ALLOWLIST = parseRecipientAllowlist(process.env.LIFECYCLE_EMAIL_RECIPIENT_ALLOWLIST);

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

type LifecycleUser = {
  id: string;
  email: string;
  name: string;
  plan: string;
  createdAt: Date;
};

export type TimedLifecycleEmailType = 'onboarding_7d' | 'training_tip_3d' | 'inactivity_14d';

const TIMED_EVENT_KEYS: Record<TimedLifecycleEmailType, string> = {
  training_tip_3d: 'training_tip_3d_v1',
  onboarding_7d: 'onboarding_7d_v1',
  inactivity_14d: 'inactivity_14d_v1',
};

type LifecycleSelectionInput = {
  createdAt: Date;
  deliveredEventKeys: ReadonlySet<string>;
  lastActivity: Date | null;
};

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function deliveredEventKeys(userId: string): Promise<Set<string>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deliveries = await (prisma as any).emailDelivery.findMany({
    where: {
      userId,
      eventKey: { in: Object.values(TIMED_EVENT_KEYS) },
    },
    select: { eventKey: true },
  });
  return new Set<string>(deliveries.map((delivery: { eventKey: string }) => delivery.eventKey));
}

async function lastUserActivity(userId: string): Promise<Date | null> {
  const last = await prisma.auditLog.findFirst({
    where: { actorId: userId },
    orderBy: { timestamp: 'desc' },
    select: { timestamp: true },
  });
  return last?.timestamp || null;
}

async function sendTimedTemplate(user: LifecycleUser, type: TimedLifecycleEmailType) {
  try {
    await sendLifecycleEmail(user, lifecycleTemplate(type, user));
  } catch (err) {
    logError(err as Error, { action: 'lifecycleEmail.sendTimedTemplate', userId: user.id, type });
  }
}

/**
 * Choose at most one lifecycle message for a user in a sweep.
 *
 * Training and onboarding emails are useful only near their intended moment,
 * so they are not backfilled to legacy accounts when automation is enabled.
 * The mutually exclusive windows also prevent a newly enabled scheduler from
 * sending several overdue messages to the same person in one run.
 *
 * An inactivity email requires evidence that the user previously did
 * something. A missing activity signal means "unknown", not "inactive".
 */
export function selectTimedLifecycleEmail(
  input: LifecycleSelectionInput,
  now = new Date(),
): TimedLifecycleEmailType | null {
  const ageDays = (now.getTime() - input.createdAt.getTime()) / (24 * 60 * 60 * 1000);

  if (ageDays >= 3 && ageDays < 7 && !input.deliveredEventKeys.has(TIMED_EVENT_KEYS.training_tip_3d)) {
    return 'training_tip_3d';
  }

  if (ageDays >= 7 && ageDays < 14 && !input.deliveredEventKeys.has(TIMED_EVENT_KEYS.onboarding_7d)) {
    return 'onboarding_7d';
  }

  if (
    ageDays >= 14 &&
    input.lastActivity &&
    input.lastActivity < new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) &&
    !input.deliveredEventKeys.has(TIMED_EVENT_KEYS.inactivity_14d)
  ) {
    return 'inactivity_14d';
  }

  return null;
}

export async function processLifecycleEmails(): Promise<void> {
  if (!AUTOMATION_ENABLED) return;
  if (!ALLOW_ALL_RECIPIENTS && RECIPIENT_ALLOWLIST.size === 0) return;

  const candidates: LifecycleUser[] = await prisma.user.findMany({
    where: {
      emailVerified: true,
      createdAt: { gte: daysAgo(90) },
      ...(ALLOW_ALL_RECIPIENTS ? {} : { email: { in: Array.from(RECIPIENT_ALLOWLIST) } }),
    },
    orderBy: { createdAt: 'desc' },
    take: LIFECYCLE_BATCH_LIMIT,
    select: { id: true, email: true, name: true, plan: true, createdAt: true },
  });

  for (const user of candidates) {
    try {
      const now = new Date();
      const delivered = await deliveredEventKeys(user.id);
      const ageDays = (now.getTime() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000);
      const lastActivity = ageDays >= 14 ? await lastUserActivity(user.id) : null;
      const due = selectTimedLifecycleEmail(
        {
          createdAt: user.createdAt,
          deliveredEventKeys: delivered,
          lastActivity,
        },
        now,
      );

      if (due) {
        await sendTimedTemplate(user, due);
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

  if (!ALLOW_ALL_RECIPIENTS && RECIPIENT_ALLOWLIST.size === 0) {
    console.log(
      '[LifecycleEmailScheduler] Automation blocked: set LIFECYCLE_EMAIL_RECIPIENT_ALLOWLIST for a canary or explicitly set LIFECYCLE_EMAIL_ALLOW_ALL_RECIPIENTS=true.',
    );
    return;
  }

  const recipientScope = ALLOW_ALL_RECIPIENTS
    ? 'all eligible recipients'
    : `${RECIPIENT_ALLOWLIST.size} allowlisted recipient(s)`;
  console.log(
    `[LifecycleEmailScheduler] Started (checking every hour, batch ${LIFECYCLE_BATCH_LIMIT}, ${recipientScope})`,
  );
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
