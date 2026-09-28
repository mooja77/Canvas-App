import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Pro is a one-person plan (docs/qa/SEAT-BILLING.md, John 28 Sep 2026).
 * These drive utils/seats.ts against an in-memory Prisma and Stripe double:
 * the owner's plan, the coders on their canvases, and what Stripe was asked.
 */

const DAY = 24 * 60 * 60 * 1000;

interface Owner {
  plan: string;
  emailVerified: boolean;
  trialEndsAt: Date | null;
  seatGraceEndsAt: Date | null;
  subscription: {
    id: string;
    status: string;
    quantity: number;
    stripeSubscriptionId: string;
    stripePriceId: string;
  } | null;
}

const state = {
  owner: null as Owner | null,
  editors: [] as { userId: string; createdAt: Date; canvas: { id: string; name: string; deletedAt: Date | null } }[],
};

const prismaMock = {
  user: {
    findUnique: vi.fn(async (args: { select?: Record<string, unknown> }) => {
      if (!state.owner) return null;
      if (args.select && 'seatGraceEndsAt' in args.select && Object.keys(args.select).length === 1) {
        return { seatGraceEndsAt: state.owner.seatGraceEndsAt };
      }
      return state.owner;
    }),
    findMany: vi.fn(async () =>
      state.editors.map((e) => ({ id: e.userId, name: `Coder ${e.userId}`, email: `${e.userId}@example.test` })),
    ),
    updateMany: vi.fn(async (args: { data: { seatGraceEndsAt: Date } }) => {
      if (state.owner && !state.owner.seatGraceEndsAt) state.owner.seatGraceEndsAt = args.data.seatGraceEndsAt;
      return { count: 1 };
    }),
    update: vi.fn(async (args: { data: { plan?: string } }) => {
      if (state.owner && args.data.plan) state.owner.plan = args.data.plan;
      return state.owner;
    }),
  },
  canvasCollaborator: { findMany: vi.fn(async () => state.editors) },
  codingCanvas: { findUnique: vi.fn(async () => ({ userId: 'owner', dashboardAccess: null })) },
  teamMember: { findMany: vi.fn(async () => []) },
  subscription: {
    findUnique: vi.fn(async () => state.owner?.subscription ?? null),
    update: vi.fn(async (args: { data: { quantity?: number; stripePriceId?: string } }) => {
      if (state.owner?.subscription) Object.assign(state.owner.subscription, args.data);
      return state.owner?.subscription;
    }),
  },
  $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
};

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const PRICES: Record<string, { unit_amount: number; interval: string; plan: string }> = {
  price_pro_m: { unit_amount: 1500, interval: 'month', plan: 'pro' },
  price_pro_y: { unit_amount: 14400, interval: 'year', plan: 'pro' },
  price_team_old_m: { unit_amount: 2900, interval: 'month', plan: 'team' },
  price_team_m: { unit_amount: 3900, interval: 'month', plan: 'team' },
  price_team_y: { unit_amount: 38400, interval: 'year', plan: 'team' },
};
const price = (id: string) => ({
  id,
  unit_amount: PRICES[id].unit_amount,
  currency: 'usd',
  recurring: { interval: PRICES[id].interval, usage_type: 'licensed' },
  metadata: { app: 'qualcanvas', plan: PRICES[id].plan },
});

const stripeState = { priceId: 'price_pro_m', quantity: 1, decline: false };
const liveSub = () => ({
  id: 'sub_pro',
  customer: 'cus_1',
  status: 'active',
  discounts: [],
  pending_update: null as unknown,
  latest_invoice: null as unknown,
  items: {
    data: [
      {
        id: 'si_1',
        quantity: stripeState.quantity,
        price: price(stripeState.priceId),
        current_period_end: Math.floor((Date.now() + 20 * DAY) / 1000),
      },
    ],
  },
});
const stripeMock = {
  subscriptions: {
    retrieve: vi.fn(async () => liveSub()),
    update: vi.fn(async (_id: string, params: { items: { price?: string; quantity: number }[] }) => {
      if (stripeState.decline) {
        return {
          ...liveSub(),
          pending_update: { expires_at: 1 },
          latest_invoice: { id: 'in_declined', hosted_invoice_url: 'https://pay.example/in' },
        };
      }
      if (params.items[0].price) stripeState.priceId = params.items[0].price;
      stripeState.quantity = params.items[0].quantity;
      return liveSub();
    }),
  },
  invoices: {
    createPreview: vi.fn(async (_args: unknown) => ({ amount_due: 2345, currency: 'usd' })),
    voidInvoice: vi.fn(async () => ({})),
  },
  prices: {
    // Tagged team prices, including an older one at a non-published amount.
    search: vi.fn(async () => ({ data: ['price_team_old_m', 'price_team_m', 'price_team_y'].map(price) })),
  },
};
vi.mock('../lib/stripe.js', () => ({ getStripe: () => stripeMock }));

const seats = await import('./seats.js');
type SeatPreview = import('./seats.js').SeatPreview;

