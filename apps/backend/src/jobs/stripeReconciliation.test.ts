import { describe, it, expect, vi, beforeEach } from 'vitest';

// The Stripe account is shared across multiple products (Staff Hub, TaxMatch,
// QualCanvas, …). The reconcile job lists ALL subscriptions in the account, so
// it must only treat a sub as QualCanvas drift when one of OUR Users owns that
// Stripe customer — otherwise it false-flags other products' subs.
const { listMock, subFindUnique, subUpdate, userFindUnique, userUpdate, logErrorMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  subFindUnique: vi.fn(),
  subUpdate: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  logErrorMock: vi.fn(),
}));

vi.mock('../lib/stripe.js', () => ({ stripe: { subscriptions: { list: listMock } } }));
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    subscription: { findUnique: subFindUnique, update: subUpdate },
    user: { findUnique: userFindUnique, update: userUpdate },
  },
}));
vi.mock('../lib/logger.js', () => ({ logError: logErrorMock }));

import { reconcileStripeSubscriptions } from './stripeReconciliation.js';

function sub(id: string, customer: string, status = 'active') {
  return { id, customer, status, items: { data: [] } };
}

describe('reconcileStripeSubscriptions — shared-account scoping', () => {
  beforeEach(() => {
    listMock.mockReset();
    subFindUnique.mockReset().mockResolvedValue(null); // not in DB → orphan candidate
    userFindUnique.mockReset();
    logErrorMock.mockReset();
  });

  it('does NOT flag an orphaned sub whose customer is not a QualCanvas user (another product)', async () => {
    listMock.mockResolvedValue({ data: [sub('sub_staffhub', 'cus_other')], has_more: false });
    userFindUnique.mockResolvedValue(null); // no QualCanvas User owns this Stripe customer

    const result = await reconcileStripeSubscriptions();

    expect(result.orphanedInStripe).toBe(0);
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it('flags an orphaned sub when a QualCanvas user owns the Stripe customer', async () => {
    listMock.mockResolvedValue({ data: [sub('sub_qc', 'cus_qc')], has_more: false });
    userFindUnique.mockResolvedValue({ id: 'user_1' }); // a QualCanvas User owns it → real drift

    const result = await reconcileStripeSubscriptions();

    expect(result.orphanedInStripe).toBe(1);
    expect(logErrorMock).toHaveBeenCalledTimes(1);
    expect(logErrorMock.mock.calls[0][1]).toMatchObject({ stripeSubId: 'sub_qc', customer: 'cus_qc' });
  });
});

describe('reconcileStripeSubscriptions — entitlement matches the webhook', () => {
  const proItem = {
    price: { id: 'price_pro', metadata: { app: 'qualcanvas', plan: 'pro' }, product: 'prod_pro' },
    current_period_start: 1_700_000_000,
    current_period_end: 1_702_592_000,
  };
  function dbSub(status: string) {
    return {
      id: 'row-1',
      userId: 'user-1',
      stripeSubscriptionId: 'sub_1',
      status,
      currentPeriodEnd: new Date(1_702_592_000 * 1000),
    };
  }

  beforeEach(() => {
    listMock.mockReset();
    subFindUnique.mockReset();
    subUpdate.mockReset().mockResolvedValue({});
    userFindUnique.mockReset();
    userUpdate.mockReset().mockResolvedValue({});
    logErrorMock.mockReset();
  });

  it('returns a grandfathered legacy user to Pro, not Free, when their subscription ended', async () => {
    listMock.mockResolvedValue({
      data: [{ id: 'sub_1', customer: 'cus_1', status: 'canceled', items: { data: [proItem] } }],
      has_more: false,
    });
    subFindUnique.mockResolvedValue(dbSub('canceled'));
    userFindUnique.mockResolvedValue({ legacyPricing: true });

    await reconcileStripeSubscriptions();

    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { plan: 'pro' } });
  });

  it('drops an ordinary user to Free when their subscription ended', async () => {
    listMock.mockResolvedValue({
      data: [{ id: 'sub_1', customer: 'cus_1', status: 'canceled', items: { data: [proItem] } }],
      has_more: false,
    });
    subFindUnique.mockResolvedValue(dbSub('canceled'));
    userFindUnique.mockResolvedValue({ legacyPricing: false });

    await reconcileStripeSubscriptions();

    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { plan: 'free' } });
  });
});
