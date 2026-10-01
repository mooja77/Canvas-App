import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockSendEmailWithResult } = vi.hoisted(() => {
  // The template module captures its origin at import time. Pin this mocked
  // fixture before importing it; reserved local app ports can differ.
  vi.stubEnv('APP_URL', 'http://localhost:5174');
  return {
    mockPrisma: {
      user: { findUnique: vi.fn() },
      emailCampaign: { count: vi.fn(), findMany: vi.fn() },
      emailDelivery: {
        count: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      emailPreference: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      newsletterDelivery: { count: vi.fn() },
      newsletterSubscriber: { count: vi.fn() },
    },
    mockSendEmailWithResult: vi.fn(),
  };
});

afterAll(() => vi.unstubAllEnvs());

vi.mock('./prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./email.js', () => ({ sendEmailWithResult: mockSendEmailWithResult }));

import {
  getEmailStats,
  isLifecycleSendingEnabledFor,
  isPermanentEmailFailure,
  lifecycleTemplate,
  listEmailCampaigns,
  sendLifecycleEmail,
} from './lifecycleEmail.js';

describe('lifecycle email reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LIFECYCLE_SETUP_SEQUENCE_ENABLED = 'true';
    process.env.RESEND_API_KEY = 'configured';
    process.env.RESEND_WEBHOOK_SECRET = 'configured';
    process.env.SMTP_FROM = 'QualCanvas <noreply@qualcanvas.com>';
  });

  afterEach(() => {
    delete process.env.LIFECYCLE_SETUP_SEQUENCE_ENABLED;
    delete process.env.LIFECYCLE_EMAIL_SEND_ENABLED;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_WEBHOOK_SECRET;
    delete process.env.SMTP_FROM;
  });

  it('includes account and newsletter delivery totals', async () => {
    mockPrisma.emailCampaign.count.mockResolvedValue(3);
    mockPrisma.emailDelivery.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(4);
    mockPrisma.newsletterDelivery.count.mockResolvedValueOnce(7).mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    mockPrisma.emailPreference.count.mockResolvedValue(5);
    mockPrisma.newsletterSubscriber.count.mockResolvedValue(6);

    await expect(getEmailStats()).resolves.toEqual({
      campaigns: 3,
      accepted: 17,
      delivered: 9,
      failed: 3,
      skipped: 4,
      unsubscribed: 11,
    });
  });

  it('keeps lifecycle delivery disabled until the provider and master switch are ready', () => {
    expect(isLifecycleSendingEnabledFor('canary@example.com')).toBe(false);

    process.env.LIFECYCLE_EMAIL_SEND_ENABLED = 'true';
    expect(isLifecycleSendingEnabledFor('canary@example.com')).toBe(true);
    expect(isLifecycleSendingEnabledFor('someone-else@example.com')).toBe(true);
  });

  it('records provider acceptance without calling it delivered', async () => {
    process.env.LIFECYCLE_EMAIL_SEND_ENABLED = 'true';
    const user = { id: 'u1', email: 'canary@example.com', name: 'Canary' };
    mockPrisma.user.findUnique.mockResolvedValue({ id: user.id, email: user.email, emailVerified: true });
    mockPrisma.emailPreference.findUnique.mockResolvedValue({
      userId: user.id,
      lifecycle: true,
      productUpdates: false,
      trainingTips: false,
      inactivityNudges: false,
      unsubscribedAt: null,
      unsubscribeToken: 'opaque-token',
    });
    mockPrisma.emailDelivery.findUnique.mockResolvedValue(null);
    mockPrisma.emailDelivery.create.mockResolvedValue({ id: 'delivery-1', attemptCount: 1 });
    mockSendEmailWithResult.mockResolvedValue({ accepted: true, provider: 'resend', messageId: 'provider-1' });

    await expect(sendLifecycleEmail(user, lifecycleTemplate('welcome', user))).resolves.toBe('accepted');
    expect(mockPrisma.emailDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'delivery-1' },
        data: expect.objectContaining({
          status: 'accepted',
          provider: 'resend',
          providerMessageId: 'provider-1',
        }),
      }),
    );
    expect(mockPrisma.emailDelivery.update.mock.calls[0][0].data).not.toHaveProperty('deliveredAt');
    expect(mockSendEmailWithResult).toHaveBeenCalledWith(
      user.email,
      'Welcome to QualCanvas',
      expect.any(String),
      expect.objectContaining({
        idempotencyKey: 'qualcanvas-lifecycle-delivery-1',
        tags: [
          { name: 'delivery_kind', value: 'account' },
          { name: 'delivery_id', value: 'delivery-1' },
        ],
      }),
    );
  });

  it('blocks a Resend release until signed provider outcomes are configured', () => {
    process.env.LIFECYCLE_EMAIL_SEND_ENABLED = 'true';
    delete process.env.RESEND_WEBHOOK_SECRET;
    expect(isLifecycleSendingEnabledFor('canary@example.com')).toBe(false);

    process.env.RESEND_WEBHOOK_SECRET = 'configured';
    expect(isLifecycleSendingEnabledFor('canary@example.com')).toBe(true);
  });

  it('classifies permanent recipient and configuration failures', () => {
    expect(isPermanentEmailFailure('HTTP 422 invalid recipient')).toBe(true);
    expect(isPermanentEmailFailure('mailbox does not exist')).toBe(true);
    expect(isPermanentEmailFailure('temporary upstream timeout')).toBe(false);
  });

  it('routes the three-day training tip to the public first-project path', () => {
    const template = lifecycleTemplate('training_tip_3d', {
      id: 'u1',
      email: 'learner@example.com',
      name: 'Learner',
    });

    expect(template.subject).toBe('Your short QualCanvas first-project path');
    expect(template.ctaUrl).toBe('http://localhost:5174/training#learning-path');
    expect(template.ctaLabel).toBe('Follow the first-project path');
    expect(template.bodyHtml).toContain('fictional demonstration data');
  });

  it.each([undefined, 'false'])('blocks all new sequence paths when its guard is %s', async (flag) => {
    const user = { id: 'u1', email: 'r@ucc.ie', name: 'R' };
    const pendingTemplates = [
      lifecycleTemplate('setup_nudge_1d', user, 'no_transcript'),
      lifecycleTemplate('training_tip_3d', user, 'no_transcript'),
      lifecycleTemplate('onboarding_7d', user, 'no_coding'),
    ];
    process.env.LIFECYCLE_EMAIL_SEND_ENABLED = 'true';
    process.env.LIFECYCLE_EMAIL_AUTOMATION_ENABLED = 'true';
    if (flag === undefined) delete process.env.LIFECYCLE_SETUP_SEQUENCE_ENABLED;
    else process.env.LIFECYCLE_SETUP_SEQUENCE_ENABLED = flag;
    expect(isLifecycleSendingEnabledFor(user.email)).toBe(true);
    expect(lifecycleTemplate('training_tip_3d', user, 'no_transcript')).toEqual(
      lifecycleTemplate('training_tip_3d', user),
    );
    expect(lifecycleTemplate('onboarding_7d', user, 'no_coding')).toEqual(lifecycleTemplate('onboarding_7d', user));
    expect(() => lifecycleTemplate('setup_nudge_1d', user)).toThrow(/disabled/i);
    for (const template of pendingTemplates) expect(await sendLifecycleEmail(user, template)).toBe('skipped');
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.emailDelivery.create).not.toHaveBeenCalled();
    expect(mockSendEmailWithResult).not.toHaveBeenCalled();
  });

  it.each([
    ['no_project', 'Start your first project', '/canvas'],
    ['no_transcript', 'Add your first transcript', '/canvas'],
    ['no_coding', 'Code your first excerpt', '/canvas'],
  ] as const)('keys the day-1 nudge to the next unfinished setup step (%s)', (progress, heading, path) => {
    const template = lifecycleTemplate(
      'setup_nudge_1d',
      { id: 'u1', email: 'r@ucc.ie', name: 'Aoife Byrne' },
      progress,
    );
    expect(template.eventKey).toBe('setup_nudge_1d_v1');
    expect(template.title).toBe(heading);
    expect(template.ctaUrl).toBe(`http://localhost:5174${path}`);
    expect(template.bodyHtml).toContain('Hi Aoife');
  });

  it('tells a researcher on day 3 and day 7 which setup step is still open', () => {
    const tip = lifecycleTemplate('training_tip_3d', { id: 'u1', email: 'r@ucc.ie', name: 'R' }, 'no_transcript');
    expect(tip.bodyHtml).toContain('Your next step: add your first transcript');
    const week = lifecycleTemplate('onboarding_7d', { id: 'u1', email: 'r@ucc.ie', name: 'R' }, 'no_coding');
    expect(week.bodyHtml).toContain('Your next step: code your first excerpt');
  });

  it('requests both account and newsletter delivery counts per campaign', async () => {
    mockPrisma.emailCampaign.findMany.mockResolvedValue([]);

    await listEmailCampaigns();

    expect(mockPrisma.emailCampaign.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { deliveries: true, newsletterDeliveries: true } },
      },
    });
  });
});