function proOwner(overrides: Partial<Owner> = {}): Owner {
  return {
    plan: 'pro',
    emailVerified: true,
    trialEndsAt: null,
    seatGraceEndsAt: null,
    subscription: {
      id: 'row1',
      status: 'active',
      quantity: 1,
      stripeSubscriptionId: 'sub_pro',
      stripePriceId: 'price_pro_m',
    },
    ...overrides,
  };
}
const editor = (userId: string, daysAgo: number) => ({
  userId,
  createdAt: new Date(Date.now() - daysAgo * DAY),
  canvas: { id: `canvas-${userId}`, name: 'Study', deletedAt: null },
});

beforeEach(() => {
  vi.clearAllMocks();
  state.owner = proOwner();
  state.editors = [];
  Object.assign(stripeState, { priceId: 'price_pro_m', quantity: 1, decline: false });
});

describe('Pro solo: adding a coder', () => {
  it('asks for Team with Stripe’s quote, and changes nothing until confirmed', async () => {
    const err = await seats.ensureSeatFor('owner', 'coder-1').catch((e) => e);
    expect(err).toBeInstanceOf(seats.TeamRequiredError);
    expect(err.statusCode).toBe(402);
    const details = err.extra as { code: string; upgrade: string; seatsNeeded: number; preview: SeatPreview };
    expect(details.code).toBe('TEAM_REQUIRED');
    expect(details.upgrade).toBe('in_place');
    expect(details.seatsNeeded).toBe(2);
    expect(details.preview).toMatchObject({
      fromPlan: 'pro',
      toPlan: 'team',
      currentQuantity: 1,
      newQuantity: 2,
      unitAmount: 3900, // the published Team price, not the older tagged one
      currentUnitAmount: 1500,
      dueNow: 2345, // Stripe's own preview
      nextRenewal: 7800,
      interval: 'month',
    });
    const previewArgs = stripeMock.invoices.createPreview.mock.calls[0][0] as unknown as {
      subscription_details: { items: unknown[]; proration_behavior: string };
    };
    expect(previewArgs.subscription_details.items).toEqual([{ id: 'si_1', price: 'price_team_m', quantity: 2 }]);
    expect(previewArgs.subscription_details.proration_behavior).toBe('always_invoice');
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
    expect(state.owner?.plan).toBe('pro');
  });

  it('a seat confirmation alone does not upgrade the plan', async () => {
    const err = await seats.ensureSeatFor('owner', 'coder-1', { confirm: true }).catch((e) => e);
    expect(err).toBeInstanceOf(seats.TeamRequiredError);
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
  });

  it('on confirmation switches the subscription to Team with a seat for the owner and each coder', async () => {
    state.editors = [editor('coder-0', 40)];
    const r = await seats.ensureSeatFor('owner', 'coder-1', { confirmTeamUpgrade: true, prorationDate: 1234 });
    expect(r).toEqual({ charged: true, quantity: 3 });
    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(
      'sub_pro',
      expect.objectContaining({
        items: [{ id: 'si_1', price: 'price_team_m', quantity: 3 }],
        proration_behavior: 'always_invoice',
        payment_behavior: 'pending_if_incomplete',
        proration_date: 1234,
      }),
    );
    expect(state.owner?.plan).toBe('team');
    expect(state.owner?.subscription).toMatchObject({ quantity: 3, stripePriceId: 'price_team_m' });
  });

  it('annual Pro upgrades to annual Team', async () => {
    stripeState.priceId = 'price_pro_y';
    const err = await seats.ensureSeatFor('owner', 'coder-1').catch((e) => e);
    expect(err.extra.preview).toMatchObject({ unitAmount: 38400, interval: 'year', nextRenewal: 76800 });
  });

  it('a declined card leaves the owner on Pro, voids the invoice and adds nobody', async () => {
    stripeState.decline = true;
    const err = await seats.ensureSeatFor('owner', 'coder-1', { confirmTeamUpgrade: true }).catch((e) => e);
    expect(err).toBeInstanceOf(seats.SeatPaymentError);
    expect(stripeMock.invoices.voidInvoice).toHaveBeenCalledWith('in_declined');
    expect(state.owner?.plan).toBe('pro');
    expect(state.owner?.subscription?.quantity).toBe(1);
  });

  it('past due: no quote, no charge', async () => {
    state.owner = proOwner();
    state.owner.subscription!.status = 'past_due';
    const err = await seats.ensureSeatFor('owner', 'coder-1').catch((e) => e);
    expect(err.extra.code).toBe('PAYMENT_PAST_DUE');
    expect(stripeMock.invoices.createPreview).not.toHaveBeenCalled();
  });

  it('a Pro owner with no Stripe subscription (legacy) is sent to Team checkout', async () => {
    state.owner = proOwner({ subscription: null });
    const err = await seats.ensureSeatFor('owner', 'coder-1').catch((e) => e);
    expect(err.extra).toMatchObject({ code: 'TEAM_REQUIRED', upgrade: 'checkout', preview: null, seatsNeeded: 2 });
    expect(stripeMock.invoices.createPreview).not.toHaveBeenCalled();
  });

  it('a Free user in their Pro trial is sent to Team checkout', async () => {
    state.owner = proOwner({ plan: 'free', trialEndsAt: new Date(Date.now() + 5 * DAY), subscription: null });
    const err = await seats.ensureSeatFor('owner', 'coder-1').catch((e) => e);
    expect(err.extra).toMatchObject({ code: 'TEAM_REQUIRED', upgrade: 'checkout' });
  });

  it('adding someone who already codes with the owner needs nothing new', async () => {
    state.editors = [editor('coder-1', 3)];
    await expect(seats.ensureSeatFor('owner', 'coder-1')).resolves.toEqual({ charged: false, quantity: 1 });
  });

  it('Team owners are billed per seat as before, never offered a plan change', async () => {
    state.owner = proOwner({ plan: 'team' });
    stripeState.priceId = 'price_team_m';
    state.owner.subscription!.stripePriceId = 'price_team_m';
    const err = await seats.ensureSeatFor('owner', 'coder-1').catch((e) => e);
    expect(err).toBeInstanceOf(seats.SeatRequiredError);
    expect(err.extra.preview.fromPlan).toBeUndefined();
  });

  it('a complimentary Team (no Stripe subscription) adds coders without any billing', async () => {
    state.owner = proOwner({ plan: 'team' });
    state.owner.subscription!.stripeSubscriptionId = 'comp_team_permanent';
    state.editors = [editor('coder-0', 10)];
    await expect(seats.ensureSeatFor('owner', 'coder-1')).resolves.toEqual({ charged: false, quantity: null });
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled();
  });
});

