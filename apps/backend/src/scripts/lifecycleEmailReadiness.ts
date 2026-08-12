import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { selectTimedLifecycleEmail } from '../jobs/lifecycleEmailScheduler.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function bool(name: string): boolean {
  return process.env[name] === 'true';
}

function allowlist(): string[] {
  return [
    ...new Set(
      (process.env.LIFECYCLE_EMAIL_RECIPIENT_ALLOWLIST || '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function recipientRef(email: string): string {
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 12);
}

async function main() {
  const now = new Date();
  const exactRecipients = allowlist();
  const broadScope = bool('LIFECYCLE_EMAIL_ALLOW_ALL_RECIPIENTS');
  const scope = broadScope ? 'all_eligible' : exactRecipients.length > 0 ? 'exact_allowlist' : 'none';
  const candidates =
    scope === 'none'
      ? []
      : await prisma.user.findMany({
          where: {
            emailVerified: true,
            createdAt: { gte: new Date(now.getTime() - 90 * DAY_MS) },
            ...(broadScope ? {} : { email: { in: exactRecipients } }),
          },
          orderBy: { createdAt: 'desc' },
          take: 1000,
          select: {
            id: true,
            email: true,
            createdAt: true,
            emailPreference: {
              select: {
                lifecycle: true,
                trainingTips: true,
                inactivityNudges: true,
                unsubscribedAt: true,
                providerSuppressedAt: true,
              },
            },
          },
        });

  const due: Array<{ recipientRef: string; type: string }> = [];
  for (const user of candidates) {
    const [canvas, lastActivity, deliveries] = await Promise.all([
      prisma.codingCanvas.findFirst({
        where: { OR: [{ userId: user.id }, { dashboardAccess: { userId: user.id } }] },
        select: { id: true },
      }),
      prisma.auditLog.findFirst({
        where: { actorId: user.id },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      }),
      prisma.emailDelivery.findMany({
        where: {
          userId: user.id,
          status: { in: ['sent', 'accepted', 'delivered', 'skipped', 'failed_permanent'] },
        },
        select: { eventKey: true },
      }),
    ]);
    const type = selectTimedLifecycleEmail(
      {
        createdAt: user.createdAt,
        deliveredEventKeys: new Set(deliveries.map((delivery) => delivery.eventKey)),
        lastActivity: lastActivity?.timestamp || null,
        activated: Boolean(canvas),
      },
      now,
    );
    const preference = user.emailPreference;
    const optedIn =
      type === 'training_tip_3d'
        ? preference?.trainingTips
        : type === 'inactivity_14d'
          ? preference?.inactivityNudges
          : preference?.lifecycle;
    if (type && optedIn && !preference?.unsubscribedAt && !preference?.providerSuppressedAt) {
      due.push({ recipientRef: recipientRef(user.email), type });
    }
  }

  const [deliveryStates, subscriberSuppressions, preferenceSuppressions] = await Promise.all([
    prisma.emailDelivery.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.newsletterSubscriber.count({ where: { providerSuppressedAt: { not: null } } }),
    prisma.emailPreference.count({ where: { providerSuppressedAt: { not: null } } }),
  ]);

  const sendEnabled = bool('LIFECYCLE_EMAIL_SEND_ENABLED');
  const automationEnabled = bool('LIFECYCLE_EMAIL_AUTOMATION_ENABLED');
  const provider = process.env.RESEND_API_KEY ? 'resend' : process.env.SMTP_HOST ? 'smtp' : 'none';
  const webhookReady = provider !== 'resend' || Boolean(process.env.RESEND_WEBHOOK_SECRET);

  process.stdout.write(
    `${JSON.stringify(
      {
        checkedAt: now.toISOString(),
        mode: 'read_only',
        release: {
          sendEnabled,
          automationEnabled,
          scope,
          configuredRecipientCount: exactRecipients.length,
          provider,
          webhookReady,
          releaseReady: sendEnabled && automationEnabled && scope !== 'none' && webhookReady,
        },
        selector: {
          candidatesWithinConfiguredScope: candidates.length,
          dueWithinConfiguredScope: due.length,
          due,
        },
        persistence: {
          deliveryStates: Object.fromEntries(deliveryStates.map((row) => [row.status, row._count._all])),
          providerSuppressedAccounts: preferenceSuppressions,
          providerSuppressedSubscribers: subscriberSuppressions,
        },
      },
      null,
      2,
    )}\n`,
  );
}

main()
  .catch((error) => {
    console.error('[LifecycleReadiness] Failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
