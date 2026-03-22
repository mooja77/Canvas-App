import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// ─── Mock Prisma before any imports that use it ───
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    webhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

// ─── Mock Stripe ───
const { mockStripe } = vi.hoisted(() => {
  const mockStripe = {
    webhooks: {
      constructEvent: vi.fn(),
    },
    subscriptions: {
      retrieve: vi.fn(),
    },
    customers: {
      create: vi.fn(),
    },
    checkout: {
      sessions: { create: vi.fn() },
    },
    billingPortal: {
      sessions: { create: vi.fn() },
    },
  };
  return { mockStripe };
});

vi.mock('../../lib/stripe.js', () => ({
  getStripe: vi.fn().mockReturnValue(mockStripe),
}));

import { handleStripeWebhook } from '../../routes/billingRoutes.js';

// ─── Helper to create mock req/res ───
function createMockReqRes(body: Buffer | string, sig = 'valid-signature') {
  const req = {
    body,
    headers: { 'stripe-signature': sig },
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  return { req, res };
}

describe('Stripe Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
    // By default, no duplicate events
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.create.mockResolvedValue({});
  });

  // ─── 1. checkout.session.completed ───
  describe('checkout.session.completed', () => {
    it('creates/updates subscription and sets user plan', async () => {
      const event = {
        id: 'evt_checkout_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: 'user-1', plan: 'pro' },
            subscription: 'sub_123',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        items: {
          data: [{
            price: { id: 'price_pro_monthly' },
            current_period_start: 1700000000,
            current_period_end: 1702592000,
          }],
        },
      });
      mockPrisma.subscription.upsert.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          create: expect.objectContaining({
            userId: 'user-1',
            stripeSubscriptionId: 'sub_123',
            status: 'active',
          }),
          update: expect.objectContaining({
            stripeSubscriptionId: 'sub_123',
            status: 'active',
          }),
        }),
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { plan: 'pro' },
      });
    });

    it('defaults plan to pro when not specified in metadata', async () => {
      const event = {
        id: 'evt_checkout_2',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: 'user-2' },
            subscription: 'sub_456',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        items: {
          data: [{
            price: { id: 'price_pro_monthly' },
            current_period_start: 1700000000,
            current_period_end: 1702592000,
          }],
        },
      });
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-2' },
        data: { plan: 'pro' },
      });
    });
  });

  // ─── 2. customer.subscription.updated ───
  describe('customer.subscription.updated', () => {
    it('updates subscription status and period', async () => {
      const event = {
        id: 'evt_sub_updated_1',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            status: 'active',
            current_period_start: 1700000000,
            current_period_end: 1702592000,
            cancel_at_period_end: false,
            items: {
              data: [{ price: { id: 'price_pro_annual' } }],
            },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-record-1',
        stripeSubscriptionId: 'sub_123',
        stripePriceId: 'price_pro_monthly',
      });
      mockPrisma.subscription.update.mockResolvedValue({});

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_123' },
        data: {
          status: 'active',
          currentPeriodStart: new Date(1700000000 * 1000),
          currentPeriodEnd: new Date(1702592000 * 1000),
          cancelAtPeriodEnd: false,
          stripePriceId: 'price_pro_annual',
        },
      });
    });

    it('skips update when subscription not found in DB', async () => {
      const event = {
        id: 'evt_sub_updated_2',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_unknown',
            status: 'active',
            current_period_start: 1700000000,
            current_period_end: 1702592000,
            cancel_at_period_end: false,
            items: { data: [{ price: { id: 'price_x' } }] },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    });
  });

  // ─── 3. customer.subscription.deleted ───
  describe('customer.subscription.deleted', () => {
    it('downgrades user to free plan', async () => {
      const event = {
        id: 'evt_sub_deleted_1',
        type: 'customer.subscription.deleted',
        data: {
          object: { id: 'sub_123' },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-record-1',
        userId: 'user-1',
        stripeSubscriptionId: 'sub_123',
        user: { id: 'user-1', plan: 'pro' },
      });
      mockPrisma.subscription.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_123' },
        data: { status: 'canceled' },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { plan: 'free' },
      });
    });

    it('skips when subscription not found in DB', async () => {
      const event = {
        id: 'evt_sub_deleted_2',
        type: 'customer.subscription.deleted',
        data: {
          object: { id: 'sub_unknown' },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ─── 4. invoice.payment_failed ───
  describe('invoice.payment_failed', () => {
    it('marks subscription as past_due', async () => {
      const event = {
        id: 'evt_invoice_failed_1',
        type: 'invoice.payment_failed',
        data: {
          object: {
            subscription: 'sub_123',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
      expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_123' },
        data: { status: 'past_due' },
      });
    });

    it('handles invoice without subscription gracefully', async () => {
      const event = {
        id: 'evt_invoice_failed_2',
        type: 'invoice.payment_failed',
        data: {
          object: { subscription: null },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
      expect(mockPrisma.subscription.updateMany).not.toHaveBeenCalled();
    });
  });

  // ─── 5. Invalid signature ───
  describe('Invalid webhook signature', () => {
    it('rejects with 400 when signature is invalid', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Webhook signature verification failed');
      });

      const { req, res } = createMockReqRes(Buffer.from('{}'), 'bad-sig');
      await handleStripeWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
    });
  });

  // ─── 6. Duplicate / idempotent ───
  describe('Idempotency', () => {
    it('returns received:true without re-processing duplicate events', async () => {
      const event = {
        id: 'evt_already_processed',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: 'user-1', plan: 'pro' },
            subscription: 'sub_123',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      // Simulate already-processed event
      mockPrisma.webhookEvent.findUnique.mockResolvedValue({
        id: 'evt_already_processed',
        type: 'checkout.session.completed',
      });

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
      // Should NOT have created the webhook event again
      expect(mockPrisma.webhookEvent.create).not.toHaveBeenCalled();
      // Should NOT have processed subscription logic
      expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ─── Edge: missing webhook secret ───
  describe('Missing webhook secret', () => {
    it('returns 500 when STRIPE_WEBHOOK_SECRET is not configured', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Webhook not configured' });
    });
  });
});
