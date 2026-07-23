import { prisma } from '../lib/prisma.js';
import { getStripe } from '../lib/stripe.js';
import { AppError } from '../middleware/errorHandler.js';

const BILLABLE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due']);

/**
 * Keep a Team subscription's Stripe quantity aligned with the distinct seats
 * across teams owned by this account. The owner always consumes one seat.
 */
export async function syncTeamSeatQuantity(ownerId: string, options: { excludeTeamId?: string } = {}): Promise<number> {
  const [owner, subscription, memberships] = await Promise.all([
    prisma.user.findUnique({ where: { id: ownerId }, select: { plan: true } }),
    prisma.subscription.findUnique({ where: { userId: ownerId } }),
    prisma.teamMember.findMany({
      where: {
        team: {
          ownerId,
          ...(options.excludeTeamId ? { id: { not: options.excludeTeamId } } : {}),
        },
      },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ]);

  if (!owner || owner.plan !== 'team') {
    throw new AppError('The team owner does not have a Team plan', 403);
  }
  if (!subscription || !BILLABLE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    throw new AppError('An active Team subscription is required to change seats', 409);
  }

  const quantity = Math.max(1, new Set(memberships.map((membership) => membership.userId)).size);
  const stripe = getStripe();
  const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
  const item =
    stripeSubscription.items.data.find((candidate) => candidate.price.id === subscription.stripePriceId) ??
    stripeSubscription.items.data[0];
  if (!item) throw new AppError('Team subscription has no billable item', 409);

  await stripe.subscriptionItems.update(item.id, {
    quantity,
    proration_behavior: 'create_prorations',
  });
  return quantity;
}
