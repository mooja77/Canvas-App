import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  signup,
  ok,
  json,
  me,
  subscribe,
  sendWebhook,
  stripeEvent,
  stripeControl,
  createCanvas,
  addTranscript,
  addCode,
  setClock,
  emailsTo,
  type Session,
} from './support/api';

// Per-seat billing (docs/qa/SEAT-BILLING.md) against the real backend, a real
// Postgres and the local Stripe double. Prices mirror the live ones:
// Team $39/seat/month, Pro $15/seat/month.

const TEXT =
  'The rota changed twice in one month. Staffing was the main problem on nights, and the handover notes were often missing.';

async function stripeSub(id: string) {
  return stripeControl(`subscriptions/${id}`);
}
async function invoicesFor(subId: string): Promise<any[]> {
  return stripeControl(`invoices?subscription=${subId}`);
}
async function seats(s: Session) {
  return (await ok(await s.ctx.get('billing/seats'))).data;
}
async function invite(owner: Session, canvasId: string, email: string, role: 'editor' | 'viewer', extra = {}) {
  return owner.ctx.post(`canvas/${canvasId}/collaborators`, { data: { email, role, ...extra } });
}
/** Invite a coder the way the UI does: ask, read the quote, confirm it. */
async function inviteCoderConfirmed(owner: Session, canvasId: string, email: string) {
  const first = await invite(owner, canvasId, email, 'editor');
  if (first.status() === 201) return null;
  const body = await json(first);
  expect(first.status(), JSON.stringify(body)).toBe(402);
  expect(body.code).toBe('SEAT_REQUIRED');
  await ok(
    await invite(owner, canvasId, email, 'editor', {
      confirmSeatCharge: true,
      prorationDate: body.preview.prorationDate,
    }),
    201,
  );
  return body.preview;
}
const PHRASES = ['The rota changed', 'Staffing was the main problem', 'on nights', 'handover notes', 'often missing'];
let phraseN = 0;
/** Code a (different each time) phrase, so no two codings are identical. */
async function codeOnce(s: Session, canvasId: string, transcriptId: string, questionId: string) {
  const phrase = PHRASES[phraseN++ % PHRASES.length];
  const start = TEXT.indexOf(phrase);
  return s.ctx.post(`canvas/${canvasId}/codings`, {
    data: { transcriptId, questionId, startOffset: start, endOffset: start + phrase.length, codedText: phrase },
  });
}

