import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

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

vi.mock('../../middleware/authLimiter.js', () => ({
  authLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../middleware/auditLog.js', () => ({
  logAudit: vi.fn(),
  auditLog: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../utils/hashing.js', () => ({
  sha256: vi.fn().mockReturnValue('sha256hash'),
  verifyAccessCode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../middleware/planLimits.js', () => ({
  checkCanvasLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkTranscriptLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkWordLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkCodeLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkAutoCode: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkCaseAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkShareLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkAnalysisType: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkAnalysisTypeOnRun: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('mock12nanoid'),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$12$hashedpassword'),
    compare: vi.fn(),
  },
}));

import { handleStripeWebhook } from '../../routes/billingRoutes.js';
import request from 'supertest';
import express from 'express';
import { auth } from '../../middleware/auth.js';
import { billingRoutes } from '../../routes/billingRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

// ─── Helper to create mock req/res for webhook handler ───
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

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', auth, billingRoutes);
  app.use(errorHandler);
  return app;
}

// ═══════════════════════════════════════════════════════════
// Extended billing / Stripe tests — fills gaps not covered
// by billing.test.ts
// ═══════════════════════════════════════════════════════════

describe('Stripe Billing – Extended Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.create.mockResolvedValue({});
  });

  // ─── Webhook: checkout.session.completed with Team plan ───
  describe('checkout.session.completed – Team plan', () => {
    it('sets user plan to team when metadata.plan=team', async () => {
      const event = {
        id: 'evt_team_checkout_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: 'user-team-1', plan: 'team' },
            subscription: 'sub_team_123',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        items: {
          data: [{
            price: { id: 'price_team_monthly' },
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
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-team-1' },
        data: { plan: 'team' },
      });
    });
  });

  // ─── Webhook: subscription.updated status transitions ───
  describe('customer.subscription.updated – plan transitions', () => {
    it('downgrades user to free when status=canceled', async () => {
      const event = {
        id: 'evt_sub_cancel_1',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_cancel_1',
            status: 'canceled',
            current_period_start: 1700000000,
            current_period_end: 1702592000,
            cancel_at_period_end: false,
            items: { data: [{ price: { id: 'price_pro_monthly' } }] },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-record-cancel',
        userId: 'user-cancel-1',
        stripeSubscriptionId: 'sub_cancel_1',
        stripePriceId: 'price_pro_monthly',
      });
      mockPrisma.subscription.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripeSubscriptionId: 'sub_cancel_1' },
          data: expect.objectContaining({ status: 'canceled' }),
        }),
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-cancel-1' },
        data: { plan: 'free' },
      });
    });

    it('keeps user plan when status=active (no downgrade)', async () => {
      const event = {
        id: 'evt_sub_active_1',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_active_1',
            status: 'active',
            current_period_start: 1700000000,
            current_period_end: 1702592000,
            cancel_at_period_end: false,
            items: { data: [{ price: { id: 'price_pro_annual' } }] },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-record-active',
        userId: 'user-active-1',
        stripeSubscriptionId: 'sub_active_1',
        stripePriceId: 'price_pro_monthly',
      });
      mockPrisma.subscription.update.mockResolvedValue({});

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      // Should NOT downgrade the user when status is active
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('updates price ID when subscription price changes (monthly→annual)', async () => {
      const event = {
        id: 'evt_sub_price_change',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_price_change',
            status: 'active',
            current_period_start: 1700000000,
            current_period_end: 1731500000,
            cancel_at_period_end: false,
            items: { data: [{ price: { id: 'price_pro_annual' } }] },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-record-price',
        userId: 'user-price-1',
        stripeSubscriptionId: 'sub_price_change',
        stripePriceId: 'price_pro_monthly',
      });
      mockPrisma.subscription.update.mockResolvedValue({});

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stripePriceId: 'price_pro_annual',
          }),
        }),
      );
    });

    it('records cancelAtPeriodEnd when subscription set to cancel at end', async () => {
      const event = {
        id: 'evt_sub_cancel_eop',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_cancel_eop',
            status: 'active',
            current_period_start: 1700000000,
            current_period_end: 1702592000,
            cancel_at_period_end: true,
            items: { data: [{ price: { id: 'price_pro_monthly' } }] },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-record-eop',
        userId: 'user-eop-1',
        stripeSubscriptionId: 'sub_cancel_eop',
        stripePriceId: 'price_pro_monthly',
      });
      mockPrisma.subscription.update.mockResolvedValue({});

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cancelAtPeriodEnd: true }),
        }),
      );
      // Status is still active → should NOT downgrade user
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('downgrades user to free when status=past_due', async () => {
      const event = {
        id: 'evt_sub_pastdue',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_pastdue',
            status: 'past_due',
            current_period_start: 1700000000,
            current_period_end: 1702592000,
            cancel_at_period_end: false,
            items: { data: [{ price: { id: 'price_pro_monthly' } }] },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-record-pd',
        userId: 'user-pd-1',
        stripeSubscriptionId: 'sub_pastdue',
        stripePriceId: 'price_pro_monthly',
      });
      mockPrisma.subscription.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-pd-1' },
        data: { plan: 'free' },
      });
    });

    it('keeps user active when status=trialing', async () => {
      const event = {
        id: 'evt_sub_trial',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_trial_1',
            status: 'trialing',
            current_period_start: 1700000000,
            current_period_end: 1702592000,
            cancel_at_period_end: false,
            items: { data: [{ price: { id: 'price_pro_monthly' } }] },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-record-trial',
        userId: 'user-trial-1',
        stripeSubscriptionId: 'sub_trial_1',
        stripePriceId: 'price_pro_monthly',
      });
      mockPrisma.subscription.update.mockResolvedValue({});

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      // trialing is in the allowed list → should NOT downgrade
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ─── Webhook: checkout.session.completed missing userId ───
  describe('checkout.session.completed – edge cases', () => {
    it('skips processing when metadata.userId is missing', async () => {
      const event = {
        id: 'evt_no_user',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: {},
            subscription: 'sub_orphan',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
      expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('skips processing when subscription ID is missing', async () => {
      const event = {
        id: 'evt_no_sub',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: 'user-nosub', plan: 'pro' },
            subscription: null,
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
      expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
    });
  });

  // ─── Webhook: unrecognized event type is silently accepted ───
  describe('Unrecognized event type', () => {
    it('returns received:true for unknown event type', async () => {
      const event = {
        id: 'evt_unknown_type',
        type: 'payment_method.attached',
        data: { object: {} },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ─── Webhook: handler error returns 500 ───
  describe('Webhook processing error', () => {
    it('returns 500 when processing throws an error', async () => {
      const event = {
        id: 'evt_error',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: 'user-err', plan: 'pro' },
            subscription: 'sub_err',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockRejectedValue(new Error('Stripe API error'));

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Webhook processing failed' });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Checkout Session & Portal – supertest route tests
  // ═══════════════════════════════════════════════════════════

  describe('POST /api/billing/create-checkout', () => {
    const userId = 'user-checkout-1';
    let jwt: string;
    let app: express.Express;

    beforeEach(() => {
      jwt = signUserToken(userId, 'researcher', 'pro');
      app = createApp();
    });

    it('returns session URL with valid priceId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'checkout@example.com',
        name: 'Checkout User',
        role: 'researcher',
        plan: 'pro',
        stripeCustomerId: 'cus_existing',
      });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session/test',
      });

      const res = await request(app)
        .post('/api/billing/create-checkout')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ priceId: 'price_pro_monthly', plan: 'pro' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toBe('https://checkout.stripe.com/session/test');
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/billing/create-checkout')
        .send({ priceId: 'price_pro_monthly' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when priceId is missing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'checkout@example.com',
        name: 'Checkout User',
        role: 'researcher',
        plan: 'pro',
        stripeCustomerId: 'cus_existing',
      });

      const res = await request(app)
        .post('/api/billing/create-checkout')
        .set('Authorization', `Bearer ${jwt}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('creates Stripe customer when user has no stripeCustomerId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'new@example.com',
        name: 'New User',
        role: 'researcher',
        plan: 'pro',
        stripeCustomerId: null,
      });
      mockStripe.customers.create.mockResolvedValue({ id: 'cus_new_123' });
      mockPrisma.user.update.mockResolvedValue({});
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session/new',
      });

      const res = await request(app)
        .post('/api/billing/create-checkout')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ priceId: 'price_pro_monthly', plan: 'pro' });

      expect(res.status).toBe(200);
      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com' }),
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { stripeCustomerId: 'cus_new_123' },
      });
    });

    it('applies academic discount for .edu email', async () => {
      process.env.STRIPE_ACADEMIC_COUPON_ID = 'coupon_academic';
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'student@university.edu',
        name: 'Student',
        role: 'researcher',
        plan: 'pro',
        stripeCustomerId: 'cus_edu_1',
      });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session/edu',
      });

      const res = await request(app)
        .post('/api/billing/create-checkout')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ priceId: 'price_pro_monthly', plan: 'pro' });

      expect(res.status).toBe(200);
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          discounts: [{ coupon: 'coupon_academic' }],
        }),
      );
      delete process.env.STRIPE_ACADEMIC_COUPON_ID;
    });

    it('does not apply academic discount for non-.edu email', async () => {
      process.env.STRIPE_ACADEMIC_COUPON_ID = 'coupon_academic';
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'user@gmail.com',
        name: 'User',
        role: 'researcher',
        plan: 'pro',
        stripeCustomerId: 'cus_nonedu',
      });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session/nonedu',
      });

      await request(app)
        .post('/api/billing/create-checkout')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ priceId: 'price_pro_monthly', plan: 'pro' });

      // Should NOT include discounts for non-edu emails
      const createCall = mockStripe.checkout.sessions.create.mock.calls[0][0];
      expect(createCall.discounts).toBeUndefined();
      delete process.env.STRIPE_ACADEMIC_COUPON_ID;
    });
  });

  describe('POST /api/billing/create-portal', () => {
    const userId = 'user-portal-1';
    let jwt: string;
    let app: express.Express;

    beforeEach(() => {
      jwt = signUserToken(userId, 'researcher', 'pro');
      app = createApp();
    });

    it('returns portal URL for subscribed user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'portal@example.com',
        role: 'researcher',
        plan: 'pro',
        stripeCustomerId: 'cus_portal_1',
      });
      mockStripe.billingPortal.sessions.create.mockResolvedValue({
        url: 'https://billing.stripe.com/portal/test',
      });

      const res = await request(app)
        .post('/api/billing/create-portal')
        .set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toBe('https://billing.stripe.com/portal/test');
    });

    it('returns error for user without stripeCustomerId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'free@example.com',
        role: 'researcher',
        plan: 'free',
        stripeCustomerId: null,
      });

      const res = await request(app)
        .post('/api/billing/create-portal')
        .set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(404);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/billing/create-portal');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/billing/subscription', () => {
    const userId = 'user-sub-1';
    let jwt: string;
    let app: express.Express;

    beforeEach(() => {
      jwt = signUserToken(userId, 'researcher', 'pro');
      app = createApp();
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'sub@example.com',
        role: 'researcher',
        plan: 'pro',
      });
    });

    it('returns subscription details for subscribed user', async () => {
      const periodStart = new Date('2025-01-01');
      const periodEnd = new Date('2025-02-01');
      mockPrisma.subscription.findUnique.mockResolvedValue({
        userId,
        status: 'active',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      });

      const res = await request(app)
        .get('/api/billing/subscription')
        .set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        status: 'active',
        currentPeriodStart: periodStart.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
        cancelAtPeriodEnd: false,
      });
    });

    it('returns null for free user with no subscription', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/billing/subscription')
        .set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeNull();
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .get('/api/billing/subscription');

      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Stripe Webhook Edge Cases (merged from billing-stripe-edge)
  // ═══════════════════════════════════════════════════════════════

  describe('Stripe Webhook – Edge Cases', () => {
    // ─── checkout.session.completed stores correct price ID from subscription ───
    it('checkout.session.completed persists the price ID from Stripe sub items', async () => {
      const event = {
        id: 'evt_price_persist',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: 'user-pp', plan: 'pro' },
            subscription: 'sub_pp',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        items: {
          data: [{
            price: { id: 'price_pro_annual' },
            current_period_start: 1700000000,
            current_period_end: 1731536000,
          }],
        },
      });
      mockPrisma.subscription.upsert.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ stripePriceId: 'price_pro_annual' }),
          update: expect.objectContaining({ stripePriceId: 'price_pro_annual' }),
        }),
      );
    });

    // ─── checkout.session.completed records correct period dates ───
    it('checkout.session.completed converts Unix timestamps to Date objects', async () => {
      const periodStart = 1700000000;
      const periodEnd = 1702592000;
      const event = {
        id: 'evt_dates',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: 'user-dates', plan: 'pro' },
            subscription: 'sub_dates',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        items: {
          data: [{
            price: { id: 'price_pro_monthly' },
            current_period_start: periodStart,
            current_period_end: periodEnd,
          }],
        },
      });
      mockPrisma.subscription.upsert.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            currentPeriodStart: new Date(periodStart * 1000),
            currentPeriodEnd: new Date(periodEnd * 1000),
          }),
        }),
      );
    });

    // ─── customer.subscription.deleted triggers $transaction for atomicity ───
    it('customer.subscription.deleted uses $transaction for atomic downgrade', async () => {
      const event = {
        id: 'evt_del_atomic',
        type: 'customer.subscription.deleted',
        data: {
          object: { id: 'sub_del_atomic' },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-rec-atomic',
        userId: 'user-atomic',
        stripeSubscriptionId: 'sub_del_atomic',
        user: { id: 'user-atomic', plan: 'pro' },
      });
      mockPrisma.subscription.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      const txnArgs = mockPrisma.$transaction.mock.calls[0][0];
      expect(txnArgs).toHaveLength(2);
    });

    // ─── invoice.payment_failed uses $transaction ───
    it('invoice.payment_failed uses $transaction for atomic downgrade', async () => {
      const event = {
        id: 'evt_inv_atomic',
        type: 'invoice.payment_failed',
        data: {
          object: { subscription: 'sub_inv_atomic' },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-rec-inv',
        userId: 'user-inv',
        stripeSubscriptionId: 'sub_inv_atomic',
      });
      mockPrisma.subscription.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    // ─── Duplicate event across different types is idempotent ───
    it('duplicate event is idempotent regardless of type', async () => {
      const event = {
        id: 'evt_dup_type',
        type: 'customer.subscription.deleted',
        data: {
          object: { id: 'sub_dup' },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.webhookEvent.findUnique.mockResolvedValue({
        id: 'evt_dup_type',
        type: 'customer.subscription.deleted',
      });

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
      expect(mockPrisma.webhookEvent.create).not.toHaveBeenCalled();
      expect(mockPrisma.subscription.findUnique).not.toHaveBeenCalled();
    });

    // ─── Webhook records the event before processing ───
    it('webhook creates event record before processing logic', async () => {
      const event = {
        id: 'evt_record_first',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: 'user-rec', plan: 'pro' },
            subscription: 'sub_rec',
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

      expect(mockPrisma.webhookEvent.create).toHaveBeenCalledWith({
        data: { id: 'evt_record_first', type: 'checkout.session.completed' },
      });
    });

    // ─── subscription.updated with empty items falls back to existing priceId ───
    it('subscription.updated falls back to existing priceId when items.data is empty', async () => {
      const event = {
        id: 'evt_empty_items',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_empty_items',
            status: 'active',
            current_period_start: 1700000000,
            current_period_end: 1702592000,
            cancel_at_period_end: false,
            items: { data: [] },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-rec-empty',
        userId: 'user-empty',
        stripeSubscriptionId: 'sub_empty_items',
        stripePriceId: 'price_pro_monthly',
      });
      mockPrisma.subscription.update.mockResolvedValue({});

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stripePriceId: 'price_pro_monthly',
          }),
        }),
      );
    });

    // ─── Multiple rapid events with unique IDs all get processed ───
    it('processes two events with different IDs independently', async () => {
      const event1 = {
        id: 'evt_rapid_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: 'user-r1', plan: 'pro' },
            subscription: 'sub_r1',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event1);
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

      const { req: req1, res: res1 } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req1, res1);

      expect(res1.json).toHaveBeenCalledWith({ received: true });
      expect(mockPrisma.webhookEvent.create).toHaveBeenCalledWith({
        data: { id: 'evt_rapid_1', type: 'checkout.session.completed' },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Billing Route Edge Cases (merged from billing-stripe-edge)
  // ═══════════════════════════════════════════════════════════════

  describe('Billing Routes – Edge Cases', () => {
    const edgeUserId = 'user-edge-1';
    let edgeJwt: string;
    let edgeApp: express.Express;

    beforeEach(() => {
      edgeApp = createApp();
      edgeJwt = signUserToken(edgeUserId, 'researcher', 'pro');
    });

    // ─── create-checkout with non-string priceId returns 400 ───
    it('POST /billing/create-checkout with numeric priceId returns 400', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: edgeUserId,
        email: 'edge@example.com',
        name: 'Edge',
        role: 'researcher',
        plan: 'pro',
        stripeCustomerId: 'cus_edge',
        dashboardAccess: { id: 'da-edge' },
      });

      const res = await request(edgeApp)
        .post('/api/billing/create-checkout')
        .set('Authorization', `Bearer ${edgeJwt}`)
        .send({ priceId: 12345 });

      expect(res.status).toBe(400);
    });

    // ─── create-checkout passes metadata to Stripe session ───
    it('POST /billing/create-checkout passes userId and plan in session metadata', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: edgeUserId,
        email: 'meta@example.com',
        name: 'Meta User',
        role: 'researcher',
        plan: 'pro',
        stripeCustomerId: 'cus_meta',
        dashboardAccess: { id: 'da-meta' },
      });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/meta',
      });

      await request(edgeApp)
        .post('/api/billing/create-checkout')
        .set('Authorization', `Bearer ${edgeJwt}`)
        .send({ priceId: 'price_team_monthly', plan: 'team' });

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            userId: edgeUserId,
            plan: 'team',
          }),
        }),
      );
    });

    // ─── create-checkout defaults plan to pro if not sent ───
    it('POST /billing/create-checkout defaults plan to pro when not provided', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: edgeUserId,
        email: 'default@example.com',
        name: 'Default Plan',
        role: 'researcher',
        plan: 'pro',
        stripeCustomerId: 'cus_default',
        dashboardAccess: { id: 'da-default' },
      });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/default',
      });

      await request(edgeApp)
        .post('/api/billing/create-checkout')
        .set('Authorization', `Bearer ${edgeJwt}`)
        .send({ priceId: 'price_pro_monthly' });

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            plan: 'pro',
          }),
        }),
      );
    });

    // ─── create-portal passes correct return_url ───
    it('POST /billing/create-portal passes correct return_url from APP_URL', async () => {
      process.env.APP_URL = 'https://qualcanvas.com';
      mockPrisma.user.findUnique.mockResolvedValue({
        id: edgeUserId,
        email: 'portal@example.com',
        name: 'Portal',
        role: 'researcher',
        plan: 'pro',
        stripeCustomerId: 'cus_portal',
        dashboardAccess: { id: 'da-portal' },
      });
      mockStripe.billingPortal.sessions.create.mockResolvedValue({
        url: 'https://billing.stripe.com/portal',
      });

      await request(edgeApp)
        .post('/api/billing/create-portal')
        .set('Authorization', `Bearer ${edgeJwt}`);

      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          return_url: 'https://qualcanvas.com/account',
        }),
      );
      delete process.env.APP_URL;
    });

    // ─── create-checkout uses subscription mode ───
    it('POST /billing/create-checkout creates session in subscription mode', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: edgeUserId,
        email: 'mode@example.com',
        name: 'Mode',
        role: 'researcher',
        plan: 'pro',
        stripeCustomerId: 'cus_mode',
        dashboardAccess: { id: 'da-mode' },
      });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/mode',
      });

      await request(edgeApp)
        .post('/api/billing/create-checkout')
        .set('Authorization', `Bearer ${edgeJwt}`)
        .send({ priceId: 'price_pro_monthly', plan: 'pro' });

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          line_items: [{ price: 'price_pro_monthly', quantity: 1 }],
        }),
      );
    });

    // ─── Subscription with cancelAtPeriodEnd reports correctly ───
    it('GET /billing/subscription returns cancelAtPeriodEnd=true when set', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: edgeUserId,
        email: 'cancel@example.com',
        name: 'Cancel',
        role: 'researcher',
        plan: 'pro',
        dashboardAccess: { id: 'da-cancel' },
      });
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-cancel',
        userId: edgeUserId,
        status: 'active',
        currentPeriodStart: new Date('2025-01-01'),
        currentPeriodEnd: new Date('2025-02-01'),
        cancelAtPeriodEnd: true,
      });

      const res = await request(edgeApp)
        .get('/api/billing/subscription')
        .set('Authorization', `Bearer ${edgeJwt}`);

      expect(res.status).toBe(200);
      expect(res.body.data.cancelAtPeriodEnd).toBe(true);
      expect(res.body.data.status).toBe('active');
    });

    // ─── create-checkout success/cancel URLs use APP_URL ───
    it('POST /billing/create-checkout uses APP_URL for success/cancel URLs', async () => {
      process.env.APP_URL = 'https://qualcanvas.com';
      mockPrisma.user.findUnique.mockResolvedValue({
        id: edgeUserId,
        email: 'urls@example.com',
        name: 'URLs',
        role: 'researcher',
        plan: 'pro',
        stripeCustomerId: 'cus_urls',
        dashboardAccess: { id: 'da-urls' },
      });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/urls',
      });

      await request(edgeApp)
        .post('/api/billing/create-checkout')
        .set('Authorization', `Bearer ${edgeJwt}`)
        .send({ priceId: 'price_pro_monthly', plan: 'pro' });

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: expect.stringContaining('https://qualcanvas.com/account'),
          cancel_url: 'https://qualcanvas.com/pricing',
        }),
      );
      delete process.env.APP_URL;
    });

    // ─── create-checkout sets customer ID on the Stripe session ───
    it('POST /billing/create-checkout passes existing stripeCustomerId to Stripe session', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: edgeUserId,
        email: 'custid@example.com',
        name: 'CustId User',
        role: 'researcher',
        plan: 'pro',
        stripeCustomerId: 'cus_existing_42',
        dashboardAccess: { id: 'da-custid' },
      });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/custid',
      });

      await request(edgeApp)
        .post('/api/billing/create-checkout')
        .set('Authorization', `Bearer ${edgeJwt}`)
        .send({ priceId: 'price_pro_monthly', plan: 'pro' });

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_existing_42',
        }),
      );
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });

    // ─── Webhook with missing stripe-signature header ───
    it('returns 400 when stripe-signature header is missing', async () => {
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature for payload');
      });

      const req = {
        body: Buffer.from('{}'),
        headers: { 'stripe-signature': '' },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      } as unknown as Response;

      await handleStripeWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
    });

    // ─── checkout.session.completed handles subscription retrieve failure ───
    it('returns 500 when Stripe subscription retrieve fails', async () => {
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.webhookEvent.create.mockResolvedValue({});

      const event = {
        id: 'evt_stripe_fail',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: 'user-fail', plan: 'pro' },
            subscription: 'sub_fail',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockRejectedValue(new Error('Stripe rate limited'));

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Webhook processing failed' });
    });

    // ─── checkout.session.completed with empty price falls back ───
    it('checkout.session.completed handles missing price.id gracefully', async () => {
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.webhookEvent.create.mockResolvedValue({});

      const event = {
        id: 'evt_no_price',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: 'user-noprice', plan: 'pro' },
            subscription: 'sub_noprice',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        items: {
          data: [{ price: null, current_period_start: 1700000000, current_period_end: 1702592000 }],
        },
      });
      mockPrisma.subscription.upsert.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ stripePriceId: '' }),
        }),
      );
    });

    // ─── subscription.deleted includes user in query ───
    it('customer.subscription.deleted queries subscription with user include', async () => {
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.webhookEvent.create.mockResolvedValue({});

      const event = {
        id: 'evt_del_include',
        type: 'customer.subscription.deleted',
        data: {
          object: { id: 'sub_del_inc' },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-rec-inc',
        userId: 'user-inc',
        stripeSubscriptionId: 'sub_del_inc',
        user: { id: 'user-inc', plan: 'team' },
      });
      mockPrisma.subscription.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const { req, res } = createMockReqRes(Buffer.from('{}'));
      await handleStripeWebhook(req, res);

      expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_del_inc' },
        include: { user: true },
      });
    });
  });
});
