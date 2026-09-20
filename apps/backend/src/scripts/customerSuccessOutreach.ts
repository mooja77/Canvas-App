import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import {
  customerSuccessOutreachTemplate,
  lifecycleReleaseGateError,
  sendLifecycleEmail,
  type CustomerSuccessOutreachKind,
} from '../lib/lifecycleEmail.js';
import { INTERNAL_EMAILS, isTestAccountEmail } from '../utils/testAccounts.js';

const BAD_OUTCOMES = ['bounced', 'complained', 'suppressed', 'failed_permanent'];

function ref(email: string): string {
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 12);
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function classify(
  user: {
    firstValueAt: Date | null;
    subscription: { status: string; currentPeriodEnd: Date } | null;
  },
  now: Date,
): CustomerSuccessOutreachKind | null {
  const subscription = user.subscription;
  if (subscription && ['active', 'trialing'].includes(subscription.status) && subscription.currentPeriodEnd > now) {
    return 'existing';
  }
  if (subscription?.status === 'canceled' && subscription.currentPeriodEnd <= now) return 'former';
  if (!subscription && user.firstValueAt) return 'existing';
  return null;
}

async function candidates(kind: CustomerSuccessOutreachKind) {
  const now = new Date();
  const users = await prisma.user.findMany({
    where: { emailVerified: true },
    include: {
      subscription: { select: { status: true, currentPeriodEnd: true } },
      emailPreference: {
        select: {
          lifecycle: true,
          productUpdates: true,
          unsubscribedAt: true,
          providerSuppressedAt: true,
        },
      },
      emailDeliveries: {
        where: {
          OR: [{ eventKey: `portfolio_onboarding_2026_09_21_${kind}` }, { status: { in: BAD_OUTCOMES } }],
        },
        select: { eventKey: true, status: true },
      },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  return users.filter((user) => {
    if (classify(user, now) !== kind) return false;
    if (isTestAccountEmail(user.email) || !validEmail(user.email)) return false;
    const preference = user.emailPreference;
    if (!preference || preference.unsubscribedAt || preference.providerSuppressedAt) return false;
    if (kind === 'existing' ? !preference.lifecycle : !preference.productUpdates) return false;
    if (user.emailDeliveries.some((delivery) => BAD_OUTCOMES.includes(delivery.status))) return false;
    if (user.emailDeliveries.some((delivery) => delivery.eventKey === `portfolio_onboarding_2026_09_21_${kind}`)) {
      return false;
    }
    return true;
  });
}

async function internalCanary(kind: CustomerSuccessOutreachKind) {
  const user = await prisma.user.findFirst({
    where: {
      email: { in: INTERNAL_EMAILS },
      emailVerified: true,
      OR: [{ emailPreference: null }, { emailPreference: { is: { providerSuppressedAt: null } } }],
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!user) throw new Error(`No opted-in, verified internal account exists for the ${kind} canary`);

  const template = customerSuccessOutreachTemplate(kind, user);
  return {
    recipientRef: ref(user.email),
    outcome: await sendLifecycleEmail(
      user,
      {
        ...template,
        eventKey: `internal_canary_${template.eventKey}`,
      },
      undefined,
      { internalCanary: true },
    ),
  };
}

async function deliveryOutcomes(kind: CustomerSuccessOutreachKind) {
  const rows = await prisma.emailDelivery.groupBy({
    by: ['status'],
    where: { eventKey: `portfolio_onboarding_2026_09_21_${kind}` },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
}

async function main() {
  const action = process.argv[2] || 'audit';
  const requestedKind = process.argv[3];
  const kinds: CustomerSuccessOutreachKind[] =
    requestedKind === 'existing' || requestedKind === 'former' ? [requestedKind] : ['existing', 'former'];

  if (!['audit', 'canary', 'send', 'outcomes'].includes(action)) {
    throw new Error('Usage: customerSuccessOutreach.ts audit|canary|send|outcomes [existing|former]');
  }

  const output: Record<string, unknown> = { checkedAt: new Date().toISOString(), action };
  for (const kind of kinds) {
    if (action === 'outcomes') {
      output[kind] = await deliveryOutcomes(kind);
      continue;
    }
    if (action === 'canary') {
      const gate = lifecycleReleaseGateError();
      if (gate) throw new Error(gate);
      output[kind] = await internalCanary(kind);
      continue;
    }

    const eligible = await candidates(kind);
    if (action === 'audit') {
      output[kind] = { eligible: eligible.length, recipientRefs: eligible.map((user) => ref(user.email)) };
      continue;
    }

    const gate = lifecycleReleaseGateError();
    if (gate) throw new Error(gate);
    const outcomes = { accepted: 0, skipped: 0, failed: 0 };
    for (const user of eligible) {
      const result = await sendLifecycleEmail(user, customerSuccessOutreachTemplate(kind, user));
      outcomes[result] += 1;
    }
    output[kind] = { reviewedEligible: eligible.length, outcomes };
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main()
  .catch((error) => {
    console.error('[CustomerSuccessOutreach] Failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