test.describe('Seats: a coder needs a paid seat, a viewer does not', () => {
  test('Team: inviting a coder quotes the prorated charge, charges only after confirmation, and seats them', async () => {
    const owner = await signup('seat-owner');
    const { subscriptionId } = await subscribe(owner, 'price_qc_team_m');
    const coder = await signup('seat-coder', { verify: true });
    const viewer = await signup('seat-viewer', { verify: true });
    const canvasId = await createCanvas(owner, 'Seats study');
    const t = await addTranscript(owner, canvasId, 'Nights', TEXT);
    const q = await addCode(owner, canvasId, 'Staffing');

    // 1. Without confirmation: 402 with a quote, and nothing changes anywhere.
    const refused = await invite(owner, canvasId, coder.email, 'editor');
    expect(refused.status()).toBe(402);
    const quote = (await json(refused)).preview;
    expect(quote).toMatchObject({ currentQuantity: 1, newQuantity: 2, unitAmount: 3900, interval: 'month' });
    expect(quote.dueNow).toBeGreaterThan(0);
    expect(quote.dueNow).toBeLessThanOrEqual(3900);
    expect(quote.nextRenewal).toBe(7800);
    expect((await ok(await owner.ctx.get(`canvas/${canvasId}/collaborators`))).data).toHaveLength(0);
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(1);
    expect(await invoicesFor(subscriptionId)).toHaveLength(0);

    // 2. Confirmed with the quoted instant: Stripe charges exactly the quote.
    await ok(
      await invite(owner, canvasId, coder.email, 'editor', {
        confirmSeatCharge: true,
        prorationDate: quote.prorationDate,
      }),
      201,
    );
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(2);
    const inv = await invoicesFor(subscriptionId);
    expect(inv).toHaveLength(1);
    expect(inv[0].status).toBe('paid');
    expect(inv[0].amount_due).toBe(quote.dueNow);
    // The update asked Stripe to invoice now and to apply only if paid.
    const calls = (await stripeControl('calls')).filter(
      (c: any) => c.method === 'POST' && c.path === `/v1/subscriptions/${subscriptionId}`,
    );
    expect(calls.at(-1).form).toMatchObject({
      proration_behavior: 'always_invoice',
      payment_behavior: 'pending_if_incomplete',
      proration_date: String(quote.prorationDate),
    });

    let st = await seats(owner);
    expect(st).toMatchObject({ mode: 'billed', seatsPurchased: 2, seatsUsed: 2, unseatedCount: 0 });
    expect(st.holders.map((h: any) => [h.email, h.seated])).toEqual([[coder.email, true]]);
    expect(st.price).toEqual({ unitAmount: 3900, currency: 'usd', interval: 'month' });

    // 3. A viewer is free: no quote, no invoice, no seat.
    await ok(await invite(owner, canvasId, viewer.email, 'viewer'), 201);
    expect(await invoicesFor(subscriptionId)).toHaveLength(1);
    st = await seats(owner);
    expect(st.seatsUsed).toBe(2);

    // 4. The coder codes; the viewer can read but not write.
    expect((await codeOnce(coder, canvasId, t, q)).status()).toBe(201);
    expect((await codeOnce(viewer, canvasId, t, q)).status()).toBe(403);
    expect((await viewer.ctx.get(`canvas/${canvasId}`)).status()).toBe(200);

    // 5. The same coder on another of the owner's canvases uses the same seat.
    const second = await createCanvas(owner, 'Seats study 2');
    await ok(await invite(owner, second, coder.email, 'editor'), 201);
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(2);
  });

  test('error: a declined card adds no seat and no coder, and leaves nothing to pay', async () => {
    const owner = await signup('seat-decline');
    const { subscriptionId, customer } = await subscribe(owner, 'price_qc_team_m');
    const coder = await signup('seat-decline-coder', { verify: true });
    const canvasId = await createCanvas(owner, 'Decline study');
    await stripeControl(`customers/${customer}`, { card: 'declined' });

    const res = await invite(owner, canvasId, coder.email, 'editor', { confirmSeatCharge: true });
    const body = await json(res);
    expect(res.status()).toBe(402);
    expect(body.code).toBe('SEAT_PAYMENT_FAILED');
    expect(body.error).toMatch(/declined/i);
    expect((await ok(await owner.ctx.get(`canvas/${canvasId}/collaborators`))).data).toHaveLength(0);
    expect((await coder.ctx.get(`canvas/${canvasId}`)).status()).toBe(403);
    const sub = await stripeSub(subscriptionId);
    expect(sub.items.data[0].quantity).toBe(1);
    expect(sub.pending_update).toBeNull();
    expect((await invoicesFor(subscriptionId)).map((i) => i.status)).toEqual(['void']);
    expect((await me(owner)).subscription.status).toBe('active');

    // Card fixed → the same confirmation now succeeds.
    await stripeControl(`customers/${customer}`, { card: 'ok' });
    await ok(await invite(owner, canvasId, coder.email, 'editor', { confirmSeatCharge: true }), 201);
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(2);
  });

  test('error: while the last payment is failing, no seat is quoted or added', async () => {
    const owner = await signup('seat-pastdue');
    const { subscriptionId } = await subscribe(owner, 'price_qc_team_m');
    const coder = await signup('seat-pastdue-coder', { verify: true });
    const canvasId = await createCanvas(owner, 'Past due');
    await stripeControl(`subscriptions/${subscriptionId}`, { status: 'past_due' });
    await sendWebhook(stripeEvent('customer.subscription.updated', await stripeSub(subscriptionId)));
    expect((await me(owner)).user.plan).toBe('team'); // dunning keeps the plan (D1)
    const res = await invite(owner, canvasId, coder.email, 'editor', { confirmSeatCharge: true });
    expect(res.status()).toBe(402);
    expect((await json(res)).code).toBe('PAYMENT_PAST_DUE');
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(1);
    expect(await invoicesFor(subscriptionId)).toHaveLength(0);
    // A viewer is still free.
    await ok(await invite(owner, canvasId, coder.email, 'viewer'), 201);
  });

  test('removing a coder, or making them a viewer, credits the seat back at once', async () => {
    const owner = await signup('seat-release');
    const { subscriptionId } = await subscribe(owner, 'price_qc_team_m');
    const [c1, c2] = [await signup('seat-rel-1', { verify: true }), await signup('seat-rel-2', { verify: true })];
    const canvasId = await createCanvas(owner, 'Release study');
    await inviteCoderConfirmed(owner, canvasId, c1.email);
    await inviteCoderConfirmed(owner, canvasId, c2.email);
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(3);

    await ok(await owner.ctx.delete(`canvas/${canvasId}/collaborators/${c2.userId}`));
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(2);
    const pending = await stripeControl(`pending/${subscriptionId}`);
    const credit = pending.reduce((t: number, l: any) => t + l.amount, 0);
    expect(credit).toBeLessThan(0); // unused time is credited to the next invoice
    // Decreases never create a card charge.
    expect((await invoicesFor(subscriptionId)).every((i) => i.amount_due > 0)).toBe(true);
    expect(await invoicesFor(subscriptionId)).toHaveLength(2);

    await ok(await invite(owner, canvasId, c1.email, 'viewer'), 201);
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(1);
    expect((await seats(owner)).seatsUsed).toBe(1);
    // c1 keeps read access as a viewer.
    expect((await c1.ctx.get(`canvas/${canvasId}`)).status()).toBe(200);
  });

  test('Team members take a seat too; a person holds at most one seat', async () => {
    const owner = await signup('seat-team');
    const { subscriptionId } = await subscribe(owner, 'price_qc_team_m');
    const member = await signup('seat-team-member', { verify: true });
    const team = (await ok(await owner.ctx.post('teams', { data: { name: 'Lab' } }), 201)).data;

    const refused = await owner.ctx.post(`teams/${team.id}/members`, { data: { email: member.email } });
    expect(refused.status()).toBe(402);
    expect((await json(refused)).code).toBe('SEAT_REQUIRED');
    await ok(
      await owner.ctx.post(`teams/${team.id}/members`, { data: { email: member.email, confirmSeatCharge: true } }),
      201,
    );
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(2);

    // Also a coder on a canvas: same person, same seat, no second charge.
    const canvasId = await createCanvas(owner, 'Team canvas');
    await ok(await invite(owner, canvasId, member.email, 'editor'), 201);
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(2);

    // Releasing the seat from the Seats panel: viewer everywhere, out of the team.
    const released = (await ok(await owner.ctx.post(`billing/seats/holders/${member.userId}/release`))).data;
    expect(released.seatsUsed).toBe(1);
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(1);
    const collabs = (await ok(await owner.ctx.get(`canvas/${canvasId}/collaborators`))).data;
    expect(collabs.map((c: any) => c.role)).toEqual(['viewer']);
  });
});

