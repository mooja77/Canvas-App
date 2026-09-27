import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({ prisma: {} }));
vi.mock('../lib/stripe.js', () => ({ getStripe: () => ({}) }));

import { assignSeats, seatConfirmation, seatModeFor } from './seats.js';

const at = (d: string) => new Date(`2026-10-${d}T00:00:00Z`);

describe('seatModeFor', () => {
  it('bills Pro and Team only while a subscription is live (active, trialing or past_due)', () => {
    for (const status of ['active', 'trialing', 'past_due']) {
      expect(seatModeFor({ plan: 'team', effectivePlan: 'team', subscriptionStatus: status })).toBe('billed');
      expect(seatModeFor({ plan: 'pro', effectivePlan: 'pro', subscriptionStatus: status })).toBe('billed');
    }
    expect(seatModeFor({ plan: 'team', effectivePlan: 'team', subscriptionStatus: 'canceled' })).toBe('grandfathered');
  });
  it('treats a free-plan trial as a trial and Student/Free as unbilled', () => {
    expect(seatModeFor({ plan: 'free', effectivePlan: 'pro', subscriptionStatus: null })).toBe('trial');
    expect(seatModeFor({ plan: 'student', effectivePlan: 'student', subscriptionStatus: 'active' })).toBe('none');
    expect(seatModeFor({ plan: 'free', effectivePlan: 'free', subscriptionStatus: null })).toBe('none');
  });
  it('grandfathered legacy Pro (no subscription) is not billed per seat', () => {
    expect(seatModeFor({ plan: 'pro', effectivePlan: 'pro', subscriptionStatus: undefined })).toBe('grandfathered');
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
      prorationDate: now - 30,
    });
    expect(seatConfirmation({ confirmSeatCharge: true, prorationDate: now - 3600 }).confirm).toBe(false);
  });
});
