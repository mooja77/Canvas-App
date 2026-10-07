import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => {
  vi.stubEnv('LIFECYCLE_EMAIL_AUTOMATION_ENABLED', 'true');
  return {
    prisma: {
      user: { findMany: vi.fn(), findUnique: vi.fn() },
      codingCanvas: { count: vi.fn() },
      canvasTranscript: { count: vi.fn() },
      auditLog: { findFirst: vi.fn() },
      emailDelivery: { findMany: vi.fn() },
    },
    send: vi.fn(),
  };
});
vi.mock('../lib/prisma.js', () => ({ prisma: fixture.prisma }));
vi.mock('../lib/lifecycleEmail.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/lifecycleEmail.js')>()),
  sendLifecycleEmail: fixture.send,
}));
import { processLifecycleEmails, selectTimedLifecycleEmail, setupProgress } from './lifecycleEmailScheduler.js';
import { lifecycleTemplate } from '../lib/lifecycleEmail.js';

const NOW = new Date('2026-10-07T12:00:00Z');
const steps = ['first-transcript', 'first-coded-excerpt', 'create-theme', 'run-analysis', 'export-csv'];
const user = {
  id: 'fictional-setup-user',
  email: 'setup-fixture@example.com',
  name: 'Fictional Researcher',
  plan: 'free',
  createdAt: new Date('2026-10-03T12:00:00Z'),
  lifecycleCohortStartedAt: new Date('2026-10-03T12:00:00Z'),
  firstValueAt: new Date('2026-10-03T12:01:00Z'),
};
function saved(completed: string[]) {
  return { ...user, onboardingState: JSON.stringify({ serverSteps: completed }) };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv('LIFECYCLE_SETUP_SEQUENCE_ENABLED', 'true');
  fixture.prisma.user.findMany.mockResolvedValue([user]);
  fixture.prisma.user.findUnique.mockResolvedValue(saved(steps.slice(0, 2)));
  fixture.prisma.codingCanvas.count.mockResolvedValue(1);
  fixture.prisma.canvasTranscript.count.mockResolvedValue(1);
  fixture.prisma.emailDelivery.findMany.mockResolvedValue([]);
  fixture.prisma.auditLog.findFirst.mockResolvedValue(null);
  fixture.send.mockResolvedValue('skipped');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
afterAll(() => vi.unstubAllEnvs());

describe('complete five-step setup progress, not only activation', () => {
  it.each([
    [0, 'no_transcript'],
    [1, 'no_coding'],
    [2, 'no_theme'],
    [3, 'no_analysis'],
    [4, 'no_export'],
    [5, null],
  ] as const)('resolves the first unobserved step after %i completed steps', async (count, expected) => {
    fixture.prisma.user.findUnique.mockResolvedValue(saved(steps.slice(0, count)));
    if (!count) fixture.prisma.canvasTranscript.count.mockResolvedValue(0);
    await expect(setupProgress(user.id)).resolves.toBe(expected);
  });
  it('asks for a project only when there is no owned project or completed setup', async () => {
    fixture.prisma.codingCanvas.count.mockResolvedValue(0);
    fixture.prisma.user.findUnique.mockResolvedValue(saved([]));
    await expect(setupProgress(user.id)).resolves.toBe('no_project');
    fixture.prisma.user.findUnique.mockResolvedValue(saved(steps));
    await expect(setupProgress(user.id)).resolves.toBeNull();
  });
  it('does not trust client checklist completion in place of server observations', async () => {
    fixture.prisma.user.findUnique.mockResolvedValue({
      ...user,
      onboardingState: JSON.stringify({ checklistComplete: steps, firstExport: true }),
    });
    fixture.prisma.canvasTranscript.count.mockResolvedValue(0);
    await expect(setupProgress(user.id)).resolves.toBe('no_transcript');
  });
  it.each([1, 4, 8])('keeps unfinished setup eligible at day %i after first value', (age) => {
    expect(
      selectTimedLifecycleEmail(
        {
          createdAt: new Date(NOW.getTime() - age * 86400000),
          activated: true,
          deliveredEventKeys: new Set(),
          lastActivity: null,
          setupProgress: 'no_export',
        },
        NOW,
      ),
    ).toBe(age === 1 ? 'setup_nudge_1d' : age === 4 ? 'training_tip_3d' : 'onboarding_7d');
  });
  it.each([null, undefined])('does not select new setup from complete or unknown progress (%s)', (progress) => {
    expect(
      selectTimedLifecycleEmail(
        {
          createdAt: user.createdAt,
          activated: false,
          deliveredEventKeys: new Set(),
          lastActivity: null,
          setupProgress: progress,
        },
        NOW,
      ),
    ).toBeNull();
  });
  it('includes activated candidates only in the new guarded setup lane', async () => {
    await processLifecycleEmails();
    expect(fixture.prisma.user.findMany.mock.calls[0][0].where).not.toHaveProperty('firstValueAt');
    expect(fixture.send).toHaveBeenCalledOnce();
    const template = fixture.send.mock.calls[0][1];
    expect(template.setupSequence).toBe(true);
    expect(template.title).toBe('Use two different codes');
    expect(template.bodyHtml).toContain('Type a different code name');
  });
  it('rechecks progress before sending and suppresses a newly completed guide', async () => {
    fixture.prisma.user.findUnique.mockResolvedValueOnce(saved(steps.slice(0, 2))).mockResolvedValue(saved(steps));
    await processLifecycleEmails();
    expect(fixture.prisma.user.findUnique).toHaveBeenCalledTimes(2);
    expect(fixture.send).not.toHaveBeenCalled();
  });
  it('does not send after a failed progress read', async () => {
    fixture.prisma.user.findUnique.mockRejectedValue(new Error('Fictional unavailable progress'));
    await processLifecycleEmails();
    expect(fixture.send).not.toHaveBeenCalled();
  });
  it('does not send if the new setup flag turns off during the fresh progress read', async () => {
    fixture.prisma.user.findUnique.mockResolvedValueOnce(saved(steps.slice(0, 2))).mockImplementationOnce(async () => {
      vi.stubEnv('LIFECYCLE_SETUP_SEQUENCE_ENABLED', 'false');
      return saved(steps.slice(0, 2));
    });
    await processLifecycleEmails();
    expect(fixture.send).not.toHaveBeenCalled();
  });
  it.each([undefined, 'false'])('preserves the legacy activated-user stop with setup flag %s', async (flag) => {
    vi.stubEnv('LIFECYCLE_SETUP_SEQUENCE_ENABLED', flag);
    await processLifecycleEmails();
    expect(fixture.prisma.user.findMany.mock.calls[0][0].where.firstValueAt).toBeNull();
    expect(fixture.send).not.toHaveBeenCalled();
    expect(
      selectTimedLifecycleEmail(
        {
          createdAt: user.createdAt,
          activated: true,
          deliveredEventKeys: new Set(),
          lastActivity: null,
          setupProgress: 'no_export',
        },
        NOW,
      ),
    ).toBeNull();
  });
  it('does not backfill completed setup or send inactivity after activation', () => {
    expect(
      selectTimedLifecycleEmail(
        {
          createdAt: new Date('2026-08-01T12:00:00Z'),
          activated: true,
          deliveredEventKeys: new Set(),
          lastActivity: new Date('2026-08-02T12:00:00Z'),
          setupProgress: 'no_export',
        },
        NOW,
      ),
    ).toBeNull();
  });
});

describe('plain-language messages for each actual remaining step', () => {
  it('includes sample exploration, written setup help and feature requests in the guarded welcome', () => {
    const template = lifecycleTemplate('welcome', user);
    expect(template.bodyHtml).toContain('clearly labelled sample');
    expect(template.bodyHtml).toContain('support@qualcanvas.com');
    expect(template.bodyHtml).toContain('two business days');
    expect(template.bodyHtml).toContain('feature requests');
    expect(template.bodyHtml).toContain('no call needed');
    expect(template.bodyHtml).toContain('Please do not email participant data');
  });
  it.each([undefined, 'false'])('preserves legacy welcome with setup flag %s', (flag) => {
    vi.stubEnv('LIFECYCLE_SETUP_SEQUENCE_ENABLED', flag);
    const template = lifecycleTemplate('welcome', user);
    expect(template.bodyHtml).toContain('add 3-5 research questions');
    expect(template.bodyHtml).not.toContain('clearly labelled sample');
    expect(template).not.toHaveProperty('setupSequence');
  });
  for (const type of ['setup_nudge_1d', 'training_tip_3d', 'onboarding_7d'] as const) {
    it.each([
      ['no_project', 'Start your first project'],
      ['no_transcript', 'Add your first transcript'],
      ['no_coding', 'Code your first excerpt'],
      ['no_theme', 'Use two different codes'],
      ['no_analysis', 'Try your first analysis'],
      ['no_export', 'Download your coded passages'],
    ] as const)(`${type} explains %s and offers written help`, (progress, title) => {
      const template = lifecycleTemplate(type, user, progress);
      expect(template.title).toBe(title);
      expect(template.setupSequence).toBe(true);
      expect(template.eventKey).toBe(`${type === 'setup_nudge_1d' ? 'setup_nudge_1d' : type}_v1`);
      expect(template.category).toBe(type === 'training_tip_3d' ? 'trainingTips' : 'lifecycle');
      expect(template.ctaUrl).toMatch(/\/canvas$/);
      expect(template.bodyHtml).toContain('two business days');
      expect(template.bodyHtml).toContain('no call needed');
      expect(template.bodyHtml).toContain('Please do not email participant data');
      expect(template.bodyHtml).toContain('feature requests');
    });
  }
  it('requires observed progress for a new day-one template', () => {
    expect(() => lifecycleTemplate('setup_nudge_1d', user)).toThrow('Observed setup progress required');
  });
  it.each(['training_tip_3d', 'onboarding_7d'] as const)('keeps %s legacy copy identical while flag is off', (type) => {
    vi.stubEnv('LIFECYCLE_SETUP_SEQUENCE_ENABLED', 'false');
    expect(lifecycleTemplate(type, user, 'no_export')).toEqual(lifecycleTemplate(type, user));
    expect(lifecycleTemplate(type, user)).not.toHaveProperty('setupSequence');
  });
});