test.describe('Seats: webhooks keep the quantity true to Stripe', () => {
  test('quantity mirrors Stripe; stale, duplicate and foreign events do not regress it', async () => {
    const owner = await signup('seat-hooks');
    const { subscriptionId, customer } = await subscribe(owner, 'price_qc_team_m');
    const coder = await signup('seat-hooks-coder', { verify: true });
    const canvasId = await createCanvas(owner, 'Hooks');
    await inviteCoderConfirmed(owner, canvasId, coder.email);
    const live = await stripeSub(subscriptionId);
    expect(live.items.data[0].quantity).toBe(2);

    // A stale snapshot (an older quantity) arriving late must not win.
    const stale = structuredClone(live);
    stale.items.data[0].quantity = 1;
    expect((await sendWebhook(stripeEvent('customer.subscription.updated', stale))).status()).toBe(200);
    expect((await seats(owner)).seatsPurchased).toBe(2);

    // A real change made in the Stripe portal is picked up, even delivered twice.
    await stripeControl(`subscriptions/${subscriptionId}`, { quantity: 4 });
    const ev = stripeEvent('customer.subscription.updated', await stripeSub(subscriptionId));
    expect((await sendWebhook(ev)).status()).toBe(200);
    expect((await sendWebhook(ev)).status()).toBe(200);
    // Two seats nobody holds are credited back when the owner next looks.
    const st = await seats(owner);
    expect(st.seatsPurchased).toBe(2);
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(2);

    // pending_update_applied is handled like an update.
    expect(
      (
        await sendWebhook(stripeEvent('customer.subscription.pending_update_applied', await stripeSub(subscriptionId)))
      ).status(),
    ).toBe(200);

    // Another product's subscription event on the shared account: 200, no change.
    const foreign = await stripeControl('subscriptions', { customer: 'cus_other_product', price: 'price_other_app' });
    expect(
      (await sendWebhook(stripeEvent('customer.subscription.updated', { ...foreign, quantity: 9 }))).status(),
    ).toBe(200);
    expect((await seats(owner)).seatsPurchased).toBe(2);
    // Bad signature: 400 and nothing applied.
    expect(
      (
        await sendWebhook(stripeEvent('customer.subscription.updated', await stripeSub(subscriptionId)), {
          secret: 'whsec_wrong',
        })
      ).status(),
    ).toBe(400);
    void customer;
  });

  test('Team → Pro in the billing portal: Pro holds one seat, the spare quantity is credited, coders get grace', async () => {
    const owner = await signup('seat-down');
    const { subscriptionId } = await subscribe(owner, 'price_qc_team_m');
    const coder = await signup('seat-down-coder', { verify: true });
    const canvasId = await createCanvas(owner, 'Downgrade');
    const t = await addTranscript(owner, canvasId, 'Nights', TEXT);
    const q = await addCode(owner, canvasId, 'Staffing');
    await inviteCoderConfirmed(owner, canvasId, coder.email);
    const pendingBefore = (await stripeControl(`pending/${subscriptionId}`)).length;

    // The portal switches the price and leaves the quantity (2) alone.
    await stripeControl(`subscriptions/${subscriptionId}`, { price: 'price_qc_pro_m' });
    await sendWebhook(stripeEvent('customer.subscription.updated', await stripeSub(subscriptionId)));
    expect((await me(owner)).user.plan).toBe('pro');
    const st = await seats(owner);
    expect(st).toMatchObject({
      mode: 'solo',
      plan: 'pro',
      seatsPurchased: 1,
      subscriptionQuantity: 1,
      teamUpgrade: 'in_place',
      seatsUsed: 2,
      unseatedCount: 1,
      enforcing: false,
    });
    // A second Pro seat lets nobody edit, so it is dropped and its unused
    // time credited to the next bill: never a charge.
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(1);
    const credits = (await stripeControl(`pending/${subscriptionId}`)).slice(pendingBefore);
    expect(credits.reduce((sum: number, l: any) => sum + l.amount, 0)).toBeLessThan(0);
    // Grace: the coder keeps editing.
    expect(Date.parse(st.graceEndsAt) - Date.now()).toBeGreaterThan(29.9 * 86_400_000);
    expect((await codeOnce(coder, canvasId, t, q)).status()).toBe(201);
  });
});

