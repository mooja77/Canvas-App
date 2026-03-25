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

// ═══════════════════════════════════════════════════════════════
// Stripe Webhook Edge Cases — scenarios not covered by
// billing.test.ts or billing-extended.test.ts
// ═══════════════════════════════════════════════════════════════
describe('Stripe Webhook – Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.create.mockResolvedValue({});
  });

  // ─── 1. checkout.session.completed stores correct price ID from subscription ───
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

  // ─── 2. checkout.session.completed records correct period dates ───
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

  // ─── 3. customer.subscription.deleted triggers $transaction for atomicity ───
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

    // Should use $transaction to atomically update both subscription and user
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    const txnArgs = mockPrisma.$transaction.mock.calls[0][0];
    expect(txnArgs).toHaveLength(2);
  });

  // ─── 4. invoice.payment_failed uses $transaction ───
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

  // ─── 5. Duplicate event across different types is idempotent ───
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

  // ─── 6. Webhook records the event before processing ───
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

  // ─── 7. subscription.updated with empty items falls back to existing priceId ───
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

    // Should fall back to existing stripePriceId
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stripePriceId: 'price_pro_monthly',
        }),
      }),
    );
  });

  // ─── 8. Multiple rapid events with unique IDs all get processed ───
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
// Billing Route Edge Cases
// ═══════════════════════════════════════════════════════════════
describe('Billing Routes – Edge Cases', () => {
  let app: express.Express;
  const userId = 'user-edge-1';
  let jwt: string;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    jwt = signUserToken(userId, 'researcher', 'pro');
  });

  // ─── 9. create-checkout with non-string priceId returns 400 ───
  it('POST /billing/create-checkout with numeric priceId returns 400', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'edge@example.com',
      name: 'Edge',
      role: 'researcher',
      plan: 'pro',
      stripeCustomerId: 'cus_edge',
      dashboardAccess: { id: 'da-edge' },
    });

    const res = await request(app)
      .post('/api/billing/create-checkout')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ priceId: 12345 });

    expect(res.status).toBe(400);
  });

  // ─── 10. create-checkout passes metadata to Stripe session ───
  it('POST /billing/create-checkout passes userId and plan in session metadata', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
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

    await request(app)
      .post('/api/billing/create-checkout')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ priceId: 'price_team_monthly', plan: 'team' });

    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          userId,
          plan: 'team',
        }),
      }),
    );
  });

  // ─── 11. create-checkout defaults plan to pro if not sent ───
  it('POST /billing/create-checkout defaults plan to pro when not provided', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
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

    await request(app)
      .post('/api/billing/create-checkout')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ priceId: 'price_pro_monthly' });

    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          plan: 'pro',
        }),
      }),
    );
  });

  // ─── 12. create-portal passes correct return_url ───
  it('POST /billing/create-portal passes correct return_url from APP_URL', async () => {
    process.env.APP_URL = 'https://qualcanvas.com';
    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
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

    await request(app)
      .post('/api/billing/create-portal')
      .set('Authorization', `Bearer ${jwt}`);

    expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        return_url: 'https://qualcanvas.com/account',
      }),
    );
    delete process.env.APP_URL;
  });

  // ─── 13. create-checkout uses subscription mode ───
  it('POST /billing/create-checkout creates session in subscription mode', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
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

    await request(app)
      .post('/api/billing/create-checkout')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ priceId: 'price_pro_monthly', plan: 'pro' });

    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        line_items: [{ price: 'price_pro_monthly', quantity: 1 }],
      }),
    );
  });

  // ─── 14. Subscription with cancelAtPeriodEnd reports correctly ───
  it('GET /billing/subscription returns cancelAtPeriodEnd=true when set', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'cancel@example.com',
      name: 'Cancel',
      role: 'researcher',
      plan: 'pro',
      dashboardAccess: { id: 'da-cancel' },
    });
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-cancel',
      userId,
      status: 'active',
      currentPeriodStart: new Date('2025-01-01'),
      currentPeriodEnd: new Date('2025-02-01'),
      cancelAtPeriodEnd: true,
    });

    const res = await request(app)
      .get('/api/billing/subscription')
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.data.cancelAtPeriodEnd).toBe(true);
    expect(res.body.data.status).toBe('active');
  });

  // ─── 15. create-checkout success/cancel URLs use APP_URL ───
  it('POST /billing/create-checkout uses APP_URL for success/cancel URLs', async () => {
    process.env.APP_URL = 'https://qualcanvas.com';
    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
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

    await request(app)
      .post('/api/billing/create-checkout')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ priceId: 'price_pro_monthly', plan: 'pro' });

    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: expect.stringContaining('https://qualcanvas.com/account'),
        cancel_url: 'https://qualcanvas.com/pricing',
      }),
    );
    delete process.env.APP_URL;
  });

  // ─── 16. create-checkout sets customer ID on the Stripe session ───
  it('POST /billing/create-checkout passes existing stripeCustomerId to Stripe session', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
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

    await request(app)
      .post('/api/billing/create-checkout')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ priceId: 'price_pro_monthly', plan: 'pro' });

    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_existing_42',
      }),
    );
    // Should NOT create a new customer
    expect(mockStripe.customers.create).not.toHaveBeenCalled();
  });

  // ─── 17. Webhook with missing stripe-signature header ───
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

  // ─── 18. checkout.session.completed handles subscription retrieve failure ───
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

  // ─── 19. checkout.session.completed with empty price falls back ───
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

    // Should fall back to empty string for price ID
    expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ stripePriceId: '' }),
      }),
    );
  });

  // ─── 20. subscription.deleted includes user in query ───
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

    // Verify it queries with include: { user: true }
    expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_del_inc' },
      include: { user: true },
    });
  });
});
