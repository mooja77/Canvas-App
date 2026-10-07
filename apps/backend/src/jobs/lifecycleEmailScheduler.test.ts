import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { selectTimedLifecycleEmail } from './lifecycleEmailScheduler.js';

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
      activated: false,
      setupProgress: 'no_coding',
    },
    NOW,
  );
}

describe('selectTimedLifecycleEmail', () => {
  beforeEach(() => vi.stubEnv('LIFECYCLE_SETUP_SEQUENCE_ENABLED', 'true'));
  afterEach(() => vi.unstubAllEnvs());

  it.each([undefined, 'false'])('preserves the existing sequence when the new lane is %s', (flag) => {
    vi.stubEnv('LIFECYCLE_EMAIL_AUTOMATION_ENABLED', 'true');
    vi.stubEnv('LIFECYCLE_EMAIL_SEND_ENABLED', 'true');
    vi.stubEnv('LIFECYCLE_SETUP_SEQUENCE_ENABLED', flag);
    expect(select({ ageDays: 1 })).toBeNull();
    expect(select({ ageDays: 4 })).toBe('training_tip_3d');
    expect(select({ ageDays: 8 })).toBe('onboarding_7d');
    expect(select({ ageDays: 30, lastActivityDaysAgo: 20 })).toBe('inactivity_14d');
  });

  it('selects the setup nudge only during the day 1 to day 3 window', () => {
    expect(select({ ageDays: 0.9 })).toBeNull();
    expect(select({ ageDays: 1 })).toBe('setup_nudge_1d');
    expect(select({ ageDays: 2.9 })).toBe('setup_nudge_1d');
    expect(select({ ageDays: 3 })).not.toBe('setup_nudge_1d');
    expect(select({ ageDays: 2, delivered: ['setup_nudge_1d_v1'] })).toBeNull();
  });

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

  it('stops the timed sequence once first value has been reached', () => {
    expect(
      selectTimedLifecycleEmail(
        {
          createdAt: daysBeforeNow(4),
          deliveredEventKeys: new Set(),
          lastActivity: null,
          activated: true,
        },
        NOW,
      ),
    ).toBeNull();
  });
});
