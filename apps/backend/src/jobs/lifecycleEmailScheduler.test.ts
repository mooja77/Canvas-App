import { describe, expect, it } from 'vitest';
import { parseRecipientAllowlist, selectTimedLifecycleEmail } from './lifecycleEmailScheduler.js';

const NOW = new Date('2026-08-11T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function daysBeforeNow(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

function select(options: { ageDays: number; delivered?: string[]; lastActivityDaysAgo?: number | null }) {
  return selectTimedLifecycleEmail(
    {
      createdAt: daysBeforeNow(options.ageDays),
      deliveredEventKeys: new Set(options.delivered || []),
      lastActivity: options.lastActivityDaysAgo == null ? null : daysBeforeNow(options.lastActivityDaysAgo),
    },
    NOW,
  );
}

describe('selectTimedLifecycleEmail', () => {
  it('selects the training tip only during the day 3 to day 7 window', () => {
    expect(select({ ageDays: 3 })).toBe('training_tip_3d');
    expect(select({ ageDays: 6.9 })).toBe('training_tip_3d');
    expect(select({ ageDays: 7 })).not.toBe('training_tip_3d');
  });

  it('selects the onboarding follow-up only during the day 7 to day 14 window', () => {
    expect(select({ ageDays: 7 })).toBe('onboarding_7d');
    expect(select({ ageDays: 13.9 })).toBe('onboarding_7d');
    expect(select({ ageDays: 14, lastActivityDaysAgo: null })).toBeNull();
  });

  it('does not backfill training or onboarding emails to a legacy account', () => {
    expect(select({ ageDays: 30, lastActivityDaysAgo: null })).toBeNull();
  });

  it('requires positive evidence of old activity before selecting inactivity', () => {
    expect(select({ ageDays: 30, lastActivityDaysAgo: null })).toBeNull();
    expect(select({ ageDays: 30, lastActivityDaysAgo: 5 })).toBeNull();
    expect(select({ ageDays: 30, lastActivityDaysAgo: 20 })).toBe('inactivity_14d');
  });

  it('does not select an event that already has a delivery record', () => {
    expect(select({ ageDays: 4, delivered: ['training_tip_3d_v1'] })).toBeNull();
    expect(select({ ageDays: 8, delivered: ['onboarding_7d_v1'] })).toBeNull();
    expect(
      select({
        ageDays: 30,
        lastActivityDaysAgo: 20,
        delivered: ['inactivity_14d_v1'],
      }),
    ).toBeNull();
  });
});

describe('parseRecipientAllowlist', () => {
  it('normalises, de-duplicates and drops blank recipient entries', () => {
    expect(parseRecipientAllowlist(' Canary@Example.com,canary@example.com, , second@example.com ')).toEqual(
      new Set(['canary@example.com', 'second@example.com']),
    );
  });

  it('returns an empty set when no allowlist is configured', () => {
    expect(parseRecipientAllowlist(undefined)).toEqual(new Set());
  });
});