describe('Pro solo: existing coders (grace)', () => {
  it('coders already on a Pro owner’s canvases get the one-off 30-day grace, then become read-only', async () => {
    state.editors = [editor('coder-a', 90), editor('coder-b', 60)];
    const first = await seats.getSeatStatus('owner');
    expect(first).toMatchObject({ mode: 'solo', seatsPurchased: 1, seatsUsed: 3, unseatedCount: 2, enforcing: false });
    expect(first.teamUpgrade).toBe('in_place');
    const days = (first.graceEndsAt!.getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
    await expect(seats.editorHasSeat('canvas-coder-a', 'coder-a')).resolves.toBe(true);

    // Grace over: read-only, but nothing is removed.
    state.owner!.seatGraceEndsAt = new Date(Date.now() - 1000);
    const after = await seats.getSeatStatus('owner');
    expect(after.enforcing).toBe(true);
    expect(after.holders.map((h) => h.seated)).toEqual([false, false]);
    await expect(seats.editorHasSeat('canvas-coder-a', 'coder-a')).resolves.toBe(false);
    // The owner always edits.
    await expect(seats.editorHasSeat('canvas-coder-a', 'owner')).resolves.toBe(true);
  });

  it('the grace period is granted once: a later look does not move it', async () => {
    state.editors = [editor('coder-a', 90)];
    const earlier = new Date(Date.now() + 3 * DAY);
    state.owner!.seatGraceEndsAt = earlier;
    const s = await seats.getSeatStatus('owner');
    expect(s.graceEndsAt).toEqual(earlier);
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
  });

  it('a comped Team owner is never put into grace', async () => {
    state.owner = proOwner({ plan: 'team' });
    state.owner.subscription!.stripeSubscriptionId = 'comp_x';
    state.editors = [editor('coder-a', 90)];
    const s = await seats.getSeatStatus('owner');
    expect(s).toMatchObject({ mode: 'comp', unseatedCount: 0, enforcing: false, graceEndsAt: null });
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
  });

  it('the upgrade from grace seats everyone: Team with owner + every coder', async () => {
    state.editors = [editor('coder-a', 90), editor('coder-b', 60)];
    await seats.upgradeToTeam('owner', 3, { prorationDate: 99 });
    expect(stripeState).toMatchObject({ priceId: 'price_team_m', quantity: 3 });
    state.owner!.seatGraceEndsAt = new Date(Date.now() - 1000);
    const s = await seats.getSeatStatus('owner');
    expect(s).toMatchObject({ mode: 'billed', seatsPurchased: 3, unseatedCount: 0, enforcing: false });
  });
});

describe('Pro solo: a Pro subscription with quantity > 1', () => {
  it('is lowered to one seat, with the unused time credited (never charged)', async () => {
    state.owner!.subscription!.quantity = 3;
    stripeState.quantity = 3;
    state.editors = [editor('coder-a', 90)];
    await expect(seats.releaseUnusedSeats('owner')).resolves.toBe(1);
    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(
      'sub_pro',
      expect.objectContaining({ items: [{ id: 'si_1', quantity: 1 }], proration_behavior: 'create_prorations' }),
    );
    // The coder is still in grace, and still unseated: Pro seats never let a second person edit.
    const s = await seats.getSeatStatus('owner');
    expect(s).toMatchObject({ seatsPurchased: 1, subscriptionQuantity: 1, unseatedCount: 1, enforcing: false });
  });

  it('a Pro subscription at quantity 1 is left alone', async () => {
    await seats.releaseUnusedSeats('owner');
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
  });
});