test.describe('Pro is a one-person plan: a second coder needs Team', () => {
  async function proOwnerWithCanvas(tag: string) {
    const owner = await signup(tag);
    const sub = await subscribe(owner, 'price_qc_pro_m');
    const canvasId = await createCanvas(owner, 'Solo study');
    const t = await addTranscript(owner, canvasId, 'Nights', TEXT);
    const q = await addCode(owner, canvasId, 'Staffing');
    return { owner, canvasId, t, q, ...sub };
  }

  test('Pro checkout is exactly one seat, not adjustable', async () => {
    const owner = await signup('solo-checkout');
    const checkout = await ok(await owner.ctx.post('billing/create-checkout', { data: { priceId: 'price_qc_pro_m' } }));
    const session = await stripeControl(`sessions/${String(checkout.data.url).split('/').pop()}`);
    expect(session.quantity).toBe(1);
    expect(session.adjustable_quantity).toBe(false);
  });

  test('adding a coder quotes the switch to Team; nothing changes until confirmed; a viewer is free instead', async () => {
    const { owner, canvasId, t, q, subscriptionId } = await proOwnerWithCanvas('solo-owner');
    const coder = await signup('solo-coder', { verify: true });
    const viewer = await signup('solo-viewer', { verify: true });

    // 1. The prompt: 402 TEAM_REQUIRED with Stripe's own quote.
    const refused = await invite(owner, canvasId, coder.email, 'editor');
    expect(refused.status()).toBe(402);
    const body = await json(refused);
    expect(body).toMatchObject({ code: 'TEAM_REQUIRED', upgrade: 'in_place', seatsNeeded: 2 });
    const quote = body.preview;
    expect(quote).toMatchObject({
      fromPlan: 'pro',
      toPlan: 'team',
      currentQuantity: 1,
      newQuantity: 2,
      unitAmount: 3900,
      currentUnitAmount: 1500,
      interval: 'month',
      nextRenewal: 7800,
    });
    // Today: two Team seats for the rest of the period, less the unused Pro.
    expect(quote.dueNow).toBeGreaterThan(0);
    expect(quote.dueNow).toBeLessThanOrEqual(7800 - 1500);
    // Nothing changed anywhere.
    const live = await stripeSub(subscriptionId);
    expect(live.items.data[0]).toMatchObject({ quantity: 1, price: { id: 'price_qc_pro_m' } });
    expect(await invoicesFor(subscriptionId)).toHaveLength(0);
    expect((await me(owner)).user.plan).toBe('pro');
    expect((await coder.ctx.get(`canvas/${canvasId}`)).status()).not.toBe(200);
    // A plain seat confirmation does not upgrade anyone.
    expect(
      (
        await invite(owner, canvasId, coder.email, 'editor', {
          confirmSeatCharge: true,
          prorationDate: quote.prorationDate,
        })
      ).status(),
    ).toBe(402);
    expect((await stripeSub(subscriptionId)).items.data[0].price.id).toBe('price_qc_pro_m');

    // 2. The alternative: the same person as a free viewer.
    await ok(await invite(owner, canvasId, viewer.email, 'viewer'), 201);
    expect(await invoicesFor(subscriptionId)).toHaveLength(0);
    expect((await viewer.ctx.get(`canvas/${canvasId}`)).status()).toBe(200);
    expect((await codeOnce(viewer, canvasId, t, q)).status()).toBe(403);

    // 3. Confirmed: Team with two seats, charged exactly the quote, then the coder is added.
    await ok(
      await invite(owner, canvasId, coder.email, 'editor', {
        confirmTeamUpgrade: true,
        prorationDate: quote.prorationDate,
      }),
      201,
    );
    const after = await stripeSub(subscriptionId);
    expect(after.items.data[0]).toMatchObject({ quantity: 2, price: { id: 'price_qc_team_m' } });
    const invs = await invoicesFor(subscriptionId);
    expect(invs).toHaveLength(1);
    expect(invs[0]).toMatchObject({ status: 'paid', amount_due: quote.dueNow });
    expect((await me(owner)).user.plan).toBe('team');
    // The webhook Stripe sends for the switch agrees.
    expect((await sendWebhook(stripeEvent('customer.subscription.updated', after))).status()).toBe(200);
    expect((await me(owner)).user.plan).toBe('team');
    expect(await seats(owner)).toMatchObject({ mode: 'billed', plan: 'team', seatsPurchased: 2, unseatedCount: 0 });
    expect((await codeOnce(coder, canvasId, t, q)).status()).toBe(201);
  });

  test('error: a declined card leaves the owner on Pro, adds nobody and leaves nothing to pay', async () => {
    const { owner, canvasId, subscriptionId, customer } = await proOwnerWithCanvas('solo-decline');
    const coder = await signup('solo-decline-coder', { verify: true });
    const quote = (await json(await invite(owner, canvasId, coder.email, 'editor'))).preview;
    await stripeControl(`customers/${customer}`, { card: 'declined' });
    const res = await invite(owner, canvasId, coder.email, 'editor', {
      confirmTeamUpgrade: true,
      prorationDate: quote.prorationDate,
    });
    expect(res.status()).toBe(402);
    expect((await json(res)).code).toBe('SEAT_PAYMENT_FAILED');
    expect((await stripeSub(subscriptionId)).items.data[0]).toMatchObject({
      quantity: 1,
      price: { id: 'price_qc_pro_m' },
    });
    expect((await invoicesFor(subscriptionId)).map((i: any) => i.status)).toEqual(['void']);
    expect((await me(owner)).user.plan).toBe('pro');
    expect((await coder.ctx.get(`canvas/${canvasId}`)).status()).not.toBe(200);
  });

  test('a trial owner (no subscription) is pointed at Team checkout and can still add viewers', async () => {
    const owner = await signup('solo-trial', { verify: true }); // 14-day Pro trial
    const coder = await signup('solo-trial-coder', { verify: true });
    const canvasId = await createCanvas(owner, 'Trial study');
    const res = await invite(owner, canvasId, coder.email, 'editor');
    expect(res.status()).toBe(402);
    expect(await json(res)).toMatchObject({ code: 'TEAM_REQUIRED', upgrade: 'checkout', preview: null });
    expect((await seats(owner)).mode).toBe('trial');
    await ok(await invite(owner, canvasId, coder.email, 'viewer'), 201);
  });
});

