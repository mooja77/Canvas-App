import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockStripe } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    subscription: { findUnique: vi.fn() },
    teamMember: { findMany: vi.fn() },
  },
  mockStripe: {
    subscriptions: { retrieve: vi.fn() },
    subscriptionItems: { update: vi.fn() },
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../lib/stripe.js', () => ({ getStripe: () => mockStripe }));

import { syncTeamSeatQuantity } from './teamBilling.js';

describe('syncTeamSeatQuantity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ plan: 'team' });
    mockPrisma.subscription.findUnique.mockResolvedValue({
      status: 'active',
      stripeSubscriptionId: 'sub_1',
      stripePriceId: 'price_team',
    });
    mockPrisma.teamMember.findMany.mockResolvedValue([{ userId: 'owner' }, { userId: 'member-1' }]);
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      items: {
        data: [
          { id: 'item_other', price: { id: 'price_other' } },
          { id: 'item_team', price: { id: 'price_team' } },
        ],
      },
    });
    mockStripe.subscriptionItems.update.mockResolvedValue({});
  });

  it('updates the matching Stripe item to the distinct seat count', async () => {
    await expect(syncTeamSeatQuantity('owner')).resolves.toBe(2);

    expect(mockPrisma.teamMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: { userId: true }, distinct: ['userId'] }),
    );
    expect(mockStripe.subscriptionItems.update).toHaveBeenCalledWith('item_team', {
      quantity: 2,
      proration_behavior: 'create_prorations',
    });
  });

  it('keeps one owner seat when the final team is excluded', async () => {
    mockPrisma.teamMember.findMany.mockResolvedValue([]);

    await expect(syncTeamSeatQuantity('owner', { excludeTeamId: 'team-1' })).resolves.toBe(1);
    expect(mockPrisma.teamMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { team: { ownerId: 'owner', id: { not: 'team-1' } } },
      }),
    );
    expect(mockStripe.subscriptionItems.update).toHaveBeenCalledWith(
      'item_team',
      expect.objectContaining({ quantity: 1 }),
    );
  });

  it('does not touch Stripe when the owner has no active Team subscription', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ status: 'canceled' });

    await expect(syncTeamSeatQuantity('owner')).rejects.toMatchObject({ statusCode: 409 });
    expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });
});
