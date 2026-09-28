import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({ prisma: {} }));
vi.mock('../lib/stripe.js', () => ({ getStripe: () => ({}) }));

import { assignSeats, isStripeSubscriptionId, seatCapacity, seatConfirmation, seatModeFor } from './seats.js';

const at = (d: string) => new Date(`2026-10-${d}T00:00:00Z`);

describe('seatModeFor', () => {
  const sub = 'sub_123';
  it('bills Team per seat only while a Stripe subscription is live (active, trialing or past_due)', () => {
    for (const status of ['active', 'trialing', 'past_due']) {
      expect(
        seatModeFor({ plan: 'team', effectivePlan: 'team', subscriptionStatus: status, stripeSubscriptionId: sub }),
      ).toBe('billed');
    }
    expect(
      seatModeFor({ plan: 'team', effectivePlan: 'team', subscriptionStatus: 'canceled', stripeSubscriptionId: sub }),
    ).toBe('grandfathered');
  });
  it('Pro is one person whatever its subscription: billed, legacy or none', () => {
    for (const subscriptionStatus of ['active', 'past_due', 'canceled', null, undefined]) {
      expect(seatModeFor({ plan: 'pro', effectivePlan: 'pro', subscriptionStatus, stripeSubscriptionId: sub })).toBe(
        'solo',
      );
    }
    expect(seatModeFor({ plan: 'pro', effectivePlan: 'pro', subscriptionStatus: undefined })).toBe('solo');
  });
  it('a complimentary Team row with no Stripe subscription behind it is never billed or enforced', () => {
    // Production holds rows like this (comp_..., read-only check 28 Sep 2026).
    for (const status of ['active', 'trialing']) {
      expect(
        seatModeFor({
          plan: 'team',
          effectivePlan: 'team',
          subscriptionStatus: status,
          stripeSubscriptionId: 'comp_x',
        }),
      ).toBe('comp');
    }
  });
  it('treats a free-plan trial as a trial and Student/Free as unbilled', () => {
    expect(seatModeFor({ plan: 'free', effectivePlan: 'pro', subscriptionStatus: null })).toBe('trial');
    expect(seatModeFor({ plan: 'student', effectivePlan: 'student', subscriptionStatus: 'active' })).toBe('none');
    expect(seatModeFor({ plan: 'free', effectivePlan: 'free', subscriptionStatus: null })).toBe('none');
  });
  it('grandfathered legacy Team (no subscription) is not billed per seat', () => {
    expect(seatModeFor({ plan: 'team', effectivePlan: 'team', subscriptionStatus: undefined })).toBe('grandfathered');
  });
});

describe('seatCapacity', () => {
  it('Team seats are the Stripe quantity; Pro is always the owner alone, whatever its quantity', () => {
    expect(seatCapacity('billed', 4)).toBe(4);
    expect(seatCapacity('billed', 0)).toBe(1);
    expect(seatCapacity('solo', 1)).toBe(1);
    expect(seatCapacity('solo', 3)).toBe(1);
    for (const mode of ['trial', 'grandfathered', 'comp', 'none'] as const) expect(seatCapacity(mode, 5)).toBeNull();
  });
});

describe('isStripeSubscriptionId', () => {
  it('only sub_ ids are Stripe subscriptions', () => {
    expect(isStripeSubscriptionId('sub_1Abc')).toBe(true);
    expect(isStripeSubscriptionId('comp_team_permanent')).toBe(false);
    expect(isStripeSubscriptionId('')).toBe(false);
    expect(isStripeSubscriptionId(null)).toBe(false);
  });
});

describe('assignSeats', () => {
  const holders = [
    { userId: 'c', since: at('03') },
    { userId: 'a', since: at('01') },
    { userId: 'b', since: at('02') },
  ];
  it('gives paid seats to the longest-standing coders; the owner holds seat 1', () => {
    const { seated, unseated } = assignSeats(holders, 2);
    expect(seated.map((h) => h.userId)).toEqual(['a']);
    expect(unseated.map((h) => h.userId)).toEqual(['b', 'c']);
  });
  it('seats everyone when enough seats are paid for', () => {
    expect(assignSeats(holders, 4).unseated).toEqual([]);
    expect(assignSeats(holders, 10).seated).toHaveLength(3);
  });
  it('a single seat is the owner alone', () => {
    expect(assignSeats(holders, 1).seated).toEqual([]);
  });
  it('breaks ties on user id so the answer is stable', () => {
    const tie = [
      { userId: 'y', since: at('01') },
      { userId: 'x', since: at('01') },
    ];
    expect(assignSeats(tie, 2).seated[0].userId).toBe('x');
  });
});

describe('seatConfirmation', () => {
  it('requires an explicit boolean true', () => {
    expect(seatConfirmation({ confirmSeatCharge: 'true' }).confirm).toBe(false);
    expect(seatConfirmation({}).confirm).toBe(false);
    expect(seatConfirmation({ confirmSeatCharge: true }).confirm).toBe(true);
  });
  it('rejects a stale preview (older than 10 minutes)', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(seatConfirmation({ confirmSeatCharge: true, prorationDate: now - 30 })).toEqual({
      confirm: true,
      confirmTeamUpgrade: false,
      prorationDate: now - 30,
    });
    expect(seatConfirmation({ confirmSeatCharge: true, prorationDate: now - 3600 }).confirm).toBe(false);
  });
});

describe('seatConfirmation: Team upgrade', () => {
  it('a seat confirmation never confirms a plan change, and vice versa', () => {
    expect(seatConfirmation({ confirmSeatCharge: true }).confirmTeamUpgrade).toBe(false);
    expect(seatConfirmation({ confirmTeamUpgrade: true }).confirm).toBe(false);
    expect(seatConfirmation({ confirmTeamUpgrade: true }).confirmTeamUpgrade).toBe(true);
    expect(seatConfirmation({ confirmTeamUpgrade: 'yes' }).confirmTeamUpgrade).toBe(false);
  });
  it('a stale Team quote is not honoured', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(seatConfirmation({ confirmTeamUpgrade: true, prorationDate: now - 3600 }).confirmTeamUpgrade).toBe(false);
  });
});