test.describe('Seats: existing coders get a grace period, never a lock-out', () => {
  test.afterEach(async () => {
    await setClock(null);
  });

  test('existing Pro coders keep editing for 30 days, then read-only with nothing lost, until the owner upgrades to Team', async () => {
    // A Pro account that already has coders: Team with two coders, then the
    // owner moves to Pro in the billing portal (the path by which Pro accounts
    // come to hold coders, besides data from before this change).
    const owner = await signup('grace-owner');
    const { subscriptionId } = await subscribe(owner, 'price_qc_team_m');
    const [c1, c2] = [await signup('grace-c1', { verify: true }), await signup('grace-c2', { verify: true })];
    const canvasId = await createCanvas(owner, 'Grace study');
    const t = await addTranscript(owner, canvasId, 'Nights', TEXT);
    const q = await addCode(owner, canvasId, 'Staffing');
    await inviteCoderConfirmed(owner, canvasId, c1.email);
    await inviteCoderConfirmed(owner, canvasId, c2.email);
    await stripeControl(`subscriptions/${subscriptionId}`, { price: 'price_qc_pro_m' });
    await sendWebhook(stripeEvent('customer.subscription.updated', await stripeSub(subscriptionId)));

    const st = await seats(owner);
    expect(st).toMatchObject({ mode: 'solo', seatsPurchased: 1, seatsUsed: 3, unseatedCount: 2, enforcing: false });
    const graceMs = Date.parse(st.graceEndsAt) - Date.now();
    expect(graceMs).toBeGreaterThan(29.9 * 86_400_000);
    expect(graceMs).toBeLessThan(30.1 * 86_400_000);
    // In grace: coders still work.
    expect((await codeOnce(c1, canvasId, t, q)).status()).toBe(201);
    const codingsBefore = (await ok(await owner.ctx.get(`canvas/${canvasId}`))).data.codings.length;

    // 31 days later (the subscription renewed meanwhile): read-only, not locked out.
    const later = new Date(Date.now() + 31 * 86_400_000);
    await setClock(later.toISOString());
    // Sessions last 24h; everyone signs in again a month later.
    for (const s of [owner, c1, c2])
      await ok(await s.ctx.post('auth/email-login', { data: { email: s.email, password: s.password } }));
    const renewedStart = Math.floor(later.getTime() / 1000) - 86_400;
    await stripeControl(`subscriptions/${subscriptionId}`, {
      current_period_start: renewedStart,
      current_period_end: renewedStart + 30 * 86_400,
    });
    const blocked = await codeOnce(c1, canvasId, t, q);
    expect(blocked.status()).toBe(403);
    expect((await json(blocked)).code).toBe('SEAT_REQUIRED_FOR_EDITING');
    const readOnly = await ok(await c1.ctx.get(`canvas/${canvasId}`));
    expect(readOnly.data.myRole).toBe('viewer'); // the workspace opens read-only
    expect(readOnly.data.codings).toHaveLength(codingsBefore); // nothing they coded is lost
    expect((await codeOnce(owner, canvasId, t, q)).status()).toBe(201);
    expect((await seats(owner)).enforcing).toBe(true);
    // No emails about it: the prompt is in-app only.
    expect(emailsTo(owner.email).filter((m) => /seat|coder|team/i.test(m.subject ?? ''))).toEqual([]);

    // Pro cannot buy extra seats; the way on is Team.
    const noSeats = await owner.ctx.post('billing/seats', { data: { quantity: 3 } });
    expect(noSeats.status()).toBe(409);
    expect((await json(noSeats)).code).toBe('PRO_IS_SOLO');
    const quoteRes = await owner.ctx.post('billing/seats/upgrade-to-team', { data: {} });
    expect(quoteRes.status()).toBe(402);
    const quote = await json(quoteRes);
    expect(quote).toMatchObject({ code: 'TEAM_REQUIRED', upgrade: 'in_place', seatsNeeded: 3 });
    expect(quote.preview).toMatchObject({ currentQuantity: 1, newQuantity: 3, unitAmount: 3900, nextRenewal: 11700 });
    expect((await stripeSub(subscriptionId)).items.data[0].price.id).toBe('price_qc_pro_m');
    const done = await ok(
      await owner.ctx.post('billing/seats/upgrade-to-team', {
        data: { confirmTeamUpgrade: true, prorationDate: quote.preview.prorationDate },
      }),
    );
    expect(done.data).toMatchObject({
      mode: 'billed',
      plan: 'team',
      seatsPurchased: 3,
      unseatedCount: 0,
      enforcing: false,
    });
    const invs = await invoicesFor(subscriptionId);
    expect(invs[invs.length - 1]).toMatchObject({ status: 'paid', amount_due: quote.preview.dueNow });
    expect((await codeOnce(c1, canvasId, t, q)).status()).toBe(201);
    expect((await codeOnce(c2, canvasId, t, q)).status()).toBe(201);
    expect((await ok(await c1.ctx.get(`canvas/${canvasId}`))).data.myRole).toBe('editor');
  });
});

