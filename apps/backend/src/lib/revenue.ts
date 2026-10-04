import type Stripe from 'stripe';
import { PUBLISHED_PRICES_USD, type PaidPlanTier } from '@qualcanvas/shared';
import { stripe as defaultStripe } from './stripe.js';
import { logError } from './logger.js';
import { isStripeSubscriptionId } from './stripeIds.js';

/**
 * Monthly recurring revenue for the admin dashboard, read from the same place
 * billing charges: each subscription's Stripe prices and seat quantity.
 *
 * The dashboard used a hard-coded {pro: 12, team: 29}. The published prices are
 * $15/mo Pro and $39/seat/mo Team (annual $144 and $384/seat a year), Student
 * was missing entirely, and Team seats were never multiplied, so the figure
 * was wrong for every paying customer.
 *
 * Figures are list price x quantity, normalised to a month (annual / 12).
 * Coupons (the 40% academic discount) are NOT subtracted: Stripe applies them
 * at invoice time, so this is gross MRR before discounts, and the response says
 * so. If Stripe is unreachable for a subscription, its published monthly price
 * (shared PUBLISHED_PRICES_USD, one seat) is used and `source` says `mixed` or
 * `published-prices` so the number is never presented as more exact than it is.
 *
 * Complimentary rows (ids that are not Stripe "sub_" ids, e.g. hand-written
 * "comp_..." Team rows) are never sent to Stripe (Sentry QUALCANVAS-7) and are
 * not revenue: they are left out of `mrr` / `byPlan` and counted in
 * `complimentary` instead.
 */
export interface RevenueSubscription {
  stripeSubscriptionId: string;
  user: { plan: string };
}

export interface RevenueSummary {
  mrr: number;
  byPlan: Record<string, { count: number; revenue: number }>;
  source: 'stripe' | 'published-prices' | 'mixed' | 'none';
  basis: 'list-price-before-discounts';
  /** Active rows with no Stripe subscription behind them: not paying, not priced. */
  complimentary: { count: number; byPlan: Record<string, number> };
}

type StripeLike = Pick<Stripe, 'subscriptions'>;

const cents = (n: number) => Math.round(n * 100) / 100;

function monthlyFactor(interval: string | undefined, count: number | undefined): number | null {
  const n = count && count > 0 ? count : 1;
  switch (interval) {
    case 'month':
      return 1 / n;
    case 'year':
      return 1 / (12 * n);
    case 'week':
      return 52 / 12 / n;
    case 'day':
      return 365 / 12 / n;
    default:
      return null;
  }
}

/** Monthly list-price value of one Stripe subscription, or null if unreadable. */
export function stripeSubscriptionMonthlyValue(sub: Stripe.Subscription): number | null {
  let total = 0;
  for (const item of sub.items?.data ?? []) {
    const price = item.price;
    const factor = monthlyFactor(price?.recurring?.interval, price?.recurring?.interval_count);
    const unit = price?.unit_amount;
    if (factor === null || typeof unit !== 'number') return null;
    total += (unit / 100) * (item.quantity ?? 1) * factor;
  }
  return total;
}

function publishedMonthly(plan: string): number {
  const p = PUBLISHED_PRICES_USD[plan as PaidPlanTier];
  return p ? p.monthly : 0;
}

export async function monthlyRecurringRevenue(
  subscriptions: RevenueSubscription[],
  stripeClient: StripeLike | null = defaultStripe,
): Promise<RevenueSummary> {
  const complimentary: RevenueSummary['complimentary'] = { count: 0, byPlan: {} };
  const paying: RevenueSubscription[] = [];
  for (const sub of subscriptions) {
    if (isStripeSubscriptionId(sub.stripeSubscriptionId)) {
      paying.push(sub);
    } else {
      complimentary.count++;
      complimentary.byPlan[sub.user.plan] = (complimentary.byPlan[sub.user.plan] ?? 0) + 1;
    }
  }

  let fromStripe = 0;
  let fromPublished = 0;
  const values = await Promise.all(
    paying.map(async (sub) => {
      if (stripeClient) {
        try {
          const live = await stripeClient.subscriptions.retrieve(sub.stripeSubscriptionId);
          const value = stripeSubscriptionMonthlyValue(live);
          if (value !== null) {
            fromStripe++;
            return value;
          }
        } catch (err) {
          logError(err as Error, { action: 'revenue.retrieveSubscription', subscription: sub.stripeSubscriptionId });
        }
      }
      fromPublished++;
      return publishedMonthly(sub.user.plan);
    }),
  );

  const byPlan: RevenueSummary['byPlan'] = {};
  let mrr = 0;
  paying.forEach((sub, i) => {
    const plan = sub.user.plan;
    byPlan[plan] ??= { count: 0, revenue: 0 };
    byPlan[plan].count++;
    byPlan[plan].revenue = cents(byPlan[plan].revenue + values[i]);
    mrr += values[i];
  });

  const source: RevenueSummary['source'] =
    paying.length === 0 ? 'none' : fromPublished === 0 ? 'stripe' : fromStripe === 0 ? 'published-prices' : 'mixed';
  return { mrr: cents(mrr), byPlan, source, basis: 'list-price-before-discounts', complimentary };
}
