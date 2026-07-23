import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    emailCampaign: { count: vi.fn(), findMany: vi.fn() },
    emailDelivery: { count: vi.fn() },
    emailPreference: { count: vi.fn() },
    newsletterDelivery: { count: vi.fn() },
    newsletterSubscriber: { count: vi.fn() },
  },
}));

vi.mock('./prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./email.js', () => ({ sendEmail: vi.fn() }));

import { getEmailStats, listEmailCampaigns } from './lifecycleEmail.js';

describe('lifecycle email reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes account and newsletter delivery totals', async () => {
    mockPrisma.emailCampaign.count.mockResolvedValue(3);
    mockPrisma.emailDelivery.count.mockResolvedValueOnce(10).mockResolvedValueOnce(2).mockResolvedValueOnce(4);
    mockPrisma.newsletterDelivery.count.mockResolvedValueOnce(7).mockResolvedValueOnce(1);
    mockPrisma.emailPreference.count.mockResolvedValue(5);
    mockPrisma.newsletterSubscriber.count.mockResolvedValue(6);

    await expect(getEmailStats()).resolves.toEqual({
      campaigns: 3,
      sent: 17,
      failed: 3,
      skipped: 4,
      unsubscribed: 11,
    });
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
