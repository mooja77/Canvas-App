import { describe, it, expect, vi } from 'vitest';

vi.mock('./stripe.js', () => ({ stripe: null }));
vi.mock('./logger.js', () => ({ logError: vi.fn() }));

import { monthlyRecurringRevenue, stripeSubscriptionMonthlyValue } from './revenue.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripeSub(items: Array<{ unit: number; interval: string; qty?: number; count?: number }>): any {
  return {
    items: {
      data: items.map((i) => ({
        quantity: i.qty ?? 1,
        price: { unit_amount: i.unit, recurring: { interval: i.interval, interval_count: i.count ?? 1 } },
      })),
    },
  };
}

function fakeStripe(byId: Record<string, unknown>) {
  return {
    subscriptions: {
      retrieve: vi.fn(async (id: string) => {
        if (!(id in byId)) throw new Error('No such subscription');
        return byId[id];
      }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('admin MRR is read from Stripe prices, not a hard-coded table', () => {
  it('prices monthly, annual and per-seat subscriptions from their Stripe price', async () => {
    const stripe = fakeStripe({
      sub_pro_m: stripeSub([{ unit: 1500, interval: 'month' }]),
      sub_pro_y: stripeSub([{ unit: 14400, interval: 'year' }]),
      sub_team_3: stripeSub([{ unit: 3900, interval: 'month', qty: 3 }]),
      sub_student: stripeSub([{ unit: 500, interval: 'month' }]),
    });
    const summary = await monthlyRecurringRevenue(
      [
        { stripeSubscriptionId: 'sub_pro_m', user: { plan: 'pro' } },
        { stripeSubscriptionId: 'sub_pro_y', user: { plan: 'pro' } },
        { stripeSubscriptionId: 'sub_team_3', user: { plan: 'team' } },
        { stripeSubscriptionId: 'sub_student', user: { plan: 'student' } },
      ],
      stripe,
    );
    // 15 + 144/12 + 3*39 + 5. The old table said pro=12, team=29, student=0 -> 53.
    expect(summary.mrr).toBe(15 + 12 + 117 + 5);
    expect(summary.byPlan).toEqual({
      pro: { count: 2, revenue: 27 },
      team: { count: 1, revenue: 117 },
      student: { count: 1, revenue: 5 },
    });
    expect(summary.source).toBe('stripe');
    expect(summary.basis).toBe('list-price-before-discounts');
  });

  it('falls back to the published monthly price when Stripe cannot be read, and says so', async () => {
    const stripe = fakeStripe({ sub_ok: stripeSub([{ unit: 1500, interval: 'month' }]) });
    const summary = await monthlyRecurringRevenue(
      [
        { stripeSubscriptionId: 'sub_ok', user: { plan: 'pro' } },
        { stripeSubscriptionId: 'sub_gone', user: { plan: 'team' } },
      ],
      stripe,
    );
    expect(summary.mrr).toBe(15 + 39);
    expect(summary.source).toBe('mixed');

    const offline = await monthlyRecurringRevenue([{ stripeSubscriptionId: 'x', user: { plan: 'student' } }], null);
    expect(offline).toMatchObject({ mrr: 5, source: 'published-prices' });
    expect(await monthlyRecurringRevenue([], null)).toMatchObject({ mrr: 0, source: 'none' });
  });

  it('normalises other billing intervals and refuses to guess an unknown one', () => {
    expect(stripeSubscriptionMonthlyValue(stripeSub([{ unit: 3000, interval: 'month', count: 3 }]))).toBe(10);
    expect(stripeSubscriptionMonthlyValue(stripeSub([{ unit: 1200, interval: 'week' }]))).toBeCloseTo(52, 5);
    expect(stripeSubscriptionMonthlyValue(stripeSub([{ unit: 1000, interval: 'fortnight' }]))).toBeNull();
  });
});