test.describe('Seats in the browser', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('jms_cookie_consent', 'rejected');
      const existing = localStorage.getItem('qualcanvas-ui');
      const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
      state.state = {
        ...state.state,
        onboardingComplete: true,
        setupWizardComplete: true,
        onboardingV2Complete: true,
        onboardingChecklistDismissed: true,
        showFullProductTour: false,
      };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
    });
  });

  async function signIn(page: import('@playwright/test').Page, s: Session) {
    await page.goto('/login');
    const panel = page.locator('#auth-panel-login');
    await panel.getByPlaceholder('you@university.edu').fill(s.email);
    await panel.getByPlaceholder('Enter your password').fill(s.password);
    await panel.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(canvas|onboarding|welcome)/, { timeout: 30_000 });
  }

  test('the owner sees the quote in the Share dialog, confirms it, and manages seats on the Account page', async ({
    page,
  }) => {
    const owner = await signup('ui-seat-owner');
    const { subscriptionId } = await subscribe(owner, 'price_qc_team_m');
    const coder = await signup('ui-seat-coder', { verify: true });
    const canvasId = await createCanvas(owner, 'UI seats study');

    await signIn(page, owner);
    await page.goto(`/canvas/${canvasId}`);
    await page.locator('button[title="Share canvas"]').click();
    const share = page.getByRole('dialog', { name: 'Share Canvas' });
    await expect(share.getByTestId('share-seat-note')).toContainText('Each coder uses a paid seat ($39.00 / month)');
    await share.getByLabel("Coder's email address").fill(coder.email);
    await share.getByRole('button', { name: 'Invite', exact: true }).click();

    const quote = page.getByRole('alertdialog');
    await expect(quote).toContainText('Add a paid seat?');
    await expect(quote.getByTestId('seat-quantity-change')).toHaveText('1 → 2');
    await expect(quote.getByTestId('seat-next-renewal')).toHaveText('$78.00 / month');
    // Keyboard: focus is trapped in the dialog and starts inside it.
    expect(await quote.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    const axe = await new AxeBuilder({ page }).include('[role="alertdialog"]').analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    // Nothing is charged while the dialog is open.
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(1);

    await quote.getByRole('button', { name: 'Add seat and invite' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(share.getByRole('button', { name: /^Remove coder / })).toBeVisible();
    await expect.poll(async () => (await stripeSub(subscriptionId)).items.data[0].quantity).toBe(2);

    await page.goto('/account#seats');
    const panel = page.getByRole('region', { name: 'Seats' });
    await expect(panel.getByTestId('seats-summary')).toContainText('2 of 2 paid seats in use');
    await expect(panel.getByRole('list', { name: 'People holding a seat' })).toContainText(coder.email);
    const axePanel = await new AxeBuilder({ page }).include('#seats').analyze();
    expect(axePanel.violations.map((v) => v.id)).toEqual([]);
  });

  test('Pro owner adding a coder: the Share dialog offers Team (with today’s and the renewal cost) or a free viewer', async ({
    page,
  }) => {
    const owner = await signup('ui-solo-owner');
    const { subscriptionId } = await subscribe(owner, 'price_qc_pro_m');
    const first = await signup('ui-solo-first', { verify: true });
    const second = await signup('ui-solo-second', { verify: true });
    const canvasId = await createCanvas(owner, 'UI solo study');

    await signIn(page, owner);
    await page.goto(`/canvas/${canvasId}`);
    await page.locator('button[title="Share canvas"]').click();
    const share = page.getByRole('dialog', { name: 'Share Canvas' });
    await expect(share.getByTestId('share-seat-note')).toContainText('Pro is a one-person plan');

    // 1. Invite as a coder: the upgrade prompt, and nothing charged while it is open.
    await share.getByLabel("Coder's email address").fill(first.email);
    await share.getByRole('button', { name: 'Invite', exact: true }).click();
    const prompt = page.getByTestId('team-upgrade-dialog');
    await expect(prompt).toContainText('Upgrade to Team to add a coder?');
    await expect(prompt).toContainText('Pro → Team');
    await expect(prompt.getByTestId('team-upgrade-seats')).toHaveText('2');
    await expect(prompt.getByTestId('team-upgrade-renewal')).toHaveText('$78.00 / month');
    await expect(prompt.getByTestId('team-upgrade-due-now')).toHaveText(/^\$\d+\.\d\d$/);
    expect(await prompt.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    const axe = await new AxeBuilder({ page }).include('[data-testid="team-upgrade-dialog"]').analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    expect((await stripeSub(subscriptionId)).items.data[0]).toMatchObject({
      quantity: 1,
      price: { id: 'price_qc_pro_m' },
    });

    // 2. They choose "Add as viewer": free, no plan change.
    await prompt.getByRole('button', { name: 'Add as viewer (free)' }).click();
    await expect(page.getByTestId('team-upgrade-dialog')).toHaveCount(0);
    await expect(share.getByRole('button', { name: /^Remove coder Estate ui-solo-first/ })).toBeVisible();
    const list = (await ok(await owner.ctx.get(`canvas/${canvasId}/collaborators`))).data;
    expect(list.find((c: any) => c.userId === first.userId)?.role).toBe('viewer');
    expect(await invoicesFor(subscriptionId)).toHaveLength(0);

    // 3. A second person as a coder: this time they upgrade.
    await share.getByLabel("Coder's email address").fill(second.email);
    await share.getByRole('button', { name: 'Invite', exact: true }).click();
    const dueNow = (await page.getByTestId('team-upgrade-due-now').textContent())!;
    await page.getByTestId('team-upgrade-dialog').getByRole('button', { name: 'Upgrade to Team' }).click();
    await expect(page.getByTestId('team-upgrade-dialog')).toHaveCount(0);
    await expect(share.getByRole('button', { name: /^Remove coder Estate ui-solo-second/ })).toBeVisible();
    await expect
      .poll(async () => (await stripeSub(subscriptionId)).items.data[0])
      .toMatchObject({ quantity: 2, price: { id: 'price_qc_team_m' } });
    const invs = await invoicesFor(subscriptionId);
    expect(`$${(invs[0].amount_due / 100).toFixed(2)}`).toBe(dueNow);

    await page.goto('/account#seats');
    await expect(page.getByRole('region', { name: 'Seats' }).getByTestId('seats-summary')).toContainText(
      '2 of 2 paid seats in use',
    );
  });

  test('a Pro owner with coders gets the reminder banner with the grace date and upgrades from Account → Seats', async ({
    page,
  }) => {
    // Pro with a coder already on the canvas (Team, then Pro in the billing portal).
    const owner = await signup('ui-grace-owner');
    const { subscriptionId } = await subscribe(owner, 'price_qc_team_m');
    const coder = await signup('ui-grace-coder', { verify: true });
    const canvasId = await createCanvas(owner, 'UI grace');
    await inviteCoderConfirmed(owner, canvasId, coder.email);
    await stripeControl(`subscriptions/${subscriptionId}`, { price: 'price_qc_pro_m' });
    await sendWebhook(stripeEvent('customer.subscription.updated', await stripeSub(subscriptionId)));

    await signIn(page, owner);
    await page.goto('/canvas');
    const banner = page.getByTestId('seat-shortfall-banner');
    await expect(banner).toContainText('Pro is a one-person plan: 1 coder needs Team. They can keep editing until');
    await banner.getByRole('link', { name: 'See options' }).click();
    await expect(page).toHaveURL(/\/account#seats$/);
    const panel = page.getByRole('region', { name: 'Seats' });
    await expect(panel.getByTestId('seats-summary')).toContainText('Pro is a one-person plan');
    await expect(panel.getByRole('list', { name: 'People holding a seat' })).toContainText('Needs Team');
    const axePanel = await new AxeBuilder({ page }).include('#seats').analyze();
    expect(axePanel.violations.map((v) => v.id)).toEqual([]);
    await panel.getByRole('button', { name: 'Upgrade to Team' }).click();
    await page.getByTestId('team-upgrade-dialog').getByRole('button', { name: 'Upgrade to Team' }).click();
    await expect(panel.getByTestId('seats-summary')).toContainText('2 of 2 paid seats in use');
    expect((await stripeSub(subscriptionId)).items.data[0]).toMatchObject({
      quantity: 2,
      price: { id: 'price_qc_team_m' },
    });
  });
});
