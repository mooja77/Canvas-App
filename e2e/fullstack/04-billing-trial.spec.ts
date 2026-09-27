import { test, expect } from '@playwright/test';
import {
  signup,
  ok,
  me,
  subscribe,
  sendWebhook,
  stripeEvent,
  stripeControl,
  createCanvas,
  setClock,
  getCanvas,
  type Session,
} from './support/api';

async function plan(s: Session): Promise<{ plan: string; effectivePlan: string; status?: string }> {
  const data = await me(s);
  return { plan: data.user.plan, effectivePlan: data.user.effectivePlan, status: data.subscription?.status };
}

function subUpdated(sub: any, patch: Record<string, unknown> = {}) {
  return stripeEvent('customer.subscription.updated', { ...sub, ...patch });
}

test.describe('Billing: checkout, webhooks, plan changes', () => {
  test('buying Pro through Checkout + webhook upgrades the account', async () => {
    const s = await signup('buypro');
    expect((await plan(s)).plan).toBe('free');
    await subscribe(s, 'price_qc_pro_m');
    const p = await plan(s);
    expect(p.plan).toBe('pro');
    expect(p.status).toBe('active');
    // Pro now allows more than 2 canvases.
    for (let i = 0; i < 3; i++) await createCanvas(s, `pro ${i}`);
  });

  test('error: unknown, foreign and missing price ids are rejected', async () => {
    const s = await signup('badprice');
    expect((await s.ctx.post('billing/create-checkout', { data: { priceId: 'price_nope' } })).status()).toBe(400);
    expect((await s.ctx.post('billing/create-checkout', { data: { priceId: 'price_other_app' } })).status()).toBe(400);
    expect((await s.ctx.post('billing/create-checkout', { data: {} })).status()).toBe(400);
  });

  test('Student plan needs a verified academic email; academic Pro gets the coupon, Student does not stack it', async () => {
    const nonAcademic = await signup('student-nonacad', { verify: true });
    expect(
      (await nonAcademic.ctx.post('billing/create-checkout', { data: { priceId: 'price_qc_student_m' } })).status(),
    ).toBe(403);

    const academic = await signup('student-acad', { verify: true, domain: 'example.edu' });
    const student = await ok(
      await academic.ctx.post('billing/create-checkout', { data: { priceId: 'price_qc_student_m' } }),
    );
    const sSession = await stripeControl(`sessions/${String(student.data.url).split('/').pop()}`);
    expect(sSession.discount).toBeNull();

    const academic2 = await signup('pro-acad', { verify: true, domain: 'example.edu' });
    const pro = await ok(await academic2.ctx.post('billing/create-checkout', { data: { priceId: 'price_qc_pro_m' } }));
    const pSession = await stripeControl(`sessions/${String(pro.data.url).split('/').pop()}`);
    expect(pSession.discount).toBe('coupon_estate_academic');
  });

  test('error: a second checkout while subscribed is refused (no double billing)', async () => {
    const s = await signup('double');
    await subscribe(s, 'price_qc_pro_m');
    expect((await s.ctx.post('billing/create-checkout', { data: { priceId: 'price_qc_team_m' } })).status()).toBe(409);
  });

  test('error: webhook with a bad signature is 400 and changes nothing', async () => {
    const s = await signup('badsig');
    const res = await sendWebhook(stripeEvent('customer.subscription.deleted', { id: 'sub_x' }), {
      secret: `whsec_${Date.now().toString(36)}`,
    });
    expect(res.status()).toBe(400);
    expect((await plan(s)).plan).toBe('free');
  });

  test("edge: another product's checkout on the shared Stripe account is acknowledged and ignored", async () => {
    const res = await sendWebhook(
      stripeEvent('checkout.session.completed', {
        id: 'cs_other',
        customer: 'cus_other_product',
        subscription: 'sub_other_product',
        metadata: { userId: 'not-a-qualcanvas-user' },
      }),
    );
    expect(res.status()).toBe(200);
  });

  test('edge: replaying the same webhook event is idempotent', async () => {
    const s = await signup('replay');
    const { subscriptionId } = await subscribe(s, 'price_qc_pro_m');
    const sub = await stripeControl(`subscriptions/${subscriptionId}`, { price: 'price_qc_team_m' });
    const evt = subUpdated(sub);
    expect((await sendWebhook(evt)).status()).toBe(200);
    expect((await plan(s)).plan).toBe('team');
    // Replay the same event after a newer change: must not re-apply it.
    const back = await stripeControl(`subscriptions/${subscriptionId}`, { price: 'price_qc_pro_m' });
    expect((await sendWebhook(subUpdated(back))).status()).toBe(200);
    expect((await plan(s)).plan).toBe('pro');
    expect((await sendWebhook(evt)).status()).toBe(200);
    expect((await plan(s)).plan).toBe('pro');
  });

  test('failed renewal marks past_due; recovery restores active', async () => {
    const s = await signup('dunning');
    const { subscriptionId } = await subscribe(s, 'price_qc_pro_m');
    const invoice = (status: string) => ({
      id: `in_${status}_${Date.now()}`,
      object: 'invoice',
      parent: { subscription_details: { subscription: subscriptionId } },
    });
    await stripeControl(`subscriptions/${subscriptionId}`, { status: 'past_due' });
    expect((await sendWebhook(stripeEvent('invoice.payment_failed', invoice('failed')))).status()).toBe(200);
    expect((await plan(s)).status).toBe('past_due');

    await stripeControl(`subscriptions/${subscriptionId}`, { status: 'active' });
    expect((await sendWebhook(stripeEvent('invoice.payment_succeeded', invoice('paid')))).status()).toBe(200);
    const p = await plan(s);
    expect(p.status).toBe('active');
    expect(p.plan).toBe('pro');
  });

  test('cancellation drops to Free and keeps the data readable', async () => {
    const s = await signup('cancel');
    const { subscriptionId } = await subscribe(s, 'price_qc_pro_m');
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push(await createCanvas(s, `c${i}`));
    const sub = await stripeControl(`subscriptions/${subscriptionId}`, { status: 'canceled' });
    expect((await sendWebhook(stripeEvent('customer.subscription.deleted', sub))).status()).toBe(200);
    const p = await plan(s);
    expect(p.plan).toBe('free');
    expect(p.status).toBe('canceled');
    // Over the Free cap: existing canvases stay readable, new ones are blocked.
    for (const id of ids) expect((await getCanvas(s, id)).id).toBe(id);
    expect((await s.ctx.post('canvas', { data: { name: 'fourth' } })).status()).toBe(403);
  });

  test('regression: a stale "active" update delivered after cancellation does not re-grant Pro', async () => {
    const s = await signup('stale');
    const { subscriptionId } = await subscribe(s, 'price_qc_pro_m');
    const activeSnapshot = await stripeControl(`subscriptions/${subscriptionId}`, {});
    const canceled = await stripeControl(`subscriptions/${subscriptionId}`, { status: 'canceled' });
    expect((await sendWebhook(stripeEvent('customer.subscription.deleted', canceled))).status()).toBe(200);
    // Out-of-order delivery of an older event.
    expect((await sendWebhook(subUpdated(activeSnapshot))).status()).toBe(200);
    const p = await plan(s);
    expect(p.plan).toBe('free');
    expect(p.status).toBe('canceled');
    // And the user can buy again.
    await ok(await s.ctx.post('billing/create-checkout', { data: { priceId: 'price_qc_pro_m' } }));
  });

  test('regression: a retried checkout.session.completed after cancellation records the real status', async () => {
    const s = await signup('retrycheckout');
    const checkout = await ok(await s.ctx.post('billing/create-checkout', { data: { priceId: 'price_qc_pro_m' } }));
    const session = await stripeControl(`sessions/${String(checkout.data.url).split('/').pop()}`);
    const sub = await stripeControl('subscriptions', { customer: session.customer, price: 'price_qc_pro_m' });
    const completed = stripeEvent('checkout.session.completed', {
      id: session.id,
      customer: session.customer,
      subscription: sub.id,
      metadata: session.metadata,
    });
    // First delivery failed on our side (never recorded); Stripe retries it
    // after the customer already cancelled.
    const canceled = await stripeControl(`subscriptions/${sub.id}`, { status: 'canceled' });
    expect((await sendWebhook(completed)).status()).toBe(200);
    const p = await plan(s);
    expect(p.status).toBe('canceled');
    expect(p.plan).toBe('free');
    expect(canceled.status).toBe('canceled');
  });

  test('billing portal: needs a Stripe customer; returns the portal URL', async () => {
    const fresh = await signup('portal0');
    expect((await fresh.ctx.post('billing/create-portal')).status()).toBe(404);
    const s = await signup('portal1');
    await subscribe(s, 'price_qc_team_m');
    const res = await ok(await s.ctx.post('billing/create-portal'));
    expect(res.data.url).toMatch(/\/portal\/cus_/);
  });
});

test.describe('Trial expiry (clock moved forward)', () => {
  test.afterEach(async () => setClock(null));

  test('verified users are Pro for 14 days, then Free with data intact', async () => {
    const s = await signup('trial', { verify: true });
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push(await createCanvas(s, `trial ${i}`));
    expect((await plan(s)).effectivePlan).toBe('pro');

    await setClock(new Date(Date.now() + 15 * 86_400_000).toISOString());
    // The 24h session has expired by then; sign in again.
    expect((await s.ctx.get('auth/me')).status()).toBe(401);
    await ok(await s.ctx.post('auth/email-login', { data: { email: s.email, password: s.password } }));
    expect((await plan(s)).effectivePlan).toBe('free');
    expect((await s.ctx.post('canvas', { data: { name: 'after trial' } })).status()).toBe(403);
    for (const id of ids) expect((await getCanvas(s, id)).id).toBe(id);
  });
});
