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
});
