import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockSendEmailWithResult } = vi.hoisted(() => ({
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
}));

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
  });

  afterEach(() => {
    delete process.env.LIFECYCLE_EMAIL_SEND_ENABLED;
    delete process.env.LIFECYCLE_EMAIL_ALLOW_ALL_RECIPIENTS;
    delete process.env.LIFECYCLE_EMAIL_RECIPIENT_ALLOWLIST;
  });

  it('includes account and newsletter delivery totals', async () => {
    mockPrisma.emailCampaign.count.mockResolvedValue(3);
    mockPrisma.emailDelivery.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(4);
    mockPrisma.newsletterDelivery.count
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);
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

  it('keeps all lifecycle delivery disabled unless both master and recipient scope gates pass', () => {
    process.env.LIFECYCLE_EMAIL_RECIPIENT_ALLOWLIST = 'canary@example.com';
    expect(isLifecycleSendingEnabledFor('canary@example.com')).toBe(false);

    process.env.LIFECYCLE_EMAIL_SEND_ENABLED = 'true';
    expect(isLifecycleSendingEnabledFor('canary@example.com')).toBe(true);
    expect(isLifecycleSendingEnabledFor('someone-else@example.com')).toBe(false);
  });

  it('records provider acceptance without calling it delivered', async () => {
    process.env.LIFECYCLE_EMAIL_SEND_ENABLED = 'true';
    process.env.LIFECYCLE_EMAIL_RECIPIENT_ALLOWLIST = 'canary@example.com';
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
  });

  it('classifies permanent recipient and configuration failures', () => {
    expect(isPermanentEmailFailure('HTTP 422 invalid recipient')).toBe(true);
    expect(isPermanentEmailFailure('mailbox does not exist')).toBe(true);
    expect(isPermanentEmailFailure('temporary upstream timeout')).toBe(false);
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
