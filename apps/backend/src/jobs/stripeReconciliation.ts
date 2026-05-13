/**
 * Reliability fix #7 — Stripe reconciliation cron.
 *
 * Even with webhooks + maxNetworkRetries, the DB Subscription rows can drift
 * from Stripe's source of truth: a dropped webhook, a manually-cancelled sub
 * in the Stripe dashboard, a half-completed checkout, etc. This job runs
 * weekly and compares the two, fixing status mismatches and logging anything
 * we can't safely auto-resolve.
 *
 * Scope:
 *  - Active+trialing+past_due subs in Stripe that aren't in DB → log only
 *    (don't auto-create — we don't know which User owns them without manual
 *    intervention; could be a webhook ordering bug)
 *  - Subs in both, status mismatch → update DB
 *  - currentPeriodEnd drift > 24h → update DB (invoice.payment_succeeded
 *    sometimes lost in transit)
 */

import { prisma } from '../lib/prisma.js';
import { stripe } from '../lib/stripe.js';
import { logError } from '../lib/logger.js';

const RECONCILE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // weekly
const STARTUP_DELAY_MS = 5 * 60 * 1000; // 5 min after boot so cold-start isn't slow
const PERIOD_DRIFT_THRESHOLD_MS = 24 * 60 * 60 * 1000;

let reconcileInterval: ReturnType<typeof setInterval> | null = null;

export interface ReconciliationResult {
  examined: number;
  statusFixed: number;
  periodFixed: number;
  orphanedInStripe: number;
  errors: number;
}

export async function reconcileStripeSubscriptions(): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    examined: 0,
    statusFixed: 0,
    periodFixed: 0,
    orphanedInStripe: 0,
    errors: 0,
  };
  if (!stripe) {
    console.log('[StripeReconcile] Skipping — Stripe not configured');
    return result;
  }

  try {
    // Stripe limits 100 per page; loop in case we accumulate more.
    let startingAfter: string | undefined;
    do {
      const page = await stripe.subscriptions.list({
        status: 'all',
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });

      for (const stripeSub of page.data) {
        result.examined++;
        try {
          const dbSub = await prisma.subscription.findUnique({
            where: { stripeSubscriptionId: stripeSub.id },
          });

          if (!dbSub) {
            // Only flag active-ish subs as drift; old canceled ones are fine.
            if (stripeSub.status === 'active' || stripeSub.status === 'trialing' || stripeSub.status === 'past_due') {
              result.orphanedInStripe++;
              logError(new Error('Stripe subscription not in DB'), {
                action: 'stripeReconciliation.orphanedInStripe',
                stripeSubId: stripeSub.id,
                status: stripeSub.status,
                customer: typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer?.id,
              });
            }
            continue;
          }

          const updates: Record<string, unknown> = {};
          if (dbSub.status !== stripeSub.status) {
            updates.status = stripeSub.status;
            result.statusFixed++;
          }

          const item = stripeSub.items.data[0];
          if (item) {
            const stripeEnd = new Date(item.current_period_end * 1000);
            const driftMs = Math.abs(stripeEnd.getTime() - dbSub.currentPeriodEnd.getTime());
            if (driftMs > PERIOD_DRIFT_THRESHOLD_MS) {
              updates.currentPeriodStart = new Date(item.current_period_start * 1000);
              updates.currentPeriodEnd = stripeEnd;
              result.periodFixed++;
            }
          }

          if (Object.keys(updates).length > 0) {
            await prisma.subscription.update({
              where: { id: dbSub.id },
              data: updates,
            });
          }
        } catch (err) {
          result.errors++;
          logError(err as Error, {
            action: 'stripeReconciliation.processSub',
            stripeSubId: stripeSub.id,
          });
        }
      }

      startingAfter = page.has_more ? page.data[page.data.length - 1]?.id : undefined;
    } while (startingAfter);
  } catch (err) {
    result.errors++;
    logError(err as Error, { action: 'stripeReconciliation.list' });
  }

  console.log(
    `[StripeReconcile] examined=${result.examined} status_fixed=${result.statusFixed} period_fixed=${result.periodFixed} orphaned=${result.orphanedInStripe} errors=${result.errors}`,
  );
  return result;
}

export function startStripeReconciliationScheduler(): void {
  if (reconcileInterval) return;
  if (!stripe) {
    console.log('[StripeReconcile] Not starting — Stripe not configured');
    return;
  }
  console.log('[StripeReconcile] Scheduled (weekly cadence; first run in 5 min)');
  reconcileInterval = setInterval(() => {
    void reconcileStripeSubscriptions();
  }, RECONCILE_INTERVAL_MS);
  setTimeout(() => {
    void reconcileStripeSubscriptions();
  }, STARTUP_DELAY_MS);
}

export function stopStripeReconciliationScheduler(): void {
  if (reconcileInterval) {
    clearInterval(reconcileInterval);
    reconcileInterval = null;
    console.log('[StripeReconcile] Stopped');
  }
}
